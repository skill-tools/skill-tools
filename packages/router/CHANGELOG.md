# @skill-tools/router

## 0.2.0

### Minor Changes

- [#1](https://github.com/skill-tools/skill-tools/pull/1) [`3c1b70d`](https://github.com/skill-tools/skill-tools/commit/3c1b70de6739acc7f5c3d29350f472edbcfb4346) Thanks [@pyyush](https://github.com/pyyush)! - Add contextual BM25 retrieval to @skill-tools/router. Context terms (name parts, section headings, inline code refs) are extracted from skill body and prepended to the description before indexing, improving recall for domain-specific queries. Max 80 context tokens, deduped against description. Disable with `context: false`. Backward-compatible — skills without body/sections behave identically to v0.1.

### Patch Changes

- Updated dependencies [[`3c1b70d`](https://github.com/skill-tools/skill-tools/commit/3c1b70de6739acc7f5c3d29350f472edbcfb4346)]:
  - @skill-tools/core@0.2.0
