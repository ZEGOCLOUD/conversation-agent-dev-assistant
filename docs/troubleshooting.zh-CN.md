# 排障指南

先确认当前停在哪一级验收，再选择排障路径。

## Level 1：本地 Gateway

运行：

```bash
./bin/conversation-agent check --project ./pulse-project
./bin/conversation-agent status --project ./pulse-project
./bin/conversation-agent doctor --project ./pulse-project
```

常见问题：

| 现象 | 检查 |
| --- | --- |
| Node 版本过低 | `node --version`，需要 Node.js 20 或更高。 |
| npm 安装失败 | 检查 npm registry、企业 npm mirror、网络代理。 |
| Gateway 端口占用 | `doctor` 和 `status` 输出；不要盲目 kill 无关进程。 |
| LLM 调用失败 | 检查 `.env.local` 是否有 API key，但不要打印密钥内容。 |

## Level 2：客户服务端服务 + Web

检查：

```bash
./bin/conversation-agent start zego-service --project ./pulse-project --daemon
./bin/conversation-agent start web --project ./pulse-project --daemon
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/config/runtime
```

常见问题：

| 现象 | 检查 |
| --- | --- |
| Web 页面打不开 | Web 服务是否启动，端口是否正确。 |
| `/config/runtime` 失败 | 客户服务端服务是否启动，配置路径是否正确。 |
| 创建 AgentInstance 失败 | Gateway internal base URL、control token、ZEGO AppID/Secret 是否配置。 |

## Level 2.5：本地 Cloudflare Tunnel Live Smoke

在客户服务包根目录运行：

```bash
node examples/local-cloudflare-live-e2e/run.mjs --project ./pulse-project
```

如果使用 Named Tunnel 或固定 HTTPS URL：

```bash
node examples/local-cloudflare-live-e2e/run.mjs \
  --project ./pulse-project \
  --public-url https://ca3-live.example.com
```

如果 Web 前端部署在另一台机器：

```bash
node examples/local-cloudflare-live-e2e/run.mjs \
  --project ./pulse-project \
  --web-url https://web-preview.example.com \
  --skip-web
```

常见问题：

| 现象 | 检查 |
| --- | --- |
| `cloudflared` 不存在 | 安装 `cloudflared`，或使用 `--public-url` 指向 Named Tunnel。 |
| Quick Tunnel 没有 URL | 检查网络和 Cloudflare 限流；稳定调试建议 Named Tunnel。 |
| Quick Tunnel 断链后换了 URL | 默认 keeper 应重启 `cloudflared`、重写 `.conversationAgent.local-cloudflare-live-e2e.json`、重启托管 Gateway、更新客户服务端 `/config/gateway-public-url`，并调用 `/agent/register` 重新注册 ZEGO Agent。 |
| tunnel URL 打不开 | 检查 local router 是否启动，`/health`、`/config/runtime`、`/voice/status` 是否能经 router 访问。 |
| Web 资源不对 | 检查 `--web-url` 是否指向正确前端；Web 在不同机器时不要启动内置 Web。 |
| Gateway 未收到 LLM callback | 检查临时 Gateway tunnel config 是否写入 HTTPS tunnel URL，ZEGO RegisterAgent 是否使用该 URL。 |

Level 2.5 只说明本地 tunnel smoke 通过，不能替代云端 Level 3 managed cloud or production acceptance。

## Level 3：真实 ZEGO Live E2E

真实 Live E2E 需要公网 HTTPS 回调地址和 ZEGO 控制台回调配置。

检查：

- Web 是否成功入房。
- 浏览器是否允许麦克风。
- 麦克风音频是否发布。
- 客户服务端服务是否创建 AgentInstance。
- ZEGO 回调是否能到达 Gateway。
- Gateway 是否收到 LLM callback。
- TTS 是否有供应商配置并能播放。
- Web 是否显示字幕、mode、action、Agent 状态和延迟。
- 主动说话和 action feedback 是否写回所属 workspace。
- 如果发布范围包含多 workspace，default、action-validation、isolation-validation 的 AgentInstance callback、prompt、action schema、日志和 canvas 状态是否互不串线。

云端 Level 3 必须从客户 tarball 部署验收，不从源码目录验收；localhost-only 或本地 tunnel-only 都不能作为 managed cloud or production acceptance。如果发布范围包含多 workspace，单 workspace 云端 Live E2E 不能算完整 Level 3。

## 汇报原则

排障汇报中只报告：

- 已运行命令。
- 通过/失败的检查。
- 失败原因的非敏感摘要。
- 下一步建议。

不要报告：

- `.env.local` 或 `.env` 内容。
- secret、token、API key。
- 客户私有数据。
