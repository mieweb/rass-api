import {
  IRassBackend,
  EmbedRequest,
  EmbedResponse,
  SearchRequest,
  SearchResponse,
  EmbeddedDocument,
  RefreshRequest,
  RefreshResponse,
  SearchResult
} from '../types/index.js';

/**
 * Simulated backend that returns deterministic, hard-coded responses
 * Useful for testing, development, and client library generation
 */
export class SimulatedBackend implements IRassBackend {
  private documents: Map<string, EmbeddedDocument> = new Map();

  constructor() {
    // Pre-populate with some sample documents for demonstration
    this.initializeSampleData();
  }

  private initializeSampleData(): void {
    const sampleDocs: EmbeddedDocument[] = [
      {
        id: 'doc-1',
        content: 'This is a sample document about machine learning and artificial intelligence in healthcare.',
        metadata: {
          title: 'AI in Healthcare',
          source: 'articles',
          application: 'mediawiki',
          author: 'Dr. Smith',
          url: 'https://example.com/ai-healthcare'
        },
        embedding: this.generateDeterministicEmbedding('ai healthcare machine learning'),
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z'
      },
      {
        id: 'doc-2',
        content: 'Software development best practices including code review and testing methodologies.',
        metadata: {
          title: 'Development Best Practices',
          source: 'documentation',
          application: 'redmine',
          author: 'Jane Doe',
          url: 'https://example.com/dev-practices'
        },
        embedding: this.generateDeterministicEmbedding('software development testing code review'),
        created_at: '2024-01-02T14:30:00Z',
        updated_at: '2024-01-02T14:30:00Z'
      },
      {
        id: 'doc-3',
        content: 'Team communication strategies and remote work collaboration tools for distributed teams.',
        metadata: {
          title: 'Remote Team Communication',
          source: 'chat',
          application: 'rocketchat',
          author: 'Team Lead',
          url: 'https://example.com/team-comm'
        },
        embedding: this.generateDeterministicEmbedding('team communication remote work collaboration'),
        created_at: '2024-01-03T09:15:00Z',
        updated_at: '2024-01-03T09:15:00Z'
      }
    ];

    sampleDocs.forEach(doc => this.documents.set(doc.id, doc));
  }

  /**
   * Generate a deterministic embedding based on content hash
   * This ensures consistent responses for testing
   */
  private generateDeterministicEmbedding(content: string): number[] {
    const embedding: number[] = [];
    const hash = this.simpleHash(content);
    
    // Generate 384-dimensional embedding (common size for sentence transformers)
    for (let i = 0; i < 384; i++) {
      const value = Math.sin(hash + i) * 0.5 + Math.cos(hash * 2 + i) * 0.3;
      embedding.push(parseFloat(value.toFixed(6)));
    }
    
    return embedding;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Simulate cosine similarity calculation for search
   */
  private calculateSimilarity(queryEmbedding: number[], docEmbedding: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < Math.min(queryEmbedding.length, docEmbedding.length); i++) {
      dotProduct += queryEmbedding[i] * docEmbedding[i];
      normA += queryEmbedding[i] * queryEmbedding[i];
      normB += docEmbedding[i] * docEmbedding[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    try {
      const embedding = this.generateDeterministicEmbedding(request.content);
      const now = new Date().toISOString();
      
      const document: EmbeddedDocument = {
        id: request.id,
        content: request.content,
        metadata: request.metadata || {},
        embedding,
        created_at: now,
        updated_at: now
      };

      this.documents.set(request.id, document);

      return {
        id: request.id,
        status: 'success',
        embedding
      };
    } catch (error) {
      return {
        id: request.id,
        status: 'error',
        message: `Failed to embed document: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    const queryEmbedding = this.generateDeterministicEmbedding(request.query);
    const results: SearchResult[] = [];

    // Filter documents based on request filters
    const filteredDocs = Array.from(this.documents.values()).filter(doc => {
      if (!request.filters) return true;

      if (request.filters.application && doc.metadata.application !== request.filters.application) {
        return false;
      }
      if (request.filters.source && doc.metadata.source !== request.filters.source) {
        return false;
      }
      if (request.filters.author && doc.metadata.author !== request.filters.author) {
        return false;
      }

      // Date range filtering
      if (request.filters.date_range) {
        const docDate = new Date(doc.created_at);
        if (request.filters.date_range.start && docDate < new Date(request.filters.date_range.start)) {
          return false;
        }
        if (request.filters.date_range.end && docDate > new Date(request.filters.date_range.end)) {
          return false;
        }
      }

      return true;
    });

    // Calculate similarity scores and sort
    for (const doc of filteredDocs) {
      if (!doc.embedding) continue;

      const score = this.calculateSimilarity(queryEmbedding, doc.embedding);
      
      // Simple keyword matching for highlighting
      const queryWords = request.query.toLowerCase().split(' ');
      const highlights = queryWords
        .filter(word => doc.content.toLowerCase().includes(word))
        .map(word => {
          const regex = new RegExp(`(${word})`, 'gi');
          const matches = doc.content.match(regex);
          return matches ? matches[0] : word;
        });

      results.push({
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
        score,
        highlights: highlights.length > 0 ? highlights : undefined
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply pagination
    const limit = request.limit || 10;
    const offset = request.offset || 0;
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      total: results.length,
      offset,
      limit,
      query: request.query
    };
  }

  async getItem(id: string): Promise<EmbeddedDocument> {
    const document = this.documents.get(id);
    if (!document) {
      throw new Error(`Document with id ${id} not found`);
    }
    return document;
  }

  async refresh(request: RefreshRequest): Promise<RefreshResponse> {
    try {
      let processed = 0;
      const errors = 0;

      // Filter documents based on refresh request
      const docsToRefresh = Array.from(this.documents.values()).filter(doc => {
        if (request.application && doc.metadata.application !== request.application) {
          return false;
        }
        if (request.source && doc.metadata.source !== request.source) {
          return false;
        }
        return true;
      });

      // Simulate refreshing embeddings
      for (const doc of docsToRefresh) {
        doc.embedding = this.generateDeterministicEmbedding(doc.content);
        doc.updated_at = new Date().toISOString();
        this.documents.set(doc.id, doc);
        processed++;
      }

      return {
        status: 'success',
        message: `Successfully refreshed ${processed} documents`,
        processed,
        errors
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to refresh documents: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processed: 0,
        errors: 1
      };
    }
  }
}