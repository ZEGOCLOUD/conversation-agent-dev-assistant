# AI Install Guide: Conversation Agent Service

This guide is for AI coding tools such as Codex, Cursor, and Claude Code. Use it to help a developer fetch the customer service artifact, initialize a customer project, start the base service, and report the validation level reached.

## 0. Safety Rules

- Do not ask the developer to paste secrets into chat.
- Do not print, repeat, summarize, upload, or commit `.env.local`, `.env`, LLM API keys, ZEGO ServerSecret, control tokens, callback tokens, GitHub tokens, npm tokens, or customer data.
- When authentication or secrets are needed, run or suggest an interactive terminal command and let the developer type values locally.
- Keep the customer service artifact directory separate from the customer project directory.

## 1. Confirm Inputs

Identify whether the developer already has:

| Input | Example | If missing |
| --- | --- | --- |
| Pulse preview artifact | Latest `pulse-conversation-agent-gateway-v*.tgz` prerelease | Install it from the Pulse GitHub Release unless the developer already has a local artifact. |
| Customer private service artifact | Customer-provided `.tgz` | Use only when a delivery team explicitly provides a private customer package. |
| Customer project directory | `./pulse-project` | Default to `./pulse-project` next to the service package. This is a generated project directory, not a workspace id. |
| Local tunnel or real ZEGO Live E2E requirement | Level 2.5 / Level 3 / no | Default to Level 1 local Gateway validation first. |

Do not ask for plaintext secrets. Secret entry belongs in setup or login commands.

When the developer asks how to use the service beyond installation, read the Pulse repository's Chinese developer guide first: `docs/zh-CN/guides/README.md`. It contains the sanitized 01-14 service guides for workspace, Action, Skill, deployment, validation, and troubleshooting.

## 2. Fetch The Customer Service Artifact

Choose one path:

### Pulse GitHub Release

```bash
git clone https://github.com/ZEGOCLOUD/pulse-conversation-agent.git
cd pulse-conversation-agent
node scripts/install-latest.mjs --channel preview --install-dir ./pulse
cd pulse/current
```

If the Pulse repository is private, ask the developer to authenticate with GitHub CLI or set `GITHUB_TOKEN` / `GH_TOKEN` in the terminal. Do not ask them to paste tokens into chat.

### Local `.tgz`

```bash
tar -xzf /path/to/customer-service-artifact.tgz
cd /path/to/extracted-service-package
```

### Private Customer Release

If the delivery team provides a private artifact, ask the developer to authenticate with GitHub CLI:

```bash
gh auth login
```

Then download the artifact using the private release URL or command provided by the delivery team.

### Controlled Download Link

Use the command provided by the delivery team. If the link contains a token, do not write the token into docs or chat summaries.

## 3. Check Local Environment

From the service package root:

```bash
node --version
npm --version
ls -la
```

Node.js 20 or newer is required. The beta package may need npm registry access or a customer npm mirror to install runtime dependencies.

## 4. Initialize Customer Project

From the service package root:

```bash
./bin/conversation-agent setup --project ./pulse-project
./bin/conversation-agent check --project ./pulse-project
```

`setup` writes customer project files under `./pulse-project`. Secrets should be written to `.env.local` or the customer service example `.env`; `conversationAgent.json` should store only `env:NAME` references.

If setup asks for LLM API Key, ZEGO AppID, ZEGO ServerSecret, callback token, or control token, ask the developer to type them into the terminal, not into chat.

## 5. Start Level 1: Local Gateway

```bash
./bin/conversation-agent start gateway --project ./pulse-project --daemon
./bin/conversation-agent status --project ./pulse-project
./bin/conversation-agent doctor --project ./pulse-project
```

Optional endpoint checks:

```bash
./bin/conversation-agent status --project ./pulse-project --json
```

If you manually curl Gateway APIs, include the authentication configured by `conversationAgent.json` and `.env.local`; do not print tokens into chat.

Level 1 means the local Gateway is available. It does not prove real RTC/ASR/TTS end to end. If ZEGO AppID/ServerSecret are not configured, `doctor` may report ZEGO lifecycle findings; for Level 1, treat those as missing Level 3 prerequisites, not as local Gateway startup failure.

## 6. Optional Level 2: Customer Service And Web Page

If browser validation is needed:

```bash
./bin/conversation-agent start zego-service --project ./pulse-project --daemon
./bin/conversation-agent start web --project ./pulse-project --daemon
./bin/conversation-agent status --project ./pulse-project
./bin/conversation-agent doctor --project ./pulse-project
```

Open the Web validation page, usually:

```text
http://127.0.0.1:5188
```

Check customer service `/health` and `/config/runtime`.

## 7. Optional Level 2.5: Local Cloudflare Tunnel Live Smoke

