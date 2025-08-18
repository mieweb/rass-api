import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IRassBackend, SearchRequest } from '../types/index.js';

export default async function searchRoute(fastify: FastifyInstance) {
  const backend: IRassBackend = fastify.backend;

  fastify.post('/search', {
    schema: {
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string' },
          filters: {
            type: 'object',
            properties: {
              application: { type: 'string' },
              source: { type: 'string' },
              author: { type: 'string' },
              date_range: {
                type: 'object',
                properties: {
                  start: { type: 'string', format: 'date-time' },
                  end: { type: 'string', format: 'date-time' }
                }
              }
            },
            additionalProperties: true
          },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          required: ['results', 'total', 'offset', 'limit', 'query'],
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'content', 'metadata', 'score'],
                properties: {
                  id: { type: 'string' },
                  content: { type: 'string' },
                  metadata: { type: 'object' },
                  score: { type: 'number' },
                  highlights: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                }
              }
            },
            total: { type: 'integer' },
            offset: { type: 'integer' },
            limit: { type: 'integer' },
            query: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: SearchRequest }>, reply: FastifyReply) => {
    try {
      const result = await backend.search(request.body);
      return reply.send(result);
    } catch (error) {
      fastify.log.error({ error }, 'Search error');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to search documents'
      });
    }
  });
}