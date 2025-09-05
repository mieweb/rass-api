import { RassConfig } from '../types/index.js';

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): RassConfig {
  const config: RassConfig = {
    backend: (process.env.RASS_BACKEND as 'simulated' | 'opensearch') || 'simulated',
    server: {
      host: process.env.HOST || 'localhost',
      port: parseInt(process.env.PORT || '3000')
    }
  };

  // OpenSearch configuration
  if (config.backend === 'opensearch') {
    config.opensearch = {
      url: process.env.OPENSEARCH_URL || 'http://localhost:9200',
      username: process.env.OPENSEARCH_USERNAME,
      password: process.env.OPENSEARCH_PASSWORD,
      index: process.env.OPENSEARCH_INDEX || 'rass-documents'
    };
  }

  // Authentication configuration
  const authEnabled = process.env.AUTH_ENABLED === 'true';
  if (authEnabled) {
    config.auth = {
      enabled: true,
      apiKey: process.env.API_KEY
    };

    if (!config.auth.apiKey) {
      throw new Error('API_KEY environment variable is required when AUTH_ENABLED=true');
    }
  } else {
    config.auth = {
      enabled: false
    };
  }

  return config;
}

/**
 * Validate configuration
 */
export function validateConfig(config: RassConfig): void {
  if (config.backend === 'opensearch') {
    if (!config.opensearch?.url) {
      throw new Error('OPENSEARCH_URL is required when using opensearch backend');
    }
  }

  if (config.auth?.enabled && !config.auth.apiKey) {
    throw new Error('API key is required when authentication is enabled');
  }
}