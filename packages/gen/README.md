# @skill-tools/gen

Generate [Agent Skills](https://agentskills.io) (SKILL.md) from OpenAPI 3.x specifications or plain text descriptions. Outputs spec-compliant files ready for validation with `skill-tools`.

## Install

```bash
npm install -g @skill-tools/gen
```

## CLI Usage

```bash
# Generate from an OpenAPI spec (unified mode -- one SKILL.md)
skillgen openapi ./petstore.yaml

# Generate per-endpoint skills
skillgen openapi ./petstore.yaml --mode per-endpoint

# Generate from a text description
skillgen text --name deploy-vercel --description "Deploy to Vercel"

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
import { generateFromOpenAPI, generateFromText } from '@skill-tools/gen';

// From OpenAPI spec
const result = await generateFromOpenAPI('./petstore.yaml', {
  mode: 'unified',
});

// From text description
const result = generateFromText({
  name: 'deploy-vercel',
  description: 'Deploy applications to Vercel',
  instructions: 'Run `vercel deploy` in the project root.',
});

// result.files is a Map<string, string> of path -> content
for (const [path, content] of result.files) {
  console.log(path, content);
}
```

## License

Apache-2.0
