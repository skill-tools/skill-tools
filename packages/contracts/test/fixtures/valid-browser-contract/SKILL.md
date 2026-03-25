---
name: browser-auditor
description: Audit browser-agent workflows with a declared contract for runtime permissions, provenance, and grounding behavior.
allowed-tools: navigate, observe, act, extract, screenshot
contract:
  kind: browser-agent
  version: 1
  runtime:
    interfaces:
      - cli
      - mcp
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
        - docs.example.com
    approval:
      policy: manual
      requiredFor:
        - purchase
        - delete
    artifacts:
      outputs:
        - trace-ndjson
        - screenshot
      sensitivity: high
      retention: session
      redaction:
        - headers
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
        - accessibility-tree
      selectorRefs:
        - stable-ref
        - semantic-selector
    identity:
      mechanisms:
        - stable-ref
        - role-name
      stableRefs: true
    abstention:
      supported: true
      reasons:
        - ambiguity
        - below-threshold
      ambiguityPolicy: abstain
---

# Browser Auditor

Use this skill when you need contract-aware browser automation guidance.
