import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IRassBackend } from '../types/index.js';

export default async function itemRoute(fastify: FastifyInstance) {
  const backend: IRassBackend = fastify.backend;

  fastify.get('/item/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          required: ['id', 'content', 'metadata', 'created_at', 'updated_at'],
          properties: {
            id: { type: 'string' },
            content: { type: 'string' },
            metadata: { type: 'object' },
            embedding: {
              type: 'array',
              items: { type: 'number' }
            },
            created_at: { type: 'string' },
            updated_at: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const result = await backend.getItem(request.params.id);
      return reply.send(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Document with id ${request.params.id} not found`
        });
      }
      
      fastify.log.error({ error }, 'Get item error');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve document'
      });
    }
  });
}