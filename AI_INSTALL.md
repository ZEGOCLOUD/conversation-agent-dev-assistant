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
| Service artifact | `pulse-conversation-agent-gateway-v0.1.0-preview.2.tgz` or a private customer service package supplied by the delivery team | Ask for the Pulse release URL, customer delivery URL, private Release, customer repo, or local file path. |
| Customer project directory | `./ca3-project` | Default to `./ca3-project` next to the service package. |
| Local tunnel or real ZEGO Live E2E requirement | Level 2.5 / Level 3 / no | Default to Level 1 local Gateway validation first. |

Do not ask for plaintext secrets. Secret entry belongs in setup or login commands.

## 2. Fetch The Customer Service Artifact

Choose one path:

### Local `.tgz`

```bash
tar -xzf /path/to/pulse-conversation-agent-gateway-v0.1.0-preview.2.tgz
cd pulse-conversation-agent-gateway-v0.1.0-preview.2
```

For a private customer package, use the package name supplied by the delivery team, for example `customer-service-package-*.tgz`.

### GitHub Release

Ask the developer to authenticate with GitHub CLI:

```bash
gh auth login
```

Then download the Pulse preview artifact from:

```text
https://github.com/Cogit-oergo-sum/pulse-conversation-agent/releases/tag/v0.1.0-preview.2
```

For private customer artifacts, use the release URL or command provided by the maintainers.

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
./bin/conversation-agent setup --project ./ca3-project
./bin/conversation-agent check --project ./ca3-project
```

`setup` writes customer project files under `./ca3-project`. Secrets should be written to `.env.local` or the customer service example `.env`; `conversationAgent.json` should store only `env:NAME` references.

If setup asks for LLM API Key, ZEGO AppID, ZEGO ServerSecret, callback token, or control token, ask the developer to type them into the terminal, not into chat.

## 5. Start Level 1: Local Gateway

```bash
./bin/conversation-agent start gateway --project ./ca3-project --daemon
./bin/conversation-agent status --project ./ca3-project
./bin/conversation-agent doctor --project ./ca3-project
```

Optional endpoint checks:

```bash
./bin/conversation-agent status --project ./ca3-project --json
```

If you manually curl Gateway APIs, include the authentication configured by `conversationAgent.json` and `.env.local`; do not print tokens into chat.

Level 1 means the local Gateway is available. It does not prove real RTC/ASR/TTS end to end. If ZEGO AppID/ServerSecret are not configured, `doctor` may report ZEGO lifecycle findings; for Level 1, treat those as missing Level 3 prerequisites, not as local Gateway startup failure.

## 6. Optional Level 2: Customer Service And Web Page

If browser validation is needed:

```bash
./bin/conversation-agent start zego-service --project ./ca3-project --daemon
./bin/conversation-agent start web --project ./ca3-project --daemon
./bin/conversation-agent status --project ./ca3-project
./bin/conversation-agent doctor --project ./ca3-project
```

Open the Web validation page, usually:

```text
http://127.0.0.1:5188
```

Check customer service `/health` and `/config/runtime`.

## 7. Optional Level 2.5: Local Cloudflare Tunnel Live Smoke

After Level 2 passes, use the standalone customer package example when the developer wants to run a real ZEGO callback and browser RTC smoke from the local machine:

```bash
node examples/local-cloudflare-live-e2e/run.mjs --project ./ca3-project
```

This uses Cloudflare Quick Tunnel by default. If the developer already has a Named Tunnel or stable public HTTPS URL:

```bash
node examples/local-cloudflare-live-e2e/run.mjs \
  --project ./ca3-project \
  --public-url https://ca3-live.example.com
```

Quick Tunnel enables a keeper by default. If the tunnel disconnects or `cloudflared` exits, the keeper restarts the tunnel. When a new HTTPS URL is generated, it refreshes the temporary Gateway config, restarts the Gateway managed by the script, updates the customer service public URL, and re-registers the ZEGO Agent. If `--skip-gateway` or `--skip-customer-service` is used, remind the developer that the external process must perform the equivalent config update.

If the Web frontend is deployed on another machine or already has an HTTPS preview URL:

```bash
node examples/local-cloudflare-live-e2e/run.mjs \
  --project ./ca3-project \
  --web-url https://web-preview.example.com \
  --skip-web
```

A successful Level 2.5 report must include the Tunnel URL and whether room join, microphone publishing, AgentInstance, ASR, LLM callback, TTS, subtitles, and mode/status/perf completed.

Level 2.5 is only a local tunnel smoke. It is not release acceptance and does not replace Level 3 cloud HTTPS Live E2E.

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

Cloud Level 3 still must validate a deployment from the customer tarball, not a source checkout. Level 2.5 local tunnel evidence is development evidence only.

## 9. Final Report Format

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
