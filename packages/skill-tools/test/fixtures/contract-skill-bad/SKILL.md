---
name: contract-skill-bad
description: A browser-agent skill fixture with intentionally incomplete contract declarations.
allowed-tools: navigate, eval
contract:
  kind: browser-agent
  version: 1
  runtime:
    tools:
      - navigate
      - observe
    actionClasses:
      - purchase
      - delete
  provenance:
    formats:
      - trace-ndjson
    replay:
      supported: true
      determinism: strict
  grounding:
    observation:
      models:
        - interactive-elements
    identity:
      mechanisms:
        - stable-ref
---

# Contract Skill Bad

Use this fixture for contract warning tests.
