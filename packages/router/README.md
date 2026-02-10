# @skill-tools/router

Semantic skill selection for [Agent Skills](https://agentskills.io). Uses TF-IDF embeddings and cosine similarity to route natural language queries to the right skills from large catalogs. Zero external dependencies.

## Install

```bash
npm install @skill-tools/router
```

## Quick Start

```typescript
import { SkillRouter } from '@skill-tools/router';

const router = new SkillRouter();

// Index skills from a directory
await router.indexDirectory('./skills/');

// Route a query to the best matching skills
const matches = await router.route('deploy my app to production');
// [{ name: 'deploy-vercel', score: 0.87, description: '...' }, ...]
```

## Features

- **Built-in TF-IDF embeddings** -- no API keys or external services needed
- **Pluggable embedding providers** -- bring your own OpenAI, Cohere, or custom embeddings
- **Pluggable vector stores** -- in-memory store included, add your own for persistence
- **Cosine similarity ranking** -- fast, accurate skill matching
- **Duplicate detection** -- find overlapping skills in your catalog

## API

| Export | Description |
|--------|-------------|
| `SkillRouter` | Main router class with `indexDirectory()`, `route()`, `findDuplicates()` |
| `LocalEmbedding` | Built-in TF-IDF embedding provider |
| `MemoryStore` | In-memory vector store |

## License

Apache-2.0