After Level 2 passes, use the standalone customer package example when the developer wants to run a real ZEGO callback and browser RTC smoke from the local machine:

```bash
node examples/local-cloudflare-live-e2e/run.mjs --project ./pulse-project
```

This uses Cloudflare Quick Tunnel by default. If the developer already has a Named Tunnel or stable public HTTPS URL:

```bash
node examples/local-cloudflare-live-e2e/run.mjs \
  --project ./pulse-project \
  --public-url https://ca3-live.example.com
```

Quick Tunnel enables a keeper by default. If the tunnel disconnects or `cloudflared` exits, the keeper restarts the tunnel. When a new HTTPS URL is generated, it refreshes the temporary Gateway config, restarts the Gateway managed by the script, updates the customer service public URL, and re-registers the ZEGO Agent. If `--skip-gateway` or `--skip-customer-service` is used, remind the developer that the external process must perform the equivalent config update.

If the Web frontend is deployed on another machine or already has an HTTPS preview URL:

```bash
node examples/local-cloudflare-live-e2e/run.mjs \
  --project ./pulse-project \
  --web-url https://web-preview.example.com \
  --skip-web
```

A successful Level 2.5 report must include the Tunnel URL and whether room join, microphone publishing, AgentInstance, ASR, LLM callback, TTS, subtitles, mode/status/perf, proactive speak, action UI, and action feedback completed.

When the release scope includes multiple workspaces, Level 2.5 must also cover at least:

- default workspace normal voice conversation;
- action-validation workspace produces its expected ACTION and accepts feedback;
- isolation-validation workspace does not receive the action workspace prompt, action schema, logs, or canvas state;
- `mode-info?workspaceId=...` returns the selected workspace modes.

Level 2.5 is only a local tunnel smoke. It is not managed cloud or production acceptance and does not replace Level 3 cloud HTTPS Live E2E.

## 8. Optional Level 3: Real ZEGO Live E2E

Real Live E2E requires a ZEGO-reachable public HTTPS Gateway callback URL plus valid ZEGO AppID, ServerSecret, ASR/TTS settings, and event callback configuration.

Validate:

- Web page joins the room.
- Microphone publishing succeeds.
- Customer service creates the AgentInstance.
- ZEGO ASR produces user subtitles.
- Gateway receives ZEGO LLM callbacks.
- ZEGO TTS plays AI responses.
- Web page shows subtitles, mode, action, Agent status, and latency metrics.
- Multiple workspaces route by AgentInstance: default, action-validation, and isolation-validation must not share prompt, action schema, logs, canvas state, or action feedback.
- Proactive speak and action feedback must write back to the owning workspace.

Cloud Level 3 still must validate a deployment from the customer tarball, not a source checkout. Level 2.5 local tunnel evidence is development evidence only. If the product claim includes multi-workspace support, a single-workspace cloud Live E2E is not a complete Level 3 result.

## 9. Optional Preview Upgrade

Use this flow when the developer already has a working project and wants to move to a newer preview artifact.

Principle:

- Replace the service package directory.
- Preserve the customer project directory.
- Back up customer-owned config before editing it.
- Never overwrite `.env.local`, `conversationAgent.json`, workspace edits, logs, or state without explicit confirmation.

Recommended layout:

```text
/opt/pulse/releases/<immutable-preview-package>/
/opt/pulse/current -> /opt/pulse/releases/<immutable-preview-package>
/opt/pulse/pulse-project/
```

Check the latest candidate first:

```bash
cd /opt/pulse/current
./bin/conversation-agent upgrade --check --json --project /opt/pulse/pulse-project
```

If `upgradePolicy.requiresDevAssistantUpgrade` is true, update this dev-assistant repository first, reread `AI_INSTALL.md`, then continue. Otherwise run:

```bash
./bin/conversation-agent upgrade --project /opt/pulse/pulse-project
./bin/conversation-agent status --project /opt/pulse/pulse-project
./bin/conversation-agent doctor --project /opt/pulse/pulse-project
```

If `check` or `doctor` reports missing or changed fields, compare the new artifact examples with the existing project and ask before editing customer config. After upgrade, recommend a short Level 2 smoke, or Level 2.5 if live RTC behavior changed.

For rollback:

```bash
cd /opt/pulse/current
./bin/conversation-agent rollback --project /opt/pulse/pulse-project
```

## 10. Final Report Format

Report:

```text
Validation level: Level 1 / Level 2 / Level 2.5 / Level 3
Service package directory: ...
Customer project directory: ...
Commands run: ...
Checks passed: ...
Incomplete or manual items: ...
Suggested next step: ...
```

Do not include secrets, tokens, `.env` contents, or customer private data.
