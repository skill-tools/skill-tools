# skill-tools

CLI tool and library for validating, linting, and quality-scoring [Agent Skills](https://agentskills.io) (SKILL.md) files. The ESLint/Lighthouse equivalent for agent skills.

## Install

```bash
npm install -g skill-tools
```

## Commands

```bash
# Validate against the Agent Skills specification
skill-tools validate ./my-skill/

# Lint for quality issues
skill-tools lint ./my-skill/

# Score 0-100 across 5 dimensions
skill-tools score ./my-skill/

# All three in one pass (ideal for CI)
skill-tools check ./my-skill/
```

## Lint Rules

| Rule | Default | Description |
|------|---------|-------------|
| `description-specificity` | warn | No generic verbs ("manage", "handle") |
| `description-trigger-keywords` | warn | Has action verbs or "Use when..." |
| `progressive-disclosure` | warn | Large files use `references/` |
| `no-hardcoded-paths` | error | No `/Users/...` or `C:\` paths |
| `no-secrets` | error | No API keys, tokens, private keys |
| `instructions-has-examples` | info | Has code blocks or numbered steps |
| `instructions-has-error-handling` | info | Mentions error handling |
| `consistent-headings` | info | No skipping heading levels |

## Score Dimensions

| Dimension | Points | Key Factors |
|-----------|--------|-------------|
| Description Quality | 30 | Length, specificity, trigger context |
| Instruction Clarity | 25 | Code blocks, steps, error handling |
| Spec Compliance | 20 | Name, description, tokens, lines |
| Progressive Disclosure | 15 | File size, use of references/scripts |
| Security | 10 | No secrets, no hardcoded paths |

## Library API

```typescript
import { validate, lint, score } from 'skill-tools';

const results = await validate('./my-skill/');
const lintResult = lint(parsedSkill);
const qualityScore = score(parsedSkill);
```

## License

Apache-2.0
