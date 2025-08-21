import { IRassBackend, EmbedRequest, EmbedResponse, SearchRequest, SearchResponse, EmbeddedDocument, RefreshRequest } from '../types.js';
import { config } from '../config.js';
import crypto from 'crypto';

function deterministicVector(text: string, dim: number): number[] {
  const hash = crypto.createHash('sha256').update(text).digest();
  const vector: number[] = [];
  for (let i = 0; i < dim; i++) {
    const byte = hash[i % hash.length];
    // map byte (0-255) to -1..1 range deterministic
    vector.push(((byte / 255) * 2) - 1);
  }
  return vector;
}

export class SimulatedBackend implements IRassBackend {
  private readonly store = new Map<string, EmbeddedDocument>();
  private readonly dim: number;
  constructor(dim = config.vectorDim) {
    this.dim = dim;
  }

  async embed(req: EmbedRequest): Promise<EmbedResponse> {
    const embedding = deterministicVector(req.content + '::' + req.documentId, this.dim);
    const id = 'sim-' + crypto.createHash('md5').update(req.appId + ':' + req.documentId).digest('hex');
    const doc: EmbeddedDocument = {
      id,
      appId: req.appId,
      documentId: req.documentId,
      owner: req.owner,
      content: req.content,
      embedding,
      metadata: req.metadata,
      createdAt: new Date().toISOString()
    };
    this.store.set(id, doc);
    return {
      id,
      appId: req.appId,
      documentId: req.documentId,
      vectorDimension: this.dim,
      status: 'embedded',
      createdAt: doc.createdAt
    };
  }

  async search(req: SearchRequest): Promise<SearchResponse> {
    const start = Date.now();
    const qVec = deterministicVector(req.query + '::query', this.dim);
    const hits: { doc: EmbeddedDocument; score: number }[] = [];
    for (const doc of this.store.values()) {
      if (doc.appId !== req.appId) continue;
      if (req.owner && doc.owner !== req.owner) continue;
      // cosine similarity approximation (dot product since vectors are not normalized)
      let dot = 0;
      for (let i = 0; i < this.dim; i++) {
        dot += doc.embedding[i] * qVec[i];
      }
      hits.push({ doc, score: dot });
    }
    hits.sort((a, b) => b.score - a.score);
    const topK = req.topK || 5;
    const response: SearchResponse = {
      appId: req.appId,
      query: req.query,
      topK,
      tookMs: Date.now() - start,
      hits: hits.slice(0, topK).map(h => ({
        id: h.doc.id,
        documentId: h.doc.documentId,
        score: h.score,
        snippet: h.doc.content.slice(0, 200),
        metadata: h.doc.metadata
      }))
    };
    return response;
  }

  async getItem(id: string): Promise<EmbeddedDocument | undefined> {
    return this.store.get(id);
  }

  async refresh(_req: RefreshRequest): Promise<{ status: string }> {
    // nothing to do for in-memory store
    return { status: 'ok' };
  }
}
