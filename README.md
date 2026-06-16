# Conversation Agent Developer Assistant

Conversation Agent Developer Assistant helps AI coding tools install, understand, configure, tune, and troubleshoot Conversation Agent Service.

中文说明：本仓库默认使用英文说明；中文用户请先阅读 [README.zh-CN.md](README.zh-CN.md) 和 [AI_INSTALL.zh-CN.md](AI_INSTALL.zh-CN.md)。本仓库通常配合 [Pulse Conversation Agent](https://github.com/ZEGOCLOUD/pulse-conversation-agent) 的 GitHub Release artifact 使用。

This repository is not the Conversation Agent Service runtime. It does not contain proprietary runtime source code or customer secrets. Developers run the service from the customer service artifact, and use this assistant repository to guide tools such as Codex, Cursor, and Claude Code.

## Repository And Artifact Relationship

| Repository | Responsibility |
| --- | --- |
| `pulse-conversation-agent` | External preview repository with docs, checksum, validation evidence, and GitHub Release artifact. Developers download the runnable service artifact from its Release page; runtime examples, contracts, and workspaces live inside the `.tgz`. |
| `conversation-agent-dev-assistant` | Companion assistant repository for AI coding tools. It guides install, validation, prompt optimization, and troubleshooting workflows. |

## Suggested Prompt For AI Coding Tools

```text
Fetch https://github.com/ZEGOCLOUD/conversation-agent-dev-assistant,
read AI_INSTALL.md and AGENTS.md,
and follow them to install the latest Pulse Conversation Agent Developer Preview from
https://github.com/ZEGOCLOUD/pulse-conversation-agent.
Use the Chinese developer guide at docs/zh-CN/guides/README.md when you need detailed service concepts, workspace, Action, Skill, deployment, validation, and troubleshooting references.
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
Afterward, tell me whether we reached Level 2.5 or are still at Level 2, and state that this is not managed cloud or production acceptance.
```

For preview upgrades, the developer can ask:

```text
Upgrade my Pulse Conversation Agent preview artifact safely.
Run conversation-agent upgrade --check first, follow artifact-manifest.json upgradePolicy,
upgrade to the latest GitHub Release artifact when allowed, keep my existing project directory,
run check/status/doctor, and tell me whether a Level 2 or Level 2.5 smoke is still needed.
Do not overwrite my .env.local, conversationAgent.json, workspace edits, logs, or state without asking.
```

## Validation Levels

| Level | Meaning | Typical checks |
| --- | --- | --- |
| Level 1 | Local Gateway is available | `check`, `status`, Gateway control health; raw curl requests may need configured auth. |
| Level 2 | Customer service and Web validation page are available | `/health`, `/config/runtime`, Web page loads. |
| Level 2.5 | Local Cloudflare Tunnel real RTC/ZEGO callback smoke | Tunnel URL, room join, microphone publish, AgentInstance, ASR, LLM callback, TTS, subtitles, mode/status/perf, proactive speak, action UI/feedback, and multi-workspace routing when in scope; not managed cloud or production acceptance. |
| Level 3 | Real ZEGO Live E2E is available | Public HTTPS deployment from the released artifact; room join, microphone publish, AgentInstance creation, ASR, LLM callback, TTS, subtitles, mode/action/status, proactive speak, action feedback, and multi-workspace isolation when in scope. |

## Level 2.5 To Level 3 Migration

| Level 2.5 local tunnel | Level 3 cloud |
| --- | --- |
| Cloudflare tunnel URL | Customer cloud domain / public HTTPS domain |
| local router routes | nginx / LB routes |
| local Gateway / customer service / Web | cloud processes, containers, or multi-machine services |
| `--web-url` points to a remote Web preview | standalone static site, CDN, or frontend server |
| `.env.local` / customer service `.env` | cloud secret store, KMS, CI/CD secret, container secret |
| foreground script | systemd / supervisor / container orchestration |
| Level 2.5 smoke evidence | Level 3 Live E2E managed cloud or customer-environment evidence |

If a release claims multi-workspace support, both Level 2.5 and Level 3 must cover default, action-validation, and isolation-validation workspaces. A single-workspace Live E2E is not a complete Level 3 result for that release scope.

## Preview Upgrade Model

Preview upgrades replace the runtime package and preserve the customer project:

| Directory | Role | AI assistant rule |
| --- | --- | --- |
| `pulse-conversation-agent-gateway-v0.1.0-preview.x/` | Immutable runtime package from GitHub Release. | Use the latest installer or `conversation-agent upgrade`; pin a version only for rollback or troubleshooting. |
| `pulse-project/` | Customer-owned config, secrets, workspace edits, logs, and state. | Preserve and back up before changes. Never overwrite silently. |

Recommended layout:

```text
/opt/pulse/releases/<immutable-preview-package>/
/opt/pulse/current -> /opt/pulse/releases/<immutable-preview-package>
/opt/pulse/pulse-project/
```

Before switching, run `conversation-agent upgrade --check --json`. If the candidate requires a newer dev-assistant, update this repository first. After upgrade or rollback, run `check`, `status`, and `doctor`. If the new release reports missing config, update the customer project deliberately and keep secrets out of chat.

## Skills

- `conversation-agent-install`: install and validate the customer service artifact.
- `conversation-agent-understand-service`: explain service boundaries and integration responsibilities.
- `conversation-agent-optimize-prompts`: tune customer workspace prompts, modes, knowledge, and action contracts.
- `conversation-agent-scenario-eval`: run local text-only scenario evaluations before live RTC validation.
- `conversation-agent-troubleshoot-live-e2e`: troubleshoot Gateway, customer service, Web, and ZEGO Live E2E issues.

`skills/` is the standard Agent Skills source directory. `plugins/codex/skills/` is mirrored for Codex plugin distribution. Keep these two copies synchronized when publishing.

## Safety Defaults

- Do not paste API keys, ZEGO ServerSecret, control tokens, callback tokens, GitHub tokens, or npm tokens into chat.
- Secrets belong in `.env.local` or the customer service example `.env`.
- `conversationAgent.json` should store `env:NAME` style references, not plaintext secrets.
- Do not commit `.env*`, runtime logs, state files, customer data, or screenshots that expose secrets.
- AI tools may run interactive commands, but authentication and secret entry must be completed by the developer in the local terminal.
