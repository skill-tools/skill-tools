# @skill-tools/core

Core parser, types, and utilities for [Agent Skills](https://agentskills.io) (SKILL.md).

This is the foundation package that all other `@skill-tools` packages depend on.

## Install

```bash
npm install @skill-tools/core
```

## Usage

```typescript
import { parseSkill, resolveSkillFiles } from '@skill-tools/core';

// Parse a single SKILL.md file
const result = parseSkill('./my-skill/SKILL.md');
if (result.ok) {
  console.log(result.data.metadata.name);
  console.log(result.data.metadata.description);
  console.log(result.data.body);
}

// Discover all SKILL.md files in a directory
const files = await resolveSkillFiles('./skills/');

// Parse raw content without file I/O
import { parseSkillContent } from '@skill-tools/core';
const skill = parseSkillContent(markdownString, 'virtual.md');

// Count tokens
import { countTokens } from '@skill-tools/core';
const tokens = countTokens(skill.body);
```

## API

| Export | Description |
|--------|-------------|
| `parseSkill(path)` | Parse a SKILL.md file from disk |
| `parseSkillContent(content, path)` | Parse SKILL.md from a string |
| `resolveSkillFiles(dir)` | Find all SKILL.md files in a directory tree |
| `countTokens(text)` | Count tokens using tiktoken (cl100k_base) |

## Types

All types are exported: `Skill`, `SkillMetadata`, `SkillSection`, `SkillFileReference`, `Diagnostic`, `ParseResult`, `QualityScore`, `DimensionScore`, `ScoreSuggestion`.

## License

Apache-2.0
