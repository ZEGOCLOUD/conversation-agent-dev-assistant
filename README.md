# Conversation Agent Developer Assistant

Conversation Agent Developer Assistant helps AI coding tools install, understand, configure, tune, and troubleshoot Conversation Agent Service.

This repository is not the Conversation Agent Service runtime. It does not contain proprietary runtime source code or customer secrets. Developers run the service from the customer service artifact, and use this assistant repository to guide tools such as Codex, Cursor, and Claude Code.

## Repository And Artifact Relationship

| Type | Used directly by developers | Responsibility |
| --- | --- | --- |
| Internal product source repository | No | Product development, packaging, release, Live E2E, and customer artifact generation. |
| Customer service artifact | Yes | Runnable Conversation Agent Service, workspace, setup/check/doctor, customer service example, and Web validation page. |
| Developer Assistant repository | Yes | AI coding tool guidance, AGENTS.md, skills/plugin, prompt optimization, and troubleshooting workflows. |

## Suggested Prompt For AI Coding Tools

```text
Fetch https://github.com/zego/conversation-agent-dev-assistant,
read AI_INSTALL.md and AGENTS.md,
and follow them to install Conversation Agent Service.
When GitHub, ZEGO, LLM, npm registry, or other authentication/secrets are needed,
do not ask me to paste secrets into chat. Ask me to type them in my local terminal.
After setup, run check/status/doctor and summarize the validation level reached.
```

## Validation Levels

| Level | Meaning | Typical checks |
| --- | --- | --- |
| Level 1 | Local Gateway is available | `check`, `status`, Gateway control health; raw curl requests may need configured auth. |
| Level 2 | Customer service and Web validation page are available | `/health`, `/config/runtime`, Web page loads. |
| Level 3 | Real ZEGO Live E2E is available | Room join, microphone publish, AgentInstance creation, ASR, LLM callback, TTS, subtitles, mode/action/status. |

## Skills

- `conversation-agent-install`: install and validate the customer service artifact.
- `conversation-agent-understand-service`: explain service boundaries and integration responsibilities.
- `conversation-agent-optimize-prompts`: tune customer workspace prompts, modes, knowledge, and action contracts.
- `conversation-agent-troubleshoot-live-e2e`: troubleshoot Gateway, customer service, Web, and ZEGO Live E2E issues.

`skills/` is the standard Agent Skills source directory. `.agents/skills/` is mirrored for Codex repository auto-discovery. `plugins/codex/skills/` is mirrored for Codex plugin distribution. Keep all three synchronized when publishing.

## Safety Defaults

- Do not paste API keys, ZEGO ServerSecret, control tokens, callback tokens, GitHub tokens, or npm tokens into chat.
- Secrets belong in `.env.local` or the customer service example `.env`.
- `conversationAgent.json` should store `env:NAME` style references, not plaintext secrets.
- Do not commit `.env*`, runtime logs, state files, customer data, or screenshots that expose secrets.
- AI tools may run interactive commands, but authentication and secret entry must be completed by the developer in the local terminal.
