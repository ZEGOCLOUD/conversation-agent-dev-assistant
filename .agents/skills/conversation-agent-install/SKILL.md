---
name: conversation-agent-install
description: Use when installing, starting, or validating Conversation Agent Service from a customer service artifact with an AI coding tool. Handles artifact retrieval, setup, check, start, status, doctor, and validation-level reporting without exposing secrets.
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
   ./bin/conversation-agent setup --project ./ca3-project
   ./bin/conversation-agent check --project ./ca3-project
   ```
7. Start local Gateway validation:
   ```bash
   ./bin/conversation-agent start gateway --project ./ca3-project --daemon
   ./bin/conversation-agent status --project ./ca3-project
   ./bin/conversation-agent doctor --project ./ca3-project
   ```
8. If browser or real voice validation is requested, start customer service and Web:
   ```bash
   ./bin/conversation-agent start zego-service --project ./ca3-project --daemon
   ./bin/conversation-agent start web --project ./ca3-project --daemon
   ```

## Validation Levels

- Level 1: local Gateway is available.
- Level 2: customer service and Web validation page are available.
- Level 3: real ZEGO Live E2E works, including room join, microphone publishing, AgentInstance creation, ASR, LLM callback, TTS, subtitles, mode/action/status.

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
