---
name: conversation-agent-scenario-eval
description: Use when running or interpreting local text-only scenario evaluations for a customer's Conversation Agent workspace, including persona simulations, action expectations, dynamic context checks, and local reports. Does not replace RTC/ASR/TTS/Web or Live E2E validation.
---

# Conversation Agent Scenario Evaluation

Use this skill when the developer wants to evaluate a customer workspace with local text-only multi-turn scenarios before editing prompts, modes, knowledge, or actions.

## Safety And Boundary

- Run locally and write local reports only.
- Do not upload transcripts, workspace content, or customer data to third-party evaluation platforms unless the developer explicitly asks and confirms their data policy.
- Do not read, print, summarize, or commit `.env*`, API keys, ZEGO ServerSecret, control tokens, callback tokens, or customer private data.
- Do not claim this validates RTC, ASR, TTS, Web action rendering, or cloud Live E2E.
- Do not modify proprietary runtime internals. Use the report to guide customer-editable workspace changes.

## Workflow

1. Read the scenario evaluation guide:
   ```bash
   sed -n '1,220p' docs/scenario-eval.md
   ```
2. Inspect the customer's workspace structure without printing secrets:
   - `workspace.json`
   - `AGENTS.md` or `agent.md`
   - `SOUL.md`
   - `modes/*.md`
   - `knowledge/*`
   - `skills/*/SKILL.md`
3. Validate the scenario contract first:
   ```bash
   node tools/scenario-eval.mjs --scenario ./scenario.eval.yaml --workspace ./ca3-project/workspaces/default --dry-run
   ```
4. Run a mock smoke if the developer is still building the case file:
   ```bash
   node tools/scenario-eval.mjs --scenario ./scenario.eval.yaml --mock --out .scenario-eval-runs/mock
   ```
5. Run against the local Gateway text endpoint when the Gateway is available:
   ```bash
   node tools/scenario-eval.mjs \
     --scenario ./scenario.eval.yaml \
     --workspace ./ca3-project/workspaces/default \
     --gateway-url http://127.0.0.1:18795 \
     --auth-token "$CONVERSATION_AGENT_CONTROL_TOKEN" \
     --out .scenario-eval-runs/default
   ```
6. Review:
   - `summary.md`
   - `failures.csv`
   - `suggested-edits.md`
   - selected `run.jsonl` records when more evidence is needed
7. If changes are needed, use `conversation-agent-optimize-prompts` and change one failure category at a time.

## What To Report

- scenario id and workspace path
- whether this was dry-run, mock, or Gateway mode
- pass rate and top failure categories
- action, mode, dynamic-context, and protocol-leak findings
- suggested customer-editable files to inspect
- whether additional Web or Live E2E validation is still required

## Output Style

Keep the report concise. Lead with hard-rule failures before subjective style feedback. State clearly that local scenario evaluation is not Live E2E.
