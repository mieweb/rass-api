import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IRassBackend, EmbedRequest } from '../types/index.js';

export default async function embedRoute(fastify: FastifyInstance) {
  const backend: IRassBackend = fastify.backend;

  fastify.post('/embed', {
    schema: {
      body: {
        type: 'object',
        required: ['id', 'content'],
        properties: {
          id: { type: 'string' },
          content: { type: 'string' },
          metadata: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              source: { type: 'string' },
              application: {
                type: 'string',
                enum: ['redmine', 'mediawiki', 'rocketchat']
              },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
              author: { type: 'string' },
              url: { type: 'string' }
            },
            additionalProperties: true
          }
        }
      },
      response: {
        200: {
          type: 'object',
          required: ['id', 'status'],
          properties: {
            id: { type: 'string' },
            status: { type: 'string', enum: ['success', 'error'] },
            message: { type: 'string' },
            embedding: {
              type: 'array',
              items: { type: 'number' }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: EmbedRequest }>, reply: FastifyReply) => {
    try {
      const result = await backend.embed(request.body);
      return reply.send(result);
    } catch (error) {
      fastify.log.error({ error }, 'Embed error');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to embed document'
      });
    }
  });
}