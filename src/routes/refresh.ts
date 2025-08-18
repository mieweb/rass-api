import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IRassBackend, RefreshRequest } from '../types/index.js';

export default async function refreshRoute(fastify: FastifyInstance) {
  const backend: IRassBackend = fastify.backend;

  fastify.post('/refresh', {
    schema: {
      body: {
        type: 'object',
        properties: {
          application: { type: 'string' },
          source: { type: 'string' },
          force: { type: 'boolean', default: false }
        }
      },
      response: {
        200: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['success', 'error'] },
            message: { type: 'string' },
            processed: { type: 'integer' },
            errors: { type: 'integer' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: RefreshRequest }>, reply: FastifyReply) => {
    try {
      const result = await backend.refresh(request.body || {});
      return reply.send(result);
    } catch (error) {
      fastify.log.error({ error }, 'Refresh error');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to refresh documents'
      });
    }
  });
}