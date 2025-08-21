import dotenv from 'dotenv';
dotenv.config();

export interface RassConfig {
  backend: 'simulated' | 'opensearch';
  apiKey?: string;
  opensearchNode: string;
  vectorDim: number;
  port: number;
}

export const config: RassConfig = {
  backend: (process.env.RASS_BACKEND as 'simulated' | 'opensearch') || 'simulated',
  apiKey: process.env.RASS_API_KEY,
  opensearchNode: process.env.OPENSEARCH_NODE || 'http://localhost:9200',
  vectorDim: parseInt(process.env.RASS_VECTOR_DIM || '16', 10),
  port: parseInt(process.env.PORT || '3000', 10)
};
