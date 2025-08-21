// Shared request/response types for the API
export interface EmbedRequest {
  appId: string;               // Application identifier (e.g., redmine, mediawiki)
  documentId: string;          // The application's document id
  owner?: string;              // Owner or namespace for multi-tenant separation
  content: string;             // Raw textual content to embed
  metadata?: Record<string, any>; // Additional metadata (tags, permissions, etc.)
}

export interface EmbedResponse {
  id: string;                  // Internal RASS embedding id
  appId: string;
  documentId: string;
  vectorDimension: number;
  status: 'embedded';
  createdAt: string;
}

export interface SearchRequest {
  appId: string;
  query: string;
  topK?: number;
  owner?: string;
  filters?: Record<string, any>;
}

export interface SearchHit {
  id: string;
  documentId: string;
  score: number;
  snippet?: string;
  metadata?: Record<string, any>;
}

export interface SearchResponse {
  appId: string;
  query: string;
  topK: number;
  hits: SearchHit[];
  tookMs: number;
}

export interface EmbeddedDocument {
  id: string;
  appId: string;
  documentId: string;
  owner?: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface RefreshRequest {
  appId: string;
}

export interface IRassBackend {
  embed(request: EmbedRequest): Promise<EmbedResponse>;
  search(request: SearchRequest): Promise<SearchResponse>;
  getItem(id: string): Promise<EmbeddedDocument | undefined>;
  refresh(request: RefreshRequest): Promise<{ status: string }>;
}
