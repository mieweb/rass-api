import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from './config.js';

export async function apiKeyAuth(req: FastifyRequest, reply: FastifyReply) {
  if (!config.apiKey) {
    return; // auth disabled
  }
  const key = req.headers['x-api-key'];
  if (key !== config.apiKey) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}
