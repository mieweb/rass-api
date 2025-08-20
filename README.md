# rass-api
Reference Specification & Implementation for the RASS Server

This repository now contains a minimal Fastify-based implementation of the RASS (Retrieval Abstraction Semantic Service) API with a pluggable backend architecture. Two backends are included:

1. Simulated backend (deterministic in‑memory mock)
2. OpenSearch backend (real vector index & kNN search)

> Phase 2 (future) will introduce pluggable client libraries mimicking familiar SDKs (S3, MariaDB, OpenSearch, MongoDB). Not implemented yet.

## Features

- Backend abstraction via `IRassBackend` interface
- Swap backends using `RASS_BACKEND=simulated|opensearch`
- Endpoints: `POST /embed`, `POST /search`, `GET /item/:id`, `POST /refresh`, `GET /health`
- OpenAPI/Swagger served at `/docs`
- Deterministic mock embeddings for repeatable testing
- OpenSearch integration (index-per-application pattern `rass-<appId>`, kNN vector field)
- Basic API key auth via `x-api-key` header (optional)
- Docker Compose for local OpenSearch + API

## Quick Start (Simulated Mode)

```bash
git clone <this-repo>
cd rass-api
cp .env.example .env  # (optional) edit values
npm install
npm run dev
```

Visit: http://localhost:3000/docs

Example curl (omit x-api-key header if auth disabled):
```bash
curl -X POST http://localhost:3000/embed \
  -H 'content-type: application/json' \
  -d '{"appId":"mediawiki","documentId":"Doc1","content":"Hello semantic world"}'

curl -X POST http://localhost:3000/search \
  -H 'content-type: application/json' \
  -d '{"appId":"mediawiki","query":"semantic"}'
```

## OpenSearch Mode (Docker Compose)

```bash
docker compose up --build
```

Wait until OpenSearch is healthy, then open http://localhost:3000/docs

Environment overrides (in compose already):
```
RASS_BACKEND=opensearch
OPENSEARCH_NODE=http://opensearch:9200
RASS_VECTOR_DIM=16
RASS_API_KEY=changeme
```

### Manual OpenSearch Run (without docker compose for API)

1. Start OpenSearch (Docker):
   ```bash
   docker run -p 9200:9200 -p 9600:9600 --name os-dev \
     -e discovery.type=single-node -e plugins.security.disabled=true \
     -e OPENSEARCH_JAVA_OPTS='-Xms512m -Xmx512m' \
     opensearchproject/opensearch:2.13.0
   ```
2. In another shell:
   ```bash
   RASS_BACKEND=opensearch OPENSEARCH_NODE=http://localhost:9200 \
   RASS_API_KEY=changeme npm run dev
   ```

## API Authentication

If `RASS_API_KEY` is set, every request must include header:
```
x-api-key: <value>
```
Unset the env var to disable auth (development only).

## Backend Abstraction

`IRassBackend` defines:

```ts
embed(request: EmbedRequest): Promise<EmbedResponse>;
search(request: SearchRequest): Promise<SearchResponse>;
getItem(id: string): Promise<EmbeddedDocument | undefined>;
refresh(request: RefreshRequest): Promise<{ status: string }>;
```

Add new backends by implementing this interface; register in `server.ts` switch on `RASS_BACKEND`.

## Data / Index Strategy

- One OpenSearch index per `appId`: `rass-<appId>`
- Mappings include `embedding` (`knn_vector`) & metadata object
- Deterministic hashing currently used in lieu of a true embedding model (replaceable later). This still exercises kNN query path.

### Owner Filtering

Both backends accept an optional `owner` field in `EmbedRequest` and `SearchRequest`.

Use cases:
- Multi-tenant deployments where `appId` is a product and `owner` is a tenant / user / project
- Permission scoping (phase 1: simple equality filter)

Behavior:
- If `owner` is supplied on embed, it's stored with the vector.
- If `owner` is supplied on search, results are restricted to documents with the same owner.

Example:
```bash
curl -X POST http://localhost:3000/search \
  -H 'content-type: application/json' \
  -d '{"appId":"mediawiki","query":"semantic","owner":"tenantA"}'
```

## OpenAPI & Client Generation

The spec lives in `openapi.yaml` and is also loaded by the server. Generate clients with your preferred tool, e.g.:

```bash
npx openapi-typescript-codegen --input openapi.yaml --output clients/typescript
```

Or (Python):
```bash
openapi-generator generate -i openapi.yaml -g python -o clients/python
```

## Future Roadmap (Not Implemented Yet)

- Pluggable true embedding providers (OpenAI, local models)
- Application-specific permission enforcement / ACL filters
- Streaming & re-ranking pipeline (Recommendation Engine placeholder)
- Client SDKs mimicking S3, pgvector, MongoDB, etc.
- Batch ingest & delete endpoints

