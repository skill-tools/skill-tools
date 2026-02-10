# @skill-tools/core

Core parser, types, and utilities for [Agent Skills](https://agentskills.io) (SKILL.md).

This is the foundation package that all other `@skill-tools` packages depend on.

## Install

```bash
npm install @skill-tools/core
```

## Usage

```typescript
import { parseSkill, resolveSkillFiles, countTokens } from '@skill-tools/core';

// Discover all SKILL.md files in a directory
const locations = await resolveSkillFiles('./skills/');

// Parse a single SKILL.md file
const result = await parseSkill(locations[0].skillFile);
if (result.ok) {
  console.log(result.skill.metadata.name);
  console.log(result.skill.metadata.description);
  console.log(result.skill.sections);
}

// Parse raw content without file I/O
import { parseSkillContent } from '@skill-tools/core';
const parsed = parseSkillContent(markdownString, 'path/SKILL.md', 'path/');

// Count tokens (cl100k_base encoding)
const tokens = countTokens('Hello, world!');
```

## API

| Export | Description |
|--------|-------------|
| `parseSkill(path)` | Parse a SKILL.md file from disk |
| `parseSkillContent(content, filePath, dirPath)` | Parse SKILL.md from a string |
| `resolveSkillFiles(dir)` | Find all SKILL.md files in a directory tree |
| `countTokens(text)` | Count tokens using tiktoken (cl100k_base) |

## Types

All types are exported: `Skill`, `SkillMetadata`, `SkillSection`, `SkillFileReference`, `Diagnostic`, `ParseResult`, `QualityScore`, `DimensionScore`, `ScoreSuggestion`.

## License

Apache-2.0
