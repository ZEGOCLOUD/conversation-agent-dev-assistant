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
| Customer service artifact | `conversation-agent-3.0.beta-sdk-xxx.tgz` | Ask for a download URL, private Release, customer repo, or local file path. |
| Customer project directory | `./ca3-project` | Default to `./ca3-project` next to the service package. |
| Real ZEGO Live E2E requirement | yes / no | Default to Level 1 local Gateway validation first. |

Do not ask for plaintext secrets. Secret entry belongs in setup or login commands.

## 2. Fetch The Customer Service Artifact

Choose one path:

### Local `.tgz`

```bash
tar -xzf /path/to/conversation-agent-3.0.beta-sdk-*.tgz
cd conversation-agent-3.0.beta-sdk
```

### Private GitHub Release

Ask the developer to authenticate with GitHub CLI:

```bash
gh auth login
```

Then download the artifact using the release URL or command provided by the delivery team.

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

## 7. Optional Level 3: Real ZEGO Live E2E

Real Live E2E requires a ZEGO-reachable public HTTPS Gateway callback URL plus valid ZEGO AppID, ServerSecret, ASR/TTS settings, and event callback configuration.

Validate:

- Web page joins the room.
- Microphone publishing succeeds.
- Customer service creates the AgentInstance.
- ZEGO ASR produces user subtitles.
- Gateway receives ZEGO LLM callbacks.
- ZEGO TTS plays AI responses.
- Web page shows subtitles, mode, action, Agent status, and latency metrics.

## 8. Final Report Format

Report:

```text
Validation level: Level 1 / Level 2 / Level 3
Service package directory: ...
Customer project directory: ...
Commands run: ...
Checks passed: ...
Incomplete or manual items: ...
Suggested next step: ...
```

Do not include secrets, tokens, `.env` contents, or customer private data.
