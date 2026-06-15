# 本地场景仿真评测

本地场景仿真评测用于在修改客户 workspace 的 prompt、mode、knowledge 或 action contract 之前，先用纯文本多轮模拟检查行为风险。

它默认完全本地运行，只产出本地报告。它不会默认上传 trace，不依赖第三方评测平台，也不能替代 RTC、ASR、TTS、Web 或 Live E2E 验证。

## 评测内容

| 层级 | 示例 |
| --- | --- |
| 硬规则 | 应触发/禁止触发的 action、action 次数、mode 事件、禁用词、协议泄漏。 |
| 动态上下文 | `userContextMarkdown`、`sessionProfileMarkdown`、runtime state、recent observations、decision state 是否被正确使用。 |
| 用户画像体验 | 模拟用户是否信任回复、是否愿意继续、是否感觉被强推。 |
| 旁观者和业务评审 | 将失败归因到 soul、mode prompt、knowledge、action contract、dynamic context、tool 或 skill。 |

## 文件

| 文件 | 用途 |
| --- | --- |
| `tools/scenario-eval.mjs` | 本地 Node.js CLI。 |
| `examples/scenario-eval/voice-room-demo/scenario.eval.yaml` | 中性示例场景契约。 |
| `examples/scenario-eval/voice-room-demo/workspace/` | 用于 mock smoke 的中性 workspace。 |

## 使用方式

只校验场景契约，不调用模型或 Gateway：

```bash
node tools/scenario-eval.mjs \
  --scenario examples/scenario-eval/voice-room-demo/scenario.eval.yaml \
  --dry-run
```

用中性示例跑 mock 模式：

```bash
node tools/scenario-eval.mjs \
  --scenario examples/scenario-eval/voice-room-demo/scenario.eval.yaml \
  --mock \
  --out .scenario-eval-runs/voice-room-demo
```

连接本地 Gateway 文本入口：

```bash
node tools/scenario-eval.mjs \
  --scenario ./scenario.eval.yaml \
  --workspace ./ca3-project/workspaces/default \
  --gateway-url http://127.0.0.1:18795 \
  --auth-token "$CONVERSATION_AGENT_CONTROL_TOKEN" \
  --out .scenario-eval-runs/default
```

CLI 默认使用这些 Gateway 路径：

| 用途 | 默认路径 |
| --- | --- |
| 文本对话 | `/voice/text-chat` |
| 会话上下文 | `/voice/control/sessions/:sessionId/context` |
| 会话 mode | `/voice/control/sessions/:sessionId/mode` |

## 报告输出

| 报告 | 用途 |
| --- | --- |
| `run.jsonl` | 机器可读的 turn 和 case 结果。 |
| `summary.md` | 人可读的通过率、失败项和分角色反馈。 |
| `failures.csv` | 可放入电子表格分析的失败明细。 |
| `suggested-edits.md` | 建议检查的客户可编辑区域。 |
| `coverage.md` | 根据 case 元数据和期望推断出的覆盖矩阵。 |

这些报告都是本地产物。评测器不会自动修改 `AGENTS.md`、`SOUL.md`、`modes/*.md`、`knowledge/*` 或 action contract。

## 场景契约形态

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

当需要检查 action 参数时，可以使用对象形态：

```yaml
expect:
  requiredActions:
    - name: OPEN_PANEL
      contains: ["panelType=settings"]
```

当需要模拟用户停顿、冷场或不知道聊什么时，可以使用本地事件轮次。评测器会把它渲染成一条本地文本事件，用来验证主动补话策略；它不代表真实 RTC idle/heartbeat 已经通过。

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
          forbiddenPhrases: ["idle_timeout", "本地评测事件", "ACTION"]
    expect:
      noAction: true
      forbiddenActions: [OPEN_PANEL]
      forbiddenPhrases: ["idle_timeout", "本地评测事件", "ACTION"]
```

`turn.expect` 只评估该轮 assistant 回复，适合验证 idle 后的主动补话；case 级 `expect` 评估整个 case，适合兜住全程禁止误触发的 Action。

如果要验证真实 action-result 闭环，使用 `--transport zego-callback`，并在 case 中加入 setup turn：

```yaml
cases:
  - id: completed-panel-no-repeat
    setup:
      turns:
        - user: "打开设置面板。"
        - user: "确认，现在打开。"
          expect:
            requiredActions:
              - name: OPEN_PANEL
                contains: ["panelType=settings"]
          actionResult:
            action:
              name: OPEN_PANEL
              contains: ["panelType=settings"]
            status: completed
            resultDescription: "设置面板已成功打开。"
            responsePolicy: silent
    turns:
      - user: "现在打开了吗？"
    expect:
      noAction: true
      forbiddenActions:
        - name: OPEN_PANEL
          contains: ["panelType=settings"]
```

快速 prompt 检查用默认 `text-chat`。需要 action instance ID 和 `/voice/action-result` 验证时，用 `zego-callback`。

## 边界

本能力只是本地纯文本场景评测。它可以提前发现 prompt、mode、action 和动态上下文回归，但不能证明麦克风发布、ZEGO callback、ASR、TTS、字幕渲染、Web action UI 或云端 Live E2E 已经通过。
