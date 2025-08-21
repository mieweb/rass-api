import { FastifyInstance } from 'fastify';
import { IRassBackend } from '../types.js';
import { apiKeyAuth } from '../auth.js';

export async function refreshRoutes(fastify: FastifyInstance, opts: { backend: IRassBackend }) {
  fastify.post('/refresh', {
    preHandler: apiKeyAuth,
    schema: {
      summary: 'Refresh backend index for app',
      body: {
        type: 'object',
        required: ['appId'],
        properties: { appId: { type: 'string' } }
      },
      response: {
        200: {
          type: 'object',
          required: ['status'],
          properties: { status: { type: 'string' } }
        }
      }
    }
  }, async (req, reply) => {
    const body: any = req.body;
    return opts.backend.refresh(body);
  });
}
