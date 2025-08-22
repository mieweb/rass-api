// Core RASS types and interfaces

export interface EmbedRequest {
  id: string;
  content: string;
  metadata?: {
    title?: string;
    source?: string;
    application?: 'redmine' | 'mediawiki' | 'rocketchat';
    owner?: string;
    created_at?: string;
    updated_at?: string;
    author?: string;
  url?: string;
  [key: string]: any;
  };
}

export interface EmbedResponse {
  id: string;
  status: 'success' | 'error';
  message?: string;
  embedding?: number[];
}

export interface SearchRequest {
  query: string;
  filters?: {
    application?: string;
    source?: string;
    author?: string;
    owner?: string;
    date_range?: {
      start?: string;
      end?: string;
  };
  [key: string]: any;
  };
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
  highlights?: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  offset: number;
  limit: number;
  query: string;
}

export interface EmbeddedDocument {
  id: string;
  content: string;
  metadata: Record<string, any> & { owner?: string };
  embedding?: number[];
  created_at: string;
  updated_at: string;
}

export interface RefreshRequest {
  application?: string;
  source?: string;
  force?: boolean;
}

export interface RefreshResponse {
  status: 'success' | 'error';
  message?: string;
  processed?: number;
  errors?: number;
}

// Backend interface that all implementations must follow
export interface IRassBackend {
  embed(request: EmbedRequest): Promise<EmbedResponse>;
  search(request: SearchRequest): Promise<SearchResponse>;
  getItem(id: string): Promise<EmbeddedDocument>;
  refresh(request: RefreshRequest): Promise<RefreshResponse>;
}

// Configuration types
export interface RassConfig {
  backend: 'simulated' | 'opensearch';
  opensearch?: {
    url: string;
    username?: string;
    password?: string;
    index: string;
  };
  auth?: {
    enabled: boolean;
    apiKey?: string;
  };
  server?: {
    host: string;
    port: number;
  };
}