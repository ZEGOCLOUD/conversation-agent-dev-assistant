# AGENTS.md

This repository guides AI coding tools that help developers install, understand, tune, and troubleshoot Conversation Agent Service.

## Working Agreements

1. Keep the customer service artifact separate from this developer assistant repository.
2. Do not treat the customer service artifact as open source or as a public npm package.
3. Do not ask the developer to paste secrets into chat. When secrets or authentication are needed, run or suggest an interactive terminal command and let the developer type values locally.
4. Do not read back, summarize, upload, commit, or print `.env.local`, `.env`, API keys, ZEGO ServerSecret, control tokens, callback tokens, GitHub tokens, npm tokens, or customer data.
5. Prefer the service package CLI over ad hoc commands:
   - `./bin/conversation-agent setup --project ./ca3-project`
   - `./bin/conversation-agent check --project ./ca3-project`
   - `./bin/conversation-agent start gateway --project ./ca3-project --daemon`
   - `./bin/conversation-agent status --project ./ca3-project`
   - `./bin/conversation-agent doctor --project ./ca3-project`
6. Keep service package directory and customer project directory separate.
7. Distinguish three validation levels: local Gateway, customer service plus Web page, and real ZEGO Live E2E.
8. For prompt or scene optimization, modify only customer-editable workspace files, knowledge files, action contracts, and integration examples. Do not modify proprietary runtime internals.

## Service Boundary

- ZEGO AI Agent server owns realtime RTC media, ASR, TTS, interruption semantics, AgentInstance lifecycle execution, and ZEGO callbacks.
- Conversation Agent Service Gateway owns ZEGO LLM callback handling, workspace/mode/action/skill logic, dynamic context, observability, and text or control intent output.
- Customer service owns RTC Token04, browser/mobile APIs, customer authorization, runtime config, event fanout, and server-to-server calls to Gateway lifecycle/action APIs.
- Customer Web or mobile clients call the customer service and ZEGO Express SDK. They must not hold Gateway control tokens or call private Gateway APIs directly.

## What To Do First

When a developer asks to install or use Conversation Agent Service:

1. Read `AI_INSTALL.zh-CN.md` or `AI_INSTALL.md`.
2. Identify whether the customer service artifact is already local, needs to be downloaded, or is in a private GitHub Release.
3. Check Node.js and npm availability.
4. Run the service package CLI and report the validation level reached.
5. If setup needs secrets, pause and ask the developer to type them into the terminal, not into chat.
