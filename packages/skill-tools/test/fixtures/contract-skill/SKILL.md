---
name: contract-skill
description: A browser-agent skill fixture with a valid contract for validator and audit tests.
allowed-tools: navigate, observe, act, extract, screenshot
contract:
  kind: browser-agent
  version: 1
  runtime:
    interfaces:
      - cli
    tools:
      - navigate
      - observe
      - act
      - extract
      - screenshot
    actionClasses:
      - navigate
      - observe
      - extract
    domainPolicy:
      mode: allowlist
      allow:
        - example.com
    approval:
      policy: manual
      requiredFor:
        - purchase
    artifacts:
      outputs:
        - trace-ndjson
        - screenshot
      sensitivity: moderate
      retention: session
      redaction:
        - cookies
  provenance:
    formats:
      - bap-contract-evidence
      - trace-ndjson
    replay:
      supported: true
      determinism: best-effort
      validator: bap trace --export-evidence
  grounding:
    observation:
      models:
        - interactive-elements
    identity:
      mechanisms:
        - stable-ref
      stableRefs: true
    abstention:
      supported: true
      ambiguityPolicy: abstain
---

# Contract Skill

Use this fixture for contract validation and audit tests.
