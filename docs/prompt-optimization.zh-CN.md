# Prompt 和场景优化指南

本指南用于优化客户 workspace 中的业务行为，不用于修改闭源 runtime。

## 优化目标

常见优化目标：

- 欢迎语更自然。
- 模式切换更准确。
- action 触发更稳。
- 工具/knowledge 使用更少误触发。
- TTS 口播不暴露协议、Markdown 或工具结果。
- 首句延迟和 TTFT 保持可接受。

## 修改边界

优先修改：

- `workspace.json`
- `modes/*.md`
- `knowledge/*`
- `skills/*/SKILL.md`
- action contract 或客户服务端服务示例中的 action 处理逻辑

不要修改：

- 闭源 runtime 内部实现。
- 编译后的依赖文件。
- `.env.local`、`.env`、运行日志或状态文件。

## 推荐流程

1. 明确业务目标、用户人群、成功事件和红线。
2. 读取当前 workspace、mode prompt、knowledge、action 定义。
3. 先列出拟修改文件和原因。
4. 一次只改一类问题，例如欢迎语、模式切换或 action 边界。
5. 运行 `check` / `doctor`。
6. 需要真实体验时运行 Web 或 Live E2E smoke。
7. 汇报变更、验证结果和剩余风险。

## 验证维度

| 维度 | 示例 |
| --- | --- |
| 模式准确性 | 用户进入、暂停、拒绝、恢复、退出时模式正确。 |
| action 精度 | 应触发时触发，不应触发时不触发。 |
| 工具使用 | knowledge 或 skill 在必要时使用，不把工具输出原样口播。 |
| TTS 体验 | 口播自然，不泄露 JSON、Markdown、协议字段。 |
| 延迟 | 关注 TTFT、首句耗时、工具耗时。 |

## 输出格式

```text
目标：...
修改文件：...
修改摘要：...
验证命令：...
验证结果：...
当前验收级别：Level 1 / Level 2 / Level 2.5 / Level 3
剩余风险：...
```
