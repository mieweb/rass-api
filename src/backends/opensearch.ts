import { Client } from '@opensearch-project/opensearch';
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

export interface OpenSearchConfig {
  url: string;
  username?: string;
  password?: string;
  index: string;
}

/**
 * OpenSearch backend implementation for real semantic search operations
 */
export class OpenSearchBackend implements IRassBackend {
  private readonly client: Client;
  private readonly index: string;

  constructor(config: OpenSearchConfig) {
    this.index = config.index;
    
    const clientConfig: any = {
      node: config.url,
    };

    if (config.username && config.password) {
      clientConfig.auth = {
        username: config.username,
        password: config.password,
      };
    }

    this.client = new Client(clientConfig);
  }

  private buildFilters(filters?: SearchRequest['filters']): any[] {
    const filter: any[] = [];
    if (!filters) return filter;
    if (filters.application) filter.push({ term: { 'metadata.application': filters.application } });
    if (filters.source) filter.push({ term: { 'metadata.source': filters.source } });
    if (filters.author) filter.push({ term: { 'metadata.author': filters.author } });
    if (filters.owner) filter.push({ term: { 'metadata.owner': filters.owner } });
    if (filters.date_range) {
      const dateRange: any = {};
      if (filters.date_range.start) dateRange.gte = filters.date_range.start;
      if (filters.date_range.end) dateRange.lte = filters.date_range.end;
      filter.push({ range: { created_at: dateRange } });
    }
    return filter;
  }

  /**
   * Initialize the OpenSearch index with proper mappings
   */
  async initialize(): Promise<void> {
    try {
      const indexExists = await this.client.indices.exists({ index: this.index });
      
      if (!indexExists.body) {
        await this.client.indices.create({
          index: this.index,
          body: {
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
              "index.knn": true
            },
            mappings: {
              properties: {
                id: { type: 'keyword' },
                content: { type: 'text' },
                metadata: {
                  properties: {
                    title: { type: 'text' },
                    source: { type: 'keyword' },
                    application: { type: 'keyword' },
                    owner: { type: 'keyword' },
                    author: { type: 'keyword' },
                    url: { type: 'keyword' },
                    created_at: { type: 'date' },
                    updated_at: { type: 'date' }
                  }
                },
                embedding: {
                  type: 'knn_vector',
                  dimension: 384, // Common dimension for sentence transformers
                  method: {
                    name: 'hnsw',
                    space_type: 'cosinesimil',
                    engine: 'nmslib'
                  }
                },
                created_at: { type: 'date' },
                updated_at: { type: 'date' }
              }
            }
          }
        });
      }
    } catch (error) {
      console.error('Failed to initialize OpenSearch index:', error);
      throw error;
    }
  }

  /**
   * Generate embedding using a simple mock approach
   * In a real implementation, this would call an embedding service like OpenAI, Hugging Face, etc.
   */
  private async generateEmbedding(content: string): Promise<number[]> {
    // For now, we'll use a deterministic approach similar to the simulated backend
    // In production, this should call an actual embedding model
    const embedding: number[] = [];
    const hash = this.simpleHash(content);
    
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
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    try {
      const embedding = await this.generateEmbedding(request.content);
      const now = new Date().toISOString();

      const document = {
        id: request.id,
        content: request.content,
        metadata: request.metadata || {},
        embedding,
        created_at: now,
        updated_at: now
      };

      await this.client.index({
        index: this.index,
        id: request.id,
        body: document
      });

      return {
        id: request.id,
        status: 'success',
        embedding
      };
    } catch (error) {
      console.error('OpenSearch embed error:', error);
      return {
        id: request.id,
        status: 'error',
        message: `Failed to embed document: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    try {
      const queryEmbedding = await this.generateEmbedding(request.query);
      const limit = request.limit || 10;
      const offset = request.offset || 0;

  // Build query with filters
  const filter = this.buildFilters(request.filters);

      const searchQuery = {
        index: this.index,
        body: {
          size: limit,
          from: offset,
          query: {
            bool: {
              must: [
                {
                  knn: {
                    embedding: {
                      vector: queryEmbedding,
                      k: limit + offset
                    }
                  }
                }
              ],
              filter: filter.length > 0 ? filter : undefined
            }
          },
          highlight: {
            fields: {
              content: {}
            }
          }
        }
      };

      const response = await this.client.search(searchQuery);
      const hits = response.body.hits;

      const results: SearchResult[] = hits.hits.map((hit: any) => ({
        id: hit._source.id,
        content: hit._source.content,
        metadata: hit._source.metadata,
        score: hit._score,
        highlights: hit.highlight?.content
      }));

      const total = typeof hits.total === 'number' ? hits.total : hits.total?.value || 0;

      return {
        results,
        total,
        offset,
        limit,
        query: request.query
      };
    } catch (error) {
      console.error('OpenSearch search error:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getItem(id: string): Promise<EmbeddedDocument> {
    try {
      const response = await this.client.get({
        index: this.index,
        id
      });

      if (!response.body.found) {
        throw new Error(`Document with id ${id} not found`);
      }

      const source = response.body._source;
      if (!source) {
        throw new Error(`Document with id ${id} has no source data`);
      }

      return source as EmbeddedDocument;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      console.error('OpenSearch getItem error:', error);
      throw new Error(`Failed to get document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async refresh(request: RefreshRequest): Promise<RefreshResponse> {
    try {
      // Build query to find documents to refresh
      const query: any = {
        match_all: {}
      };

      if (request.application || request.source) {
        query.bool = {
          filter: []
        };
        
        if (request.application) {
          query.bool.filter.push({ term: { 'metadata.application': request.application } });
        }
        if (request.source) {
          query.bool.filter.push({ term: { 'metadata.source': request.source } });
        }
      }

      // Get documents to refresh
      const searchResponse = await this.client.search({
        index: this.index,
        body: {
          query,
          size: 1000, // Process in batches
          _source: ['id', 'content']
        }
      });

      const documents = searchResponse.body.hits.hits;
      let processed = 0;
      let errors = 0;

      // Refresh embeddings for each document
      for (const doc of documents) {
        try {
          if (!doc._source?.content || !doc._source?.id) {
            console.warn(`Skipping document with incomplete data: ${doc._id}`);
            continue;
          }

          const newEmbedding = await this.generateEmbedding(doc._source.content);
          await this.client.update({
            index: this.index,
            id: doc._source.id,
            body: {
              doc: {
                embedding: newEmbedding,
                updated_at: new Date().toISOString()
              }
            }
          });
          processed++;
        } catch (error) {
          console.error(`Failed to refresh document ${doc._source?.id || doc._id}:`, error);
          errors++;
        }
      }

      return {
        status: errors === 0 ? 'success' : 'error',
        message: `Processed ${processed} documents with ${errors} errors`,
        processed,
        errors
      };
    } catch (error) {
      console.error('OpenSearch refresh error:', error);
      return {
        status: 'error',
        message: `Refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processed: 0,
        errors: 1
      };
    }
  }
}