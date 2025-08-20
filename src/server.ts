import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { config } from './config.js';
import { SimulatedBackend } from './backends/simulated.js';
import { OpenSearchBackend } from './backends/opensearch.js';
import { embedRoutes } from './routes/embed.js';
import { searchRoutes } from './routes/search.js';
import { itemRoutes } from './routes/item.js';
import { refreshRoutes } from './routes/refresh.js';

async function buildServer() {
  const fastify = Fastify({ logger: true });

  // Load OpenAPI
  const openapiPath = path.join(process.cwd(), 'openapi.yaml');
  let openapiDoc: any = {};
  if (fs.existsSync(openapiPath)) {
    const raw = fs.readFileSync(openapiPath, 'utf-8');
    openapiDoc = YAML.parse(raw);
  }

  await fastify.register(swagger, {
    openapi: openapiDoc,
  });
  await fastify.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: false },
  });

  // Backend selection
  const backend: SimulatedBackend | OpenSearchBackend = config.backend === 'opensearch'
    ? new OpenSearchBackend()
    : new SimulatedBackend();
  // Decorate without strict typing to avoid union complexity for now
  (fastify as any).rassBackend = backend;

  // Health
  fastify.get('/health', async () => ({ status: 'ok', backend: config.backend }));

  await embedRoutes(fastify, { backend });
  await searchRoutes(fastify, { backend });
  await itemRoutes(fastify, { backend });
  await refreshRoutes(fastify, { backend });

  return fastify;
}

buildServer().then(server => {
  server.listen({ port: config.port, host: '0.0.0.0' }).catch(err => {
    server.log.error(err);
    process.exit(1);
  });
});
