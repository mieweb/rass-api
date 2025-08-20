import { FastifyInstance } from 'fastify';
import { IRassBackend } from '../types.js';
import { apiKeyAuth } from '../auth.js';

export async function searchRoutes(fastify: FastifyInstance, opts: { backend: IRassBackend }) {
  fastify.post('/search', {
    preHandler: apiKeyAuth,
    schema: {
      summary: 'Search documents',
      body: {
        type: 'object',
        required: ['appId', 'query'],
        properties: {
          appId: { type: 'string' },
          query: { type: 'string' },
          topK: { type: 'number' },
          owner: { type: 'string' },
          filters: { type: 'object', additionalProperties: true }
        }
      },
      response: {
        200: {
          type: 'object',
          required: ['appId', 'query', 'topK', 'hits', 'tookMs'],
          properties: {
            appId: { type: 'string' },
            query: { type: 'string' },
            topK: { type: 'number' },
            tookMs: { type: 'number' },
            hits: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'documentId', 'score'],
                properties: {
                  id: { type: 'string' },
                  documentId: { type: 'string' },
                  score: { type: 'number' },
                  snippet: { type: 'string' },
                  metadata: { type: 'object', additionalProperties: true }
                }
              }
            }
          }
        }
      }
    }
  }, async (req, reply) => {
    const body: any = req.body;
    return opts.backend.search(body);
  });
}
