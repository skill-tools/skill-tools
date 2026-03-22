# @skill-tools/gen

Generate [Agent Skills](https://agentskills.io) (SKILL.md) from OpenAPI 3.x specifications, MCP servers, or plain text descriptions. Outputs spec-compliant files ready for validation with `skill-tools`.

## Install

```bash
npm install -g @skill-tools/gen
```

## Example Output

```bash
$ skillgen from-text deploy-vercel "Deploy web apps to Vercel"
```

Generates `deploy-vercel/SKILL.md`:

```markdown
---
name: deploy-vercel
description: >-
  Deploy web apps to Vercel
---

# deploy-vercel

Deploy web apps to Vercel
```

With `--check`, the generated file is validated before writing:

```bash
$ skillgen from-text deploy-vercel "Deploy web apps to Vercel" --check --min-score 60
  deploy-vercel: 42/100
  Failed: score below minimum threshold (60). Files not written.
```

## CLI Usage

```bash
# Generate from an OpenAPI spec (unified mode — one SKILL.md)
skillgen openapi ./petstore.yaml

# Generate per-endpoint skills
skillgen openapi ./petstore.yaml --mode per-endpoint

# Generate from a text description
skillgen from-text deploy-vercel "Deploy to Vercel"

# Generate from an MCP server
skillgen mcp --command node my-server.js

# Custom output directory
skillgen openapi ./api.json -o ./skills/

# Quality gate — only write files if score meets threshold
skillgen openapi ./api.json --check --min-score 70

# Analyze existing skills and suggest improvements
skillgen improve ./my-skill/
```

## Modes

| Mode | Description |
|------|-------------|
| `unified` | Single SKILL.md covering all endpoints (default) |
| `per-endpoint` | One SKILL.md per endpoint |

## Quality Gate

All generation commands support `--check` and `--min-score`:

```bash
# Generate and validate — don't write if quality is too low
skillgen from-text my-api "My API skill" --check --min-score 60
```

The `improve` command analyzes existing skills and returns prioritized suggestions:

```bash
skillgen improve ./skills/ --format json
```

## Programmatic API

```typescript
import { generateFromOpenApi, generateFromText, checkGeneratedFiles, analyzeSkill } from '@skill-tools/gen';

// From OpenAPI spec file
const result = await generateFromOpenApi('./petstore.yaml', {
  mode: 'unified',
});

// From text description (always succeeds — returns GenerateResult directly)
const textResult = generateFromText(
  'deploy-vercel',
  'Deploy applications to Vercel',
  'Run `vercel deploy` in the project root.',
);
for (const [path, content] of textResult.files) {
  console.log(path, content);
}

// OpenAPI result may fail — check .ok first
if (result.ok) {
  for (const [path, content] of result.files) {
    console.log(path, content);
  }
}

// Quality-check generated files before writing
const check = checkGeneratedFiles(result.files, 70);
if (!check.meetsThreshold) {
  console.log('Quality too low:', check.scores);
}

// Analyze existing skills for improvements
const improvements = await analyzeSkill('./my-skill/');
for (const r of improvements) {
  console.log(r.name, r.currentScore.score, r.suggestions);
}
```

## License

Apache-2.0
