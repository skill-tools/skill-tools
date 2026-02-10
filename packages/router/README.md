# @skill-tools/router

Skill selection middleware for [Agent Skills](https://agentskills.io). Uses **BM25** (Okapi BM25) to rank and route natural-language queries to the right skills from large catalogs. Zero external dependencies — no API keys or model downloads.

## Install

```bash
npm install @skill-tools/router
```

## Quick Start

```typescript
import { SkillRouter } from '@skill-tools/router';

const router = new SkillRouter();

await router.indexSkills([
  { name: 'deploy-vercel', description: 'Deploy apps to Vercel production...' },
  { name: 'run-tests', description: 'Execute unit and integration tests...' },
  { name: 'lint-code', description: 'Run ESLint or Biome to check code style...' },
]);

const results = await router.select('deploy my app to production');
// [{ skill: 'deploy-vercel', score: 1.0, metadata: { ... } }]
```

## Features

- **BM25 full-text search** — fast inverted-index scoring, no API keys needed
- **Pluggable embedding providers** — bring your own OpenAI, Cohere, or custom embeddings
- **Pluggable vector stores** — in-memory store included, add your own for persistence
- **Conflict detection** — find overlapping skills in your catalog
- **Snapshot persistence** — save/load indexes for instant startup
- **Boost & exclude** — fine-tune results per query

## API

| Export | Description |
|--------|-------------|
| `SkillRouter` | Main router — `indexSkills()`, `select()`, `detectConflicts()`, `save()`/`load()` |
| `BM25Index` | Standalone BM25 engine (used internally, also exported for direct use) |
| `LocalEmbeddingProvider` | TF-IDF embedding provider (legacy, for custom vector store workflows) |
| `MemoryVectorStore` | In-memory cosine-similarity vector store |

## BM25 Parameters

```typescript
const router = new SkillRouter({
  bm25: { k1: 1.2, b: 0.75 }, // defaults — tune for your catalog
});
```

| Param | Default | Effect |
|-------|---------|--------|
| `k1` | 1.2 | Term frequency saturation — higher = more weight on repeated terms |
| `b` | 0.75 | Length normalization — 0 = ignore doc length, 1 = fully normalize |

## License

Apache-2.0
