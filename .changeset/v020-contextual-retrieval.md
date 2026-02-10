---
"@skill-tools/core": minor
"skill-tools": minor
"@skill-tools/router": minor
"@skill-tools/gen": minor
---

Add contextual BM25 retrieval to @skill-tools/router. Context terms (name parts, section headings, inline code refs) are extracted from skill body and prepended to the description before indexing, improving recall for domain-specific queries. Max 80 context tokens, deduped against description. Disable with `context: false`. Backward-compatible — skills without body/sections behave identically to v0.1.
