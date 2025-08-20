import { FastifyInstance } from 'fastify';
import { IRassBackend } from '../types.js';
import { apiKeyAuth } from '../auth.js';

export async function embedRoutes(fastify: FastifyInstance, opts: { backend: IRassBackend }) {
  fastify.post('/embed', {
    preHandler: apiKeyAuth,
    schema: {
      summary: 'Embed a document',
      body: {
        type: 'object',
        required: ['appId', 'documentId', 'content'],
        properties: {
          appId: { type: 'string' },
          documentId: { type: 'string' },
          owner: { type: 'string' },
          content: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true }
        }
      },
      response: {
        200: {
          type: 'object',
          required: ['id', 'appId', 'documentId', 'vectorDimension', 'status', 'createdAt'],
          properties: {
            id: { type: 'string' },
            appId: { type: 'string' },
            documentId: { type: 'string' },
            vectorDimension: { type: 'number' },
            status: { type: 'string' },
            createdAt: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    const body: any = req.body;
    const resp = await opts.backend.embed(body);
    return resp;
  });
}
