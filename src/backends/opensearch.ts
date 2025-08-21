import { IRassBackend, EmbedRequest, EmbedResponse, SearchRequest, SearchResponse, EmbeddedDocument, RefreshRequest } from '../types.js';
import { config } from '../config.js';
import { Client } from '@opensearch-project/opensearch';
import crypto from 'crypto';

function deterministicVector(text: string, dim: number): number[] {
  const hash = crypto.createHash('sha256').update(text).digest();
  const vector: number[] = [];
  for (let i = 0; i < dim; i++) {
    const byte = hash[i % hash.length];
    vector.push(((byte / 255) * 2) - 1);
  }
  return vector;
}

export class OpenSearchBackend implements IRassBackend {
  private readonly client: Client;
  private readonly dim: number;
  constructor(node = config.opensearchNode, dim = config.vectorDim) {
    this.client = new Client({ node });
    this.dim = dim;
  }

  private indexName(appId: string) { return `rass-${appId}`.toLowerCase(); }

  private async ensureIndex(appId: string) {
    const index = this.indexName(appId);
    const exists = await this.client.indices.exists({ index });
    if (!exists) {
      await this.client.indices.create({
        index,
        body: {
          settings: {
            index: { knn: true }
          },
          mappings: {
            properties: {
              appId: { type: 'keyword' },
              documentId: { type: 'keyword' },
              owner: { type: 'keyword' },
              content: { type: 'text' },
              metadata: { type: 'object', enabled: true },
              embedding: { type: 'knn_vector', dimension: this.dim },
              createdAt: { type: 'date' }
            }
          }
        }
      });
    }
  }

  async embed(req: EmbedRequest): Promise<EmbedResponse> {
    await this.ensureIndex(req.appId);
    const embedding = deterministicVector(req.content + '::' + req.documentId, this.dim);
    const id = crypto.createHash('md5').update(req.appId + ':' + req.documentId).digest('hex');
    const index = this.indexName(req.appId);
    const createdAt = new Date().toISOString();
    await this.client.index({
      index,
      id,
      body: {
        appId: req.appId,
        documentId: req.documentId,
        owner: req.owner,
        content: req.content,
        metadata: req.metadata,
        embedding,
        createdAt
      },
      refresh: 'wait_for'
    });
    return {
      id,
      appId: req.appId,
      documentId: req.documentId,
      vectorDimension: this.dim,
      status: 'embedded',
      createdAt
    };
  }

  async search(req: SearchRequest): Promise<SearchResponse> {
    await this.ensureIndex(req.appId);
    const start = Date.now();
    const vector = deterministicVector(req.query + '::query', this.dim);
    const topK = req.topK || 5;
    const index = this.indexName(req.appId);
    let query: any;
    if (req.owner) {
      query = {
        bool: {
          must: [
            { knn: { embedding: { vector, k: topK } } }
          ],
          filter: [ { term: { owner: req.owner } } ]
        }
      };
    } else {
      query = { knn: { embedding: { vector, k: topK } } };
    }
    const response = await this.client.search({
      index,
      size: topK,
      body: { query }
    });
  const rawHits: any[] = (response as any).hits?.hits || [];
  const hits = rawHits.map(h => ({
      id: h._id,
      documentId: h._source.documentId,
      score: h._score,
      snippet: (h._source.content as string).slice(0, 200),
      metadata: h._source.metadata
    }));
    return {
      appId: req.appId,
      query: req.query,
      topK,
      hits,
      tookMs: Date.now() - start
    };
  }

  async getItem(id: string): Promise<EmbeddedDocument | undefined> {
    // We don't know appId -> need to search across indices (lightweight approach) or require caller to pass appId; for now attempt across pattern.
    // Simplify: user passes full id known; we search using _search across all rass-* indices.
  const response = await this.client.search({
      index: 'rass-*',
      size: 1,
      body: { query: { term: { _id: id } } }
    });
  const firstHit = (response as any).hits?.hits?.[0];
  if (!firstHit) return undefined;
  const hit = firstHit;
  const src = hit._source;
    return {
      id: hit._id,
      appId: src.appId,
      documentId: src.documentId,
      owner: src.owner,
      content: src.content,
      embedding: src.embedding,
      metadata: src.metadata,
      createdAt: src.createdAt
    };
  }

  async refresh(req: RefreshRequest): Promise<{ status: string }> {
    const index = this.indexName(req.appId);
    await this.client.indices.refresh({ index });
    return { status: 'ok' };
  }
}
