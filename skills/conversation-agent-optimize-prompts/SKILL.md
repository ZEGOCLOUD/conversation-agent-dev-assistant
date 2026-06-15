---
name: conversation-agent-optimize-prompts
description: Use when tuning a customer's Conversation Agent workspace prompts, modes, knowledge, runtime skill descriptions, action contracts, TTS-facing wording, or validation cases without modifying proprietary runtime internals.
---

# Conversation Agent Prompt Optimization

Use this skill when the developer wants to improve scene behavior, prompts, modes, actions, or tool usage.

## Scope

Prefer editing customer-owned files:

- `workspace.json`
- `modes/*.md`
- `knowledge/*`
- `skills/*/SKILL.md`
- customer service action handling examples

Do not modify proprietary runtime internals, generated dependency files, `.env*`, runtime logs, state files, or customer data.

## First Alignment

Before editing, identify:

- target audience and scenario
- business goal and success event
- mandatory red lines
- expected stages or modes
- required and forbidden actions
- required and forbidden tools or knowledge sources
- whether real ZEGO Live E2E validation is needed

## Optimization Workflow

1. Inspect current workspace, mode prompts, knowledge, skills, and action contract.
2. State the intended diff before editing.
3. Change one failure category at a time: welcome wording, mode boundary, action boundary, knowledge/tool trigger, TTS wording, or latency.
4. For UI actions, keep AI-emitted labels in key-value syntax, for example `[ACTION:OPEN_PANEL panel="billing"]`. Do not put JSON objects inside `[ACTION:...]`.
5. Keep TTS-facing text natural and free of JSON, Markdown, protocol fields, and raw tool output.
6. Run service checks after changes:
   ```bash
   ./bin/conversation-agent check --project ./ca3-project
   ./bin/conversation-agent doctor --project ./ca3-project
   ```
7. If user experience matters, run Web or Live E2E smoke.

## Validation

Report:

- files changed
- behavior intended
- commands run
- validation level reached
- remaining risks

Do not claim real RTC/ASR/TTS success unless Level 3 was actually verified.
