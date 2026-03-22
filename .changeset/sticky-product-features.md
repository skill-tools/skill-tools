---
"skill-tools": minor
"@skill-tools/gen": minor
---

Add route, watch, gen quality-gate, hooks, and SARIF support

**skill-tools:**
- `skill-tools route` — BM25 skill routing via CLI (query, conflicts, snapshot save/load)
- `skill-tools watch` — Live validate+lint+score on SKILL.md file changes
- `skill-tools hook install` — Git pre-commit hook for staged SKILL.md files
- `skill-tools check --format sarif` — SARIF 2.1.0 output for GitHub Code Scanning
- `action/action.yml` — GitHub Action for CI integration
- `benchmarkRepository()` / `benchmarkRepositories()` — Batch ecosystem benchmarking
- `normalizeSkillsShEntries()` — Leaderboard normalization utilities

**@skill-tools/gen:**
- `--check` and `--min-score` flags on all generation commands
- `skillgen improve` — Analyze existing skills and suggest improvements
- `checkGeneratedFiles()` — Quality-gate generated files before writing
- `analyzeSkill()` — Prioritized improvement suggestions
