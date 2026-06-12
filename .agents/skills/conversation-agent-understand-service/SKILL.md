---
name: conversation-agent-understand-service
description: Use when explaining how Conversation Agent Service works, including Gateway, ZEGO AI Agent server, customer service, Web/mobile clients, workspace, runtime skills, configuration, and validation boundaries.
---

# Conversation Agent Service Understanding

Use this skill when the developer asks how the service works, where to configure it, or which component owns a behavior.

## Explain The Boundary

- ZEGO AI Agent server owns RTC audio, ASR, TTS, interruption semantics, AgentInstance execution, and ZEGO callbacks.
- Conversation Agent Service Gateway owns ZEGO LLM callback handling, workspace/mode/action/skill logic, dynamic context, observability, and text or control intent output.
- Customer service owns RTC Token04, browser/mobile APIs, customer authorization, runtime config, event fanout, and server-to-server calls to Gateway lifecycle/action APIs.
- Customer Web or mobile clients use the customer service and ZEGO Express SDK. They must not hold Gateway control tokens or call private Gateway APIs directly.

## Explain Configuration

- `conversationAgent.json`: Gateway project-level config and `env:NAME` secret references.
- `.env.local`: local secrets for the Gateway project.
- `workspace.json`: workspace-level behavior, modes, skills, memory, automation hooks, and action contracts.
- `modes/`, `knowledge/`, `skills/`: customer-editable behavior and capability materials.

## Avoid Confusion

- Runtime skills live in a customer workspace and are used by Conversation Agent Service at runtime.
- AI coding skills live in this Developer Assistant repository and guide Codex/Cursor/Claude Code.
- Local Gateway validation does not prove real ZEGO Live E2E.
- Web/mobile clients should talk to the customer service, not Gateway private APIs.

## Answer Style

Use concise tables and diagrams when helpful. Prefer the term "customer service" or "客户服务端服务" over unexplained shorthand.
