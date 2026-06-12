---
name: conversation-agent-troubleshoot-live-e2e
description: Use when troubleshooting Conversation Agent Service setup, Gateway health, customer service, Web validation page, ZEGO callbacks, ASR, TTS, subtitles, mode/action/status, or real Live E2E failures.
---

# Conversation Agent Live E2E Troubleshooting

Use this skill when install, local service, Web validation, or real ZEGO Live E2E fails.

## Safety

- Do not print or request secrets in chat.
- Do not dump `.env.local`, `.env`, logs containing customer data, tokens, or API keys.
- Summarize failures with non-sensitive evidence only.

## Triage By Validation Level

### Level 1: Local Gateway

Run:

```bash
./bin/conversation-agent check --project ./ca3-project
./bin/conversation-agent status --project ./ca3-project
./bin/conversation-agent doctor --project ./ca3-project
```

Check Node.js version, npm dependency installation, Gateway port, LLM config references, and `./bin/conversation-agent status --project ./ca3-project --json`. Raw curl requests to Gateway APIs may require configured auth; do not print tokens into chat.

If ZEGO AppID/ServerSecret are not configured, `doctor` may report ZEGO lifecycle findings. For Level 1, treat those as missing Level 3 prerequisites, not as local Gateway startup failure.

### Level 2: Customer Service And Web

Run:

```bash
./bin/conversation-agent start zego-service --project ./ca3-project --daemon
./bin/conversation-agent start web --project ./ca3-project --daemon
```

Check customer service `/health`, `/config/runtime`, Web page availability, Gateway internal base URL, and customer service to Gateway server-side auth.

### Level 3: Real ZEGO Live E2E

Check:

- public HTTPS callback URL is ZEGO-reachable
- ZEGO event callbacks are configured
- Web room join succeeds
- browser microphone permission and publishing succeed
- AgentInstance creation succeeds
- ASR subtitles appear
- Gateway receives ZEGO LLM callbacks
- TTS vendor settings are valid
- Web displays subtitles, mode, action, Agent status, and latency

## Output

Report:

- current validation level
- failing check
- likely cause
- evidence without secrets
- next command or manual action

Do not overstate success. Level 1 or Level 2 does not prove real ZEGO Live E2E.
