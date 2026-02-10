# skill-tools

Validation, routing, and generation tooling for [Agent Skills](https://agentskills.io) (SKILL.md).

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`@skill-tools/core`](packages/core) | `npm i @skill-tools/core` | Parser, types, tokenizer, file resolver |
| [`skill-tools`](packages/skill-tools) | `npm i -g skill-tools` | CLI — validate, lint, score |
| [`@skill-tools/router`](packages/router) | `npm i @skill-tools/router` | Semantic skill selection (TF-IDF + cosine similarity) |
| [`@skill-tools/gen`](packages/gen) | `npm i @skill-tools/gen` | Generate SKILL.md from OpenAPI specs or text |

## Quick Start

```bash
# Install the CLI
npm install -g skill-tools

# Validate a skill
skill-tools validate ./my-skill/

# Lint for quality issues
skill-tools lint ./my-skill/

# Score 0-100 across 5 dimensions
skill-tools score ./my-skill/

# All three in one pass (ideal for CI)
skill-tools check ./my-skill/
```

## Programmatic Usage

```typescript
import { parseSkill, resolveSkillFiles } from '@skill-tools/core';

const files = await resolveSkillFiles('./skills/');
for (const file of files) {
  const result = parseSkill(file);
  if (result.ok) {
    console.log(result.data.metadata.name);
  }
}
```

## Development

```bash
pnpm install        # Install dependencies
pnpm build          # Build all packages
pnpm test           # Run all 114 tests
pnpm check          # lint + typecheck + test
```

Requires Node.js >= 18 and pnpm >= 9.

## What are Agent Skills?

Agent Skills are a portable, vendor-neutral format for packaging AI agent capabilities as `SKILL.md` files. See the [specification](https://agentskills.io/specification) and [skills.menu](https://skills.menu) for details.

## License

Apache-2.0
