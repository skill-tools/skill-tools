# skill-tools

<p>
  <a href="https://www.npmjs.com/package/skill-tools"><img src="https://img.shields.io/npm/v/skill-tools" alt="npm"></a>
  <a href="https://www.npmjs.com/package/skill-tools"><img src="https://img.shields.io/npm/dm/skill-tools" alt="downloads"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License"></a>
</p>

**The ESLint + Lighthouse for Agent Skills.** Validate, lint, and score [SKILL.md](https://agentskills.io) files. 20 spec checks, 10 lint rules, 0-100 quality scoring.

## Try it now

```bash
npx skill-tools check ./my-skill/
```

## Getting Started

```bash
# 1. Install
npm install -g skill-tools

# 2. Scaffold a skill
skill-tools init my-first-skill

# 3. Check it
skill-tools check ./my-first-skill/
```

Output:

```
  my-first-skill  PASS
  ──────────────────────────────────────────────────
  ✓  File is readable
  ✓  Valid YAML frontmatter
  ✓  Has name field
  ✓  Has description field
  ✓  Has markdown body
  ✓  Within token budget
  ...
  20 checks  │  20 passed

  ✓  Description uses specific verbs
  ✓  No hardcoded paths
  ✓  No embedded secrets
  ...
  10 rules  │  9 passed  │  1 warning

  Quality Score  72/100  ★★★☆☆
  ──────────────────────────────────────────────────
  Description Quality       ██████░░░░  18/30
  Instruction Clarity       ████████░░  21/25
  Spec Compliance           ██████████  20/20
  Progressive Disclosure    ██████████  15/15
  Security                  ██████████  10/10

  Suggestions
  1. Add "Use when..." trigger context to description  +6 pts
  2. Add more specific verbs in description  +4 pts
```

## Commands

### Core

```bash
skill-tools validate <path>   # 20 spec compliance checks
skill-tools lint <path>        # 10 quality rules
skill-tools score <path>       # 0-100 quality score (5 dimensions)
skill-tools check <path>       # All three combined
```

### Routing

```bash
# Find the best skill for a query (BM25 search)
skill-tools route "deploy my app" --skills ./skills/

# Detect conflicting/overlapping skills
skill-tools route --conflicts --skills ./skills/

# Save and load router index snapshots
skill-tools route --index ./skills/ --save snapshot.json
skill-tools route --load snapshot.json "deploy"
```

### Workflow

```bash
# Watch for changes — re-checks on save
skill-tools watch ./skills/

# Scaffold a new skill
skill-tools init deploy-vercel

# Generate prompt XML for agent system prompts
skill-tools to-prompt ./skills/

# Install a git pre-commit hook
skill-tools hook install
```

### CI Integration

```bash
# SARIF output for GitHub Code Scanning
skill-tools check ./skills/ --format sarif > results.sarif

# Exit code 1 on warnings (default: only errors)
skill-tools check ./skills/ --fail-on warning

# Fail if any skill scores below 70
skill-tools check ./skills/ --min-score 70
```

## Lint Rules

| Rule | Default | Description |
|------|---------|-------------|
| `description-specificity` | warn | No generic verbs ("manage", "handle") |
| `description-trigger-keywords` | warn | Has action verbs or "Use when..." |
| `description-length-optimal` | warn | Description length in optimal range |
| `progressive-disclosure` | warn | Large files use `references/` |
| `no-hardcoded-paths` | error | No `/Users/...` or `C:\` paths |
| `no-secrets` | error | No API keys, tokens, private keys |
| `instructions-has-examples` | info | Has code blocks or numbered steps |
| `instructions-has-error-handling` | info | Mentions error handling |
| `consistent-headings` | info | No skipping heading levels |
| `section-count-optimal` | info | Optimal number of sections |

## Score Dimensions

| Dimension | Points | Key Factors |
|-----------|--------|-------------|
| Description Quality | 30 | Length, specificity, trigger context |
| Instruction Clarity | 25 | Code blocks, steps, error handling |
| Spec Compliance | 20 | Name, description, tokens, lines |
| Progressive Disclosure | 15 | File size, use of references/scripts |
| Security | 10 | No secrets, no hardcoded paths |

## GitHub Action

```yaml
- uses: skill-tools/skill-tools/action@v1
  with:
    path: './skills/'
    min-score: '70'
    fail-on: 'warning'
```

Inputs:

| Input | Default | Description |
|-------|---------|-------------|
| `path` | `.` | Path to SKILL.md files or directories |
| `min-score` | `0` | Minimum quality score (0-100) |
| `fail-on` | `error` | Severity threshold: error, warning, info |
| `version` | `0.2.2` | skill-tools version to use |

## Library API

```typescript
import { validate, lint, score, watchSkills, toSarif } from 'skill-tools';

// Validate
const results = await validate('./my-skill/');

// Lint + Score
for (const r of results.filter(r => r.valid)) {
  const lintResult = lint(r.skill);
  const qualityScore = score(r.skill);
  console.log(qualityScore.score); // 0-100
}

// Watch for changes
const handle = watchSkills('./skills/', { debounceMs: 300 },
  (result) => console.log(result.scores),
  (err) => console.error(err),
);

// SARIF for GitHub Code Scanning
const sarif = toSarif(validationResults, lintResults);
```

## See Also

- [`@skill-tools/gen`](../gen) — Generate SKILL.md from OpenAPI, MCP, or text
- [`@skill-tools/router`](../router) — BM25 skill routing library
- [agentskills.io](https://agentskills.io) — The Agent Skills specification
- [skills.menu](https://skills.menu) — Documentation and playground

## License

Apache-2.0
