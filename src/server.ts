import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { loadConfig, validateConfig } from './config/index.js';
import { SimulatedBackend } from './backends/simulated.js';
import { OpenSearchBackend } from './backends/opensearch.js';
import { IRassBackend } from './types/index.js';

import embedRoute from './routes/embed.js';
import searchRoute from './routes/search.js';
import itemRoute from './routes/item.js';
import refreshRoute from './routes/refresh.js';
import healthRoute from './routes/health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Extend Fastify instance to include backend
declare module 'fastify' {
  interface FastifyInstance {
    backend: IRassBackend;
  }
}

async function buildServer() {
  // Load configuration
  const config = loadConfig();
  validateConfig(config);

  // Create Fastify instance
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info'
    }
  });

  // Initialize backend
  let backend: IRassBackend;
  
  if (config.backend === 'opensearch') {
    if (!config.opensearch) {
      throw new Error('OpenSearch configuration is required for opensearch backend');
    }
    
    backend = new OpenSearchBackend(config.opensearch);
    fastify.log.info('Initializing OpenSearch backend...');
    
    // Initialize OpenSearch index
    await (backend as OpenSearchBackend).initialize();
    fastify.log.info('OpenSearch backend initialized');
  } else {
    backend = new SimulatedBackend();
    fastify.log.info('Using simulated backend');
  }

  // Register backend with Fastify instance
  fastify.decorate('backend', backend);

  // Authentication middleware
  if (config.auth?.enabled) {
    fastify.addHook('preHandler', async (request, reply) => {
      // Skip auth for health endpoint and docs
      if (request.url === '/health' || request.url.startsWith('/docs')) {
        return;
      }

      const apiKey = request.headers['x-api-key'];
      if (!apiKey || apiKey !== config.auth?.apiKey) {
        reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing API key' });
        return;
      }
    });
  }

  // Load OpenAPI specification
  const openApiPath = join(__dirname, '..', 'openapi.yaml');
  const openApiSpec = readFileSync(openApiPath, 'utf8');

  // Register Swagger
  await fastify.register(swagger, {
    mode: 'static',
    specification: {
      path: openApiPath,
      postProcessor: function(swaggerObject) {
        return swaggerObject;
      },
      baseDir: join(__dirname, '..')
    }
  });

  // Register Swagger UI with configuration to avoid SSL issues
  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    staticCSP: false,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
      validatorUrl: null, // Disable external validation to prevent SSL issues
      layout: 'BaseLayout',
      // Disable trying to contact external services
      supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
    },
    transformSpecificationClone: true
  });

  // Register routes
  await fastify.register(embedRoute);
  await fastify.register(searchRoute);
  await fastify.register(itemRoute);
  await fastify.register(refreshRoute);
  await fastify.register(healthRoute);

  // Root endpoint
  fastify.get('/', async (request, reply) => {
    return {
      name: 'RASS API',
      version: '1.0.0',
      description: 'Reference Architecture for Semantic Search',
      backend: config.backend,
      documentation: '/docs'
    };
  });

  return fastify;
}

async function start() {
  try {
    const config = loadConfig();
    const server = await buildServer();
    
    await server.listen({
      host: config.server?.host || 'localhost',
      port: config.server?.port || 3000
    });

    console.log(`🚀 RASS API Server running on http://${config.server?.host || 'localhost'}:${config.server?.port || 3000}`);
    console.log(`📖 API Documentation available at http://${config.server?.host || 'localhost'}:${config.server?.port || 3000}/docs`);
    console.log(`🔧 Backend: ${config.backend}`);
    
    if (config.auth?.enabled) {
      console.log('🔒 Authentication: Enabled');
    } else {
      console.log('🔓 Authentication: Disabled');
    }

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { buildServer };