## Development Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start TS server with live reload |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled JS |
| `npm run typecheck` | Strict TypeScript check |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RASS_BACKEND` | simulated | Backend type (simulated|opensearch) |
| `OPENSEARCH_NODE` | http://localhost:9200 | OpenSearch endpoint |
| `RASS_API_KEY` | (unset) | API key to require header auth |
| `RASS_VECTOR_DIM` | 16 | Vector dimension for deterministic embedding |
| `PORT` | 3000 | Server port |

## Testing the Flow (Simulated)

1. Embed 2 docs with different content.
2. Search with a query word present in one doc more semantically; deterministic vectors will bias toward similar token distribution via hashing.

## Philosophy (Recap)

The RASS philosophy centers on decoupling document storage from advanced semantic search, allowing organizations to maintain full control over their original data while enabling powerful, context-aware retrieval capabilities. Traditional search systems often require applications to tightly integrate with specific storage engines or indexing strategies, leading to complexity, vendor lock-in, and challenges in scaling or evolving the underlying architecture. By introducing a minimalistic, API-driven layer that handles vectorization and semantic search independently of the application’s own storage, RASS empowers teams to innovate and adapt without sacrificing data ownership or flexibility. This approach is essential for organizations that need to support diverse applications, future-proof their infrastructure, and deliver fast, relevant search experiences without being constrained by the limitations of any single backend technology.

## Original Design Diagrams & Narrative

The following architectural description and diagrams illustrate the conceptual model.

The RASS philosophy centers on decoupling document storage from advanced semantic search, allowing organizations to maintain full control over their original data while enabling powerful, context-aware retrieval capabilities. Traditional search systems often require applications to tightly integrate with specific storage engines or indexing strategies, leading to complexity, vendor lock-in, and challenges in scaling or evolving the underlying architecture. By introducing a minimalistic, API-driven layer that handles vectorization and semantic search independently of the application’s own storage, RASS empowers teams to innovate and adapt without sacrificing data ownership or flexibility. This approach is essential for organizations that need to support diverse applications, future-proof their infrastructure, and deliver fast, relevant search experiences without being constrained by the limitations of any single backend technology.

The RASS philosophy is best illustrated by the relationship between a CEO, their executive assistant, and the company’s official records room. In this model, the company’s records room serves as the canonical source of truth, where all important documents are securely stored and maintained. The executive assistant, meanwhile, creates their own working copies or detailed notes about these documents, organizing them in a way that enables rapid, context-aware retrieval—even when the CEO’s request is vague or based on partial information. When the CEO needs a specific proposal or report, the assistant quickly identifies the most relevant information using their own system, but always references the official records room to ensure accuracy and up-to-date content. This approach mirrors how RASS decouples document storage from semantic search: the application retains full control and ownership of the original data, while the RASS server maintains its own optimized representations for fast, intelligent retrieval. This dual-system philosophy is essential for organizations that want to preserve data integrity and flexibility, while still benefiting from the latest advances in semantic search and retrieval.

```mermaid
flowchart TD

  %% ======================
  %% Document Storage Flow
  %% ======================
  subgraph Storage_Flow["📥 Document Storage Flow"]
    CEO1["👤 CEO (User)"]
    App1["📦 Application<br/>(Redmine, MediaWiki, etc.)"]
    RAS1["🧠 RASS API Server"]
    Backend1["💾 Embedding Store<br/>(e.g., OpenSearch, pgvector)"]

    CEO1 -- "Submit Document" --> App1
    App1 -- "Store Document API Call" --> RAS1
    RAS1 -- "Store & Vectorize Document" --> Backend1
  end

  %% =================
  %% Query Flow
  %% =================
  subgraph Query_Flow["🔍 Query Flow"]
    CEO2["👤 CEO (User)"]
    App2["📦 Application"]
    RAS2["🧠 RASS API Server"]
    Backend2["💾 Embedding Store<br/>(e.g., OpenSearch, pgvector)"]
    RecEngine["⚙️ Recommendation Engine<br/>(optional ML feedback)"]

    CEO2 -- "Submit Query" --> App2
    App2 -- "Query API Call" --> RAS2
    RAS2 -- "Semantic / Keyword Search" --> Backend2
    RAS2 -- "Performance Feedback" --> RecEngine
    RecEngine -- "Recommendations (e.g., re-rank, re-query)" --> RAS2
    RAS2 -- "Search Results" --> App2
    App2 -- "Results Display" --> CEO2
  end
```


## Diagram


In the RASS architecture, document storage is designed to ensure both data integrity and efficient semantic retrieval. When a user submits a document through an application—such as Redmine or MediaWiki—the application first stores the original document in its own dedicated storage system, maintaining full control and ownership of the source data. Simultaneously, the application sends the document to the RASS API server, which processes and vectorizes the content, storing the resulting embeddings in a specialized embedding store. This dual-storage approach allows the application to remain the authoritative source of truth for documents, while enabling the RASS system to perform rapid, context-aware searches using advanced semantic techniques. This setup lays the foundation for the subsequent query process, where users will be able to retrieve relevant documents through natural language queries, leveraging the power of both the application’s storage and the RASS embedding store.


```mermaid
sequenceDiagram
    participant CEO as 👤 CEO (User)
    participant App as 📦 Application
    participant AppStore as 🗄️ App's Own Store
    participant RAS as 🧠 RASS API Server
    participant Backend as 💾 Embedding Store
    participant Rec as ⚙️ Recommendation Engine

    %% --- Document Storage Flow ---
    CEO->>App: Submit Document
    App->>AppStore: Store Document
    App->>RAS: Store Document API Call
    RAS->>Backend: Store & Vectorize Document
```

The following diagram illustrates the query process within the RASS architecture. When a user initiates a search through the application, the request is routed to the RASS API server, which leverages its embedding store to perform a semantic or keyword-based search. The results are then returned to the application for display to the user. After the response is delivered, the RASS server evaluates the performance of the query and may generate recommendations to further optimize future searches. This flow ensures that users receive relevant results quickly, while the system continuously improves its retrieval capabilities in the background.
```mermaid
sequenceDiagram
    participant CEO as 👤 CEO (User)
    participant App as 📦 Application
    participant AppStore as 🗄️ App's Own Store
    participant RAS as 🧠 RASS API Server
    participant Backend as 💾 Embedding Store
    participant Rec as ⚙️ Recommendation Engine

    %% --- Query Flow ---
    CEO->>App: Submit Query
    App->>RAS: Query API Call
    RAS->>Backend: Semantic / Keyword Search
    RAS->>App: Search Results
    App->>CEO: Results Display
    RAS->>Rec: Performance Feedback
    Rec->>RAS: Recommendations (e.g., re-rank, re-query)
```
