---
name: conversation-agent-install
description: Use when installing, starting, or validating Conversation Agent Service from a customer service artifact with an AI coding tool. Handles artifact retrieval, setup, check, start, status, doctor, optional local Cloudflare tunnel smoke, and validation-level reporting without exposing secrets.
---

# Conversation Agent Install

Use this skill when the developer wants to install or start Conversation Agent Service.

## Safety

- Do not ask the developer to paste secrets into chat.
- Do not print, summarize, upload, or commit `.env.local`, `.env`, API keys, ZEGO ServerSecret, control tokens, callback tokens, GitHub tokens, npm tokens, or customer data.
- If authentication or secret entry is needed, run or suggest an interactive terminal command and let the developer type values locally.
- Keep the service package directory separate from the customer project directory.

## Workflow

1. Read `AI_INSTALL.zh-CN.md` or `AI_INSTALL.md` if present.
2. Determine how the customer service artifact will be obtained:
   - local `.tgz`
   - private GitHub Release
   - customer private repository
   - controlled download link
3. If GitHub authentication is needed, run or suggest:
   ```bash
   gh auth login
   ```
4. Extract the artifact and enter the service package root.
5. Check Node.js and npm:
   ```bash
   node --version
   npm --version
   ```
6. Initialize the customer project:
   ```bash
   ./bin/conversation-agent setup --project ./pulse-project
   ./bin/conversation-agent check --project ./pulse-project
   ```
7. Start local Gateway validation:
   ```bash
   ./bin/conversation-agent start gateway --project ./pulse-project --daemon
   ./bin/conversation-agent status --project ./pulse-project
   ./bin/conversation-agent doctor --project ./pulse-project
   ```
8. If browser or real voice validation is requested, start customer service and Web:
   ```bash
   ./bin/conversation-agent start zego-service --project ./pulse-project --daemon
   ./bin/conversation-agent start web --project ./pulse-project --daemon
   ```
9. If Level 2 passes and the developer wants a local real RTC smoke, use the standalone Cloudflare example:
   ```bash
   node examples/local-cloudflare-live-e2e/run.mjs --project ./pulse-project
   ```
   For a named tunnel or fixed HTTPS URL:
   ```bash
   node examples/local-cloudflare-live-e2e/run.mjs \
     --project ./pulse-project \
     --public-url https://ca3-live.example.com
   ```
   If the Web frontend is already deployed on another machine:
   ```bash
   node examples/local-cloudflare-live-e2e/run.mjs \
     --project ./pulse-project \
     --web-url https://web-preview.example.com \
     --skip-web
   ```
   Quick Tunnel has a keeper by default. If `cloudflared` exits and a new URL is generated, the keeper refreshes temporary Gateway config, restarts the Gateway managed by the script, updates customer service public URL, and re-registers the ZEGO Agent. If Gateway or customer service is skipped because it runs elsewhere, tell the developer the external process must do the same update.
   Do not ask the developer to paste cloudflared credentials or service secrets into chat. Let them authenticate or type secrets in the terminal.

## Validation Levels

- Level 1: local Gateway is available.
- Level 2: customer service and Web validation page are available.
- Level 2.5: local Cloudflare Tunnel real RTC/ZEGO callback smoke works. Report the Tunnel URL and whether room join, microphone publishing, AgentInstance, ASR, LLM callback, TTS, subtitles, mode/status/perf, proactive speak, action UI, and action feedback completed. If multi-workspace is in scope, also report default/action-validation/isolation-validation routing and log/canvas isolation. State that this is not managed cloud or production acceptance.
- Level 3: real ZEGO Live E2E works from the released artifact, including room join, microphone publishing, AgentInstance creation, ASR, LLM callback, TTS, subtitles, mode/action/status, proactive speak, action feedback, and multi-workspace isolation when in scope.

Level 3 managed cloud or production acceptance still requires a cloud public HTTPS deployment from the customer tarball, not a source checkout or local tunnel. If multi-workspace support is part of the release scope, single-workspace cloud Live E2E is incomplete.

## Final Response

Report:

- validation level reached
- service package directory
- customer project directory
- commands run
- checks passed
- incomplete manual items
- next recommended step

Do not include secrets, tokens, `.env` contents, or customer private data.
