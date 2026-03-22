<p align="center">
  <img src="banner.svg" alt="skill-tools" width="600">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/skill-tools"><img src="https://img.shields.io/npm/v/skill-tools" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License"></a>
  <a href="https://www.npmjs.com/package/skill-tools"><img src="https://img.shields.io/node/v/skill-tools" alt="Node"></a>
</p>

<p align="center">
  <strong>The quality toolkit for Agent Skills.</strong><br>
  Validate, lint, score, route, watch, and generate SKILL.md files.
</p>

---

[Agent Skills](https://agentskills.io) (`SKILL.md`) are a vendor-neutral format for packaging AI agent capabilities — like `package.json` for what an agent can do. **skill-tools** is the ESLint + Lighthouse for that format.

## Why skill-tools?

- **20 spec checks** catch structural issues before deployment
- **10 lint rules** enforce quality (no secrets, no hardcoded paths, specific descriptions)
- **0-100 quality score** across 5 dimensions gives objective, comparable skill quality
- **BM25 routing** matches user queries to the right skill at runtime
- **Generate from OpenAPI/MCP** and quality-gate before writing
- **Watch mode, pre-commit hooks, GitHub Action, SARIF** — fits into every workflow

## Quick Start

```bash
npx skill-tools check ./my-skill/
```

```
  deploy-vercel  PASS
  ──────────────────────────────────────────────────
  ✓  File is readable
  ✓  Valid YAML frontmatter
  ✓  Has name field
  ✓  Name format is valid
  ✓  Has description field
  ✓  Has markdown body
  ✓  Within token budget
  ...
  20 checks  │  20 passed

  ✓  Description uses specific verbs
  ✓  No hardcoded paths
  ✓  No embedded secrets
  ✓  Instructions include examples
  ...
  10 rules  │  10 passed

  Quality Score  90/100  ★★★★★
  ──────────────────────────────────────────────────
  Description Quality       ████████░░  24/30
  Instruction Clarity       ████████░░  21/25
  Spec Compliance           ██████████  20/20
  Progressive Disclosure    ██████████  15/15
  Security                  ██████████  10/10
```

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| [`skill-tools`](packages/skill-tools) | CLI: validate, lint, score, check, route, watch, hook | `npm i -g skill-tools` |
| [`@skill-tools/gen`](packages/gen) | Generate SKILL.md from OpenAPI, MCP, or text | `npm i -g @skill-tools/gen` |
| [`@skill-tools/router`](packages/router) | BM25 skill routing (zero deps) | `npm i @skill-tools/router` |
| [`@skill-tools/core`](packages/core) | Parser, types, tokenizer | `npm i @skill-tools/core` |

## What's a SKILL.md?

```markdown
---
name: deploy-vercel
description: >-
  Deploy web applications to Vercel. Use when the user wants to
  deploy, publish, or ship a Next.js or React app.
---

# Deploy to Vercel

## Steps

1. Run `vercel deploy` in the project root
2. Confirm the deployment URL

## Error Handling

- If deploy fails: check `vercel logs` for details
```

## Ecosystem

- **[GitHub Action](action/action.yml)** — Run `skill-tools check` in CI
- **[agentskills.io](https://agentskills.io)** — The Agent Skills specification
- **[skills.menu](https://skills.menu)** — Documentation and playground

## Development

```bash
pnpm install && pnpm build && pnpm test
```

Requires Node.js >= 18 and pnpm >= 9.

## License

Apache-2.0
