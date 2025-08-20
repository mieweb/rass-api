import { FastifyInstance } from 'fastify';
import { IRassBackend } from '../types.js';
import { apiKeyAuth } from '../auth.js';

export async function itemRoutes(fastify: FastifyInstance, opts: { backend: IRassBackend }) {
  fastify.get('/item/:id', {
    preHandler: apiKeyAuth,
    schema: {
      summary: 'Get embedded document by id',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } }
      },
      response: {
        200: {
          type: 'object',
          required: ['id', 'appId', 'documentId', 'content', 'embedding'],
          properties: {
            id: { type: 'string' },
            appId: { type: 'string' },
            documentId: { type: 'string' },
            owner: { type: 'string' },
            content: { type: 'string' },
            embedding: { type: 'array', items: { type: 'number' } },
            metadata: { type: 'object', additionalProperties: true },
            createdAt: { type: 'string' }
          }
        },
        404: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    const { id } = req.params as any;
    const item = await opts.backend.getItem(id);
    if (!item) return reply.code(404).send({ error: 'Not found' });
    return item;
  });
}
