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

### Level 2.5: Local Cloudflare Tunnel Live Smoke

Run the standalone example from the service package root:

```bash
node examples/local-cloudflare-live-e2e/run.mjs --project ./ca3-project
```

If Quick Tunnel fails to produce a URL, check `cloudflared` installation, network access, and Cloudflare rate limits. For stable debugging, ask the developer to set up a named tunnel and pass:

```bash
node examples/local-cloudflare-live-e2e/run.mjs \
  --project ./ca3-project \
  --public-url https://ca3-live.example.com
```

Quick Tunnel has a keeper by default. If `cloudflared` exits or reconnects with a new URL, verify that the runner:

- restarted `cloudflared`
- rewrote `.conversationAgent.local-cloudflare-live-e2e.json`
- restarted the Gateway process managed by the runner
- updated customer service `/config/gateway-public-url`
- called customer service `/agent/register` so Gateway re-ran RegisterAgent / UpdateAgent

If Gateway or customer service is external because `--skip-gateway` or `--skip-customer-service` is used, the runner cannot update that process. Ask the developer to run the equivalent external restart/config update and ZEGO Agent re-registration.

If the Web frontend is deployed on another machine, route Web through that upstream instead of starting the packaged Web:

```bash
node examples/local-cloudflare-live-e2e/run.mjs \
  --project ./ca3-project \
  --web-url https://web-preview.example.com \
  --skip-web
```

Check:

- local router `/health`, `/config/runtime`, `/voice/status`, and `/`
- tunnel URL loads the Web page
- Gateway temporary tunnel config uses the tunnel HTTPS URL
- customer service has a loopback/private `CONVERSATION_AGENT_GATEWAY_INTERNAL_BASE_URL`
- ZEGO RegisterAgent uses the tunnel HTTPS callback URL
- browser microphone permission and publishing
- AgentInstance creation, ASR, LLM callback, TTS, subtitles, mode/status/perf
- proactive speak, action UI, action feedback
- when multi-workspace is in scope: default/action-validation/isolation-validation workspace routing, mode-info by `workspaceId`, and workspace log/canvas isolation

Level 2.5 is development evidence only. Do not report it as cloud managed cloud or production acceptance.

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
- Multiple workspaces route by AgentInstance and do not share prompt, action schema, logs, canvas state, or action feedback.
- Proactive speak and action feedback write back to the owning workspace.

For cloud Level 3, validate a deployment from the customer tarball through public HTTPS nginx / LB. Do not accept a source checkout, localhost-only run, or local tunnel as managed cloud or production acceptance. If multi-workspace support is part of the release scope, single-workspace cloud Live E2E is incomplete.

## Output

Report:

- current validation level
- failing check
- likely cause
- evidence without secrets
- next command or manual action

Do not overstate success. Level 1 or Level 2 does not prove real ZEGO Live E2E.
