import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export default async function healthRoute(fastify: FastifyInstance) {
  fastify.get('/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            backend: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      backend: process.env.RASS_BACKEND || 'simulated'
    });
  });
}