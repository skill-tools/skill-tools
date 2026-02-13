# @skill-tools/core

## 0.2.2

### Patch Changes

- [#5](https://github.com/skill-tools/skill-tools/pull/5) [`9b02379`](https://github.com/skill-tools/skill-tools/commit/9b02379bb7c49a305c552e269eb00fd2b4a7bb71) Thanks [@pyyush](https://github.com/pyyush)! - Add init and to-prompt CLI commands, name-matches-directory validation, compatibility/license field validation, description-length-optimal lint rule

## 0.2.1

### Patch Changes

- [`5d047cf`](https://github.com/skill-tools/skill-tools/commit/5d047cfac256027120afb978c66313aaf2636eb4) - Redesign CLI output formatting and improve lint diagnostics

## 0.2.0

### Minor Changes

- [#1](https://github.com/skill-tools/skill-tools/pull/1) [`3c1b70d`](https://github.com/skill-tools/skill-tools/commit/3c1b70de6739acc7f5c3d29350f472edbcfb4346) Thanks [@pyyush](https://github.com/pyyush)! - Add contextual BM25 retrieval to @skill-tools/router. Context terms (name parts, section headings, inline code refs) are extracted from skill body and prepended to the description before indexing, improving recall for domain-specific queries. Max 80 context tokens, deduped against description. Disable with `context: false`. Backward-compatible — skills without body/sections behave identically to v0.1.
