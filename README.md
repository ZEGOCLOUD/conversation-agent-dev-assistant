# Conversation Agent Developer Assistant

Conversation Agent Developer Assistant helps AI coding tools install, understand, configure, tune, and troubleshoot Conversation Agent Service.

This repository is not the Conversation Agent Service runtime. It does not contain proprietary runtime source code or customer secrets. Developers run the service from the customer service artifact, and use this assistant repository to guide tools such as Codex, Cursor, and Claude Code.

## Repository And Artifact Relationship

| Type | Used directly by developers | Responsibility |
| --- | --- | --- |
| Pulse preview repository | Yes | Public-readable docs, manifest/checksum, and compiled preview artifact for broad evaluation. |
| Customer service artifact | Yes | Private customer runnable Conversation Agent Service package, workspace, setup/check/doctor, customer service example, and Web validation page. |
| Developer Assistant repository | Yes | AI coding tool guidance, AGENTS.md, skills/plugin, prompt optimization, and troubleshooting workflows. |
| Internal product source repository | No | Proprietary source development, packaging, release, Live E2E, stable promotion, and artifact generation. |

The intended split is: external users evaluate the Service through `pulse-conversation-agent`, AI coding tools operate it through this assistant repo, internal engineering builds it from the source repo, and private customers receive immutable `.tgz` artifacts for their own environment.

## Suggested Prompt For AI Coding Tools

```text
Fetch https://github.com/Cogit-oergo-sum/conversation-agent-dev-assistant,
read AI_INSTALL.md and AGENTS.md,
and follow them to install Conversation Agent Service from
https://github.com/Cogit-oergo-sum/pulse-conversation-agent/releases/tag/v0.1.0-preview.2.
When GitHub, ZEGO, LLM, npm registry, or other authentication/secrets are needed,
do not ask me to paste secrets into chat. Ask me to type them in my local terminal.
After setup, run check/status/doctor and summarize the validation level reached.
```

After Level 2 passes, the developer can ask:

```text
Use examples/local-cloudflare-live-e2e to run a local tunnel Live Smoke.
If the Web frontend is already deployed on another machine, use --web-url and do not start the packaged Web.
When secrets or cloudflared login are needed, let me type them in my terminal instead of pasting them into chat.
If Quick Tunnel disconnects, confirm that the keeper refreshed Gateway / customer service public URL and re-registered the ZEGO Agent.
Afterward, tell me whether we reached Level 2.5 or are still at Level 2, and state that this is not cloud release acceptance.
```

## Validation Levels

| Level | Meaning | Typical checks |
| --- | --- | --- |
| Level 1 | Local Gateway is available | `check`, `status`, Gateway control health; raw curl requests may need configured auth. |
| Level 2 | Customer service and Web validation page are available | `/health`, `/config/runtime`, Web page loads. |
| Level 2.5 | Local Cloudflare Tunnel real RTC/ZEGO callback smoke | Tunnel URL, room join, microphone publish, AgentInstance, ASR, LLM callback, TTS, subtitles, mode/status/perf; not release acceptance. |
| Level 3 | Real ZEGO Live E2E is available | Room join, microphone publish, AgentInstance creation, ASR, LLM callback, TTS, subtitles, mode/action/status. |

## Level 2.5 To Level 3 Migration

| Level 2.5 local tunnel | Level 3 cloud |
| --- | --- |
| Cloudflare tunnel URL | Customer cloud domain / public HTTPS domain |
| local router routes | nginx / LB routes |
| local Gateway / customer service / Web | cloud processes, containers, or multi-machine services |
| `--web-url` points to a remote Web preview | standalone static site, CDN, or frontend server |
| `.env.local` / customer service `.env` | cloud secret store, KMS, CI/CD secret, container secret |
| foreground script | systemd / supervisor / container orchestration |
| Level 2.5 smoke evidence | Level 3 Live E2E release evidence |

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
