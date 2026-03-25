# skill-tools

## 0.4.0

### Minor Changes

- [#12](https://github.com/skill-tools/skill-tools/pull/12) [`7789694`](https://github.com/skill-tools/skill-tools/commit/77896944b354a30c780f61dc251bf3eeb00ac9eb) Thanks [@pyyush](https://github.com/pyyush)! - Add `skill-tools audit` command for contract schema validation with BAP, DBAR, and UseID adapters. New @skill-tools/contracts package at 0.1.0.

## 0.3.0

### Minor Changes

- [#11](https://github.com/skill-tools/skill-tools/pull/11) [`30a08f1`](https://github.com/skill-tools/skill-tools/commit/30a08f1383fc6ead7920e7bff08932f1194bf7a8) Thanks [@pyyush](https://github.com/pyyush)! - Add route, watch, gen quality-gate, hooks, and SARIF support

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

## 0.2.2

### Patch Changes

- [#5](https://github.com/skill-tools/skill-tools/pull/5) [`9b02379`](https://github.com/skill-tools/skill-tools/commit/9b02379bb7c49a305c552e269eb00fd2b4a7bb71) Thanks [@pyyush](https://github.com/pyyush)! - Add init and to-prompt CLI commands, name-matches-directory validation, compatibility/license field validation, description-length-optimal lint rule

- Updated dependencies [[`9b02379`](https://github.com/skill-tools/skill-tools/commit/9b02379bb7c49a305c552e269eb00fd2b4a7bb71)]:
  - @skill-tools/core@0.2.2

## 0.2.1

### Patch Changes

- [`5d047cf`](https://github.com/skill-tools/skill-tools/commit/5d047cfac256027120afb978c66313aaf2636eb4) - Redesign CLI output formatting and improve lint diagnostics

- Updated dependencies [[`5d047cf`](https://github.com/skill-tools/skill-tools/commit/5d047cfac256027120afb978c66313aaf2636eb4)]:
  - @skill-tools/core@0.2.1

## 0.2.0

### Minor Changes

- [#1](https://github.com/skill-tools/skill-tools/pull/1) [`3c1b70d`](https://github.com/skill-tools/skill-tools/commit/3c1b70de6739acc7f5c3d29350f472edbcfb4346) Thanks [@pyyush](https://github.com/pyyush)! - Add contextual BM25 retrieval to @skill-tools/router. Context terms (name parts, section headings, inline code refs) are extracted from skill body and prepended to the description before indexing, improving recall for domain-specific queries. Max 80 context tokens, deduped against description. Disable with `context: false`. Backward-compatible — skills without body/sections behave identically to v0.1.

### Patch Changes

- Updated dependencies [[`3c1b70d`](https://github.com/skill-tools/skill-tools/commit/3c1b70de6739acc7f5c3d29350f472edbcfb4346)]:
  - @skill-tools/core@0.2.0
