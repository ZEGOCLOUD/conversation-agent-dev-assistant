# Local Scenario Evaluation

Local scenario evaluation helps developers test a customer workspace with text-only multi-turn simulations before changing prompts, modes, knowledge, or action contracts.

It runs locally and writes local reports only. It does not upload traces, use third-party evaluation platforms by default, or replace RTC/ASR/TTS/Web/Live E2E validation.

## What It Checks

| Layer | Examples |
| --- | --- |
| Hard rules | Required or forbidden actions, max action count, expected mode events, forbidden text, protocol leakage. |
| Dynamic context | Whether `userContextMarkdown`, `sessionProfileMarkdown`, runtime state, recent observations, or decision state are reflected correctly. |
| Persona experience | Whether a simulated user persona would trust the response or continue the conversation. |
| Observer and business review | Whether failures point to soul, mode prompt, knowledge, action contract, dynamic context, tool, or skill changes. |

## Files

| File | Purpose |
| --- | --- |
| `tools/scenario-eval.mjs` | Local Node.js CLI. |
| `examples/scenario-eval/voice-room-demo/scenario.eval.yaml` | Neutral example scenario contract. |
| `examples/scenario-eval/voice-room-demo/workspace/` | Small neutral workspace for mock smoke checks. |

## Usage

Validate the scenario contract without calling a model or Gateway:

```bash
node tools/scenario-eval.mjs \
  --scenario examples/scenario-eval/voice-room-demo/scenario.eval.yaml \
  --dry-run
```

Run the neutral example in mock mode:

```bash
node tools/scenario-eval.mjs \
  --scenario examples/scenario-eval/voice-room-demo/scenario.eval.yaml \
  --mock \
  --out .scenario-eval-runs/voice-room-demo
```

Run against a local Gateway text endpoint:

```bash
node tools/scenario-eval.mjs \
  --scenario ./scenario.eval.yaml \
  --workspace ./pulse-project/workspaces/default \
  --gateway-url http://127.0.0.1:18795 \
  --auth-token "$CONVERSATION_AGENT_CONTROL_TOKEN" \
  --out .scenario-eval-runs/default
```

The CLI uses these Gateway defaults:

| Purpose | Default path |
| --- | --- |
| Text turn | `/voice/text-chat` |
| Session context | `/voice/control/sessions/:sessionId/context` |
| Session mode | `/voice/control/sessions/:sessionId/mode` |

## Report Outputs

| Report | Purpose |
| --- | --- |
| `run.jsonl` | Machine-readable turns and case results. |
| `summary.md` | Human-readable pass rate, failures, and role feedback. |
| `failures.csv` | Failure rows for spreadsheet review. |
| `suggested-edits.md` | Suggested customer-editable areas to inspect. |
| `coverage.md` | Coverage matrix inferred from case metadata and expectations. |

The reports are local artifacts. Review them before editing the workspace. The evaluator does not automatically modify `AGENTS.md`, `SOUL.md`, `modes/*.md`, `knowledge/*`, or action contracts.

## Scenario Contract Shape

```yaml
id: my-scene
scenario:
  goal: Help the user complete the target business flow.
  successEvent: The user accepts a valid next step.
  redLines: ["Do not force an action without consent"]
actions:
  - name: OPEN_PANEL
    requiredWhen: User explicitly asks to open the panel.
    forbiddenWhen: User is only asking for information.
dynamicContext:
  userContextMarkdown: "User profile: ..."
  runtimeStateMarkdown: "Current state: ..."
personas:
  - id: cautious-user
    goal: Learn before acting.
    hiddenConcern: Does not want an unexpected UI jump.
    behaviorStyle: Asks short follow-up questions.
    actionAcceptanceThreshold: Accepts action only after explicit confirmation.
cases:
  - id: vague-interest
    persona: cautious-user
    turns:
      - user: "Tell me more first."
    expect:
      noAction: true
      forbiddenActions: [OPEN_PANEL]
      noProtocolLeak: true
```

When an action payload matters, use object expectations:

```yaml
expect:
  requiredActions:
    - name: OPEN_PANEL
      contains: ["panelType=settings"]
```

When you need to simulate user silence, cold starts, or "I do not know what to say" moments, use a local event turn. The evaluator renders it as a local text event so you can check proactive follow-up behavior. It does not prove the real RTC idle/heartbeat path.

```yaml
cases:
  - id: idle-follow-up-no-action
    persona: cautious-user
    turns:
      - user: "I am new here and do not know what to say."
      - event: idle_timeout
        durationSeconds: 20
        reason: User paused and did not continue speaking.
        expect:
          noAction: true
          forbiddenActions: [OPEN_PANEL]
          forbiddenPhrases: ["idle_timeout", "local evaluation event", "ACTION"]
    expect:
      noAction: true
      forbiddenActions: [OPEN_PANEL]
      forbiddenPhrases: ["idle_timeout", "local evaluation event", "ACTION"]
```

`turn.expect` evaluates only that assistant turn, which is useful for proactive follow-up after an idle event. Case-level `expect` evaluates the whole case and is useful as a guardrail against any action misfire across the interaction.

For a real action-result loop, run with `--transport zego-callback` and add a setup turn:

```yaml
cases:
  - id: completed-panel-no-repeat
    setup:
      turns:
        - user: "Open the settings panel."
        - user: "Yes, open it now."
          expect:
            requiredActions:
              - name: OPEN_PANEL
                contains: ["panelType=settings"]
          actionResult:
            action:
              name: OPEN_PANEL
              contains: ["panelType=settings"]
            status: completed
            resultDescription: "The settings panel opened successfully."
            responsePolicy: silent
    turns:
      - user: "Is it open now?"
    expect:
      noAction: true
      forbiddenActions:
        - name: OPEN_PANEL
          contains: ["panelType=settings"]
```

Use `text-chat` for fast prompt checks. Use `zego-callback` when you need action instance IDs and `/voice/action-result` validation.

## Boundary

This is a local text evaluation. It can catch prompt, mode, action, and dynamic-context regressions early, but it does not prove real microphone publishing, ZEGO callbacks, ASR, TTS, subtitle rendering, Web action UI, or cloud Live E2E readiness.
