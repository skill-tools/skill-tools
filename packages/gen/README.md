# @skill-tools/gen

Generate [Agent Skills](https://agentskills.io) (SKILL.md) from OpenAPI 3.x specifications or plain text descriptions. Outputs spec-compliant files ready for validation with `skill-tools`.

## Install

```bash
npm install -g @skill-tools/gen
```

## CLI Usage

```bash
# Generate from an OpenAPI spec (unified mode — one SKILL.md)
skillgen openapi ./petstore.yaml

# Generate per-endpoint skills
skillgen openapi ./petstore.yaml --mode per-endpoint

# Generate from a text description
skillgen from-text deploy-vercel "Deploy to Vercel"

# Custom output directory
skillgen openapi ./api.json -o ./skills/
```

## Modes

| Mode | Description |
|------|-------------|
| `unified` | Single SKILL.md covering all endpoints (default) |
| `per-endpoint` | One SKILL.md per endpoint |

## Programmatic API

```typescript
import { generateFromOpenApi, generateFromText } from '@skill-tools/gen';

// From OpenAPI spec file
const result = await generateFromOpenApi('./petstore.yaml', {
  mode: 'unified',
});

// From text description
const text = generateFromText(
  'deploy-vercel',
  'Deploy applications to Vercel',
  'Run `vercel deploy` in the project root.',
);

// result.files is a Map<string, string> of path → content
if (result.ok) {
  for (const [path, content] of result.files) {
    console.log(path, content);
  }
}
```

## License

Apache-2.0
