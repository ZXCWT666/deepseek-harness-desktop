# DeepSeek Harness 桌面端 · DSH Desktop

> 基于 DeepSeek 开源「一切皆插件」（*Everything is a Plugin*）架构的本地 Agent 工作台，内置 Node.js 与 `dsh` CLI，一键启动，模型、工具、Agent 循环全部可插拔。

## 简介

DeepSeek Harness 桌面端（DSH Desktop）是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的本地桌面客户端。它以 Electron 为壳，内置 Node.js 运行时和 `dsh` CLI，双击即可在本地拉起完整的 Agent 工作台——无需手动配置环境，所有数据保存在本机。

DeepSeek Harness 的核心哲学是「一切皆插件」：模型、工具、Agent 循环、技能（Skills）、甚至会话逻辑都可以通过 Cordis 组合包按需叠加或替换。桌面端在此基础上提供开箱即用的图形界面：会话管理、插件仓库、模型配置、任务与子代理可视化、令牌与余额监控等，并可随时通过 `dsh plugin` 安装第三方插件扩展能力，也可以 SSH / 局域网远程访问本机工作台。

## 界面预览

![新会话页面 - DeepSeek Harness 桌面端](docs/screenshot-new-session.png)

*新会话页面：左侧工作区与设置，中间为「探索未至之境」输入区，支持标准模式 / 选择模型 / 全量访问权限切换。*

## 功能亮点

- **一切皆插件**：基于 Cordis 的组合式架构，模型、工具、Agent 循环、指令全是插件，可自行组合、覆盖与替换。
- **本地优先**：服务运行在 `127.0.0.1`，会话、设置、日志全部落盘 `$DSH_HOME`，数据不出本机。
- **完整 Agent 工具箱**：Bash / PowerShell 终端、文件系统读写与搜索、Web 搜索、子代理（subagent）、工作流（workflow）、目标驱动循环（goal）与规划模式（plan mode）、技能（skills）。
- **可视化 GUI**：会话与任务时间线、后台任务面板、插件清单、模型与凭证管理（含 DeepSeek 官方 API 与自定义 `baseURL` / 密钥环境变量）。
- **会话持久化**：JSONL 会话归档（zstd 压缩）+ 检查点与恢复，支持压缩（compaction）控制上下文成本。
- **令牌计量与成本可视**：今日 / 本周 / 本月 Token 消耗与余额状态实时展示（支持第三方状态组件扩展）。
- **安全可控**：沙箱执行、文件系统观察策略、权限审批预设（permission presets），工具超时与重试策略可配置。
- **开放扩展**：`dsh plugin add` 一键安装第三方插件，前端组件可原生注入侧边栏 / 设置页；SSH、局域网信任主机与浏览器交接开箱即用。

## 安装 / 快速开始

### 安装

1. 从本项目 Releases 页面下载最新版安装包，运行安装程序（Windows 一键安装，免配置环境）。
2. 启动 **DeepSeek Harness 桌面端**。应用内置 Node.js 运行时与 `dsh` CLI，启动后自动拉起本地服务（默认 `http://127.0.0.1:3080`），并打开工作台界面。
3. 安装完成后，插件、设置与会话数据统一存放在 `$DSH_HOME` 下。

### 快速开始

1. **配置凭证**：打开「设置 → Models」，填入 DeepSeek API Key（默认读取 `DEEPSEEK_API_KEY` 环境变量，也支持在设置页直接配置；可自定义 `baseURL` 与密钥环境变量名）。
2. **新建会话**：在输入框键入任务，回车即开始——工作台会以当前目录作为默认 workspace 根目录。
3. **观察与介入**：Agent 执行过程中可实时查看思考、工具调用与产出物；需要通过审批的工具会弹出授权请求（可在权限预设中按需放宽）。
4. **查看消耗**：侧边栏实时展示账户余额与今日 Token 消耗，点击可查看本周 / 本月用量明细。

### CLI（进阶）

桌面端同时内置命令行入口，适合脚本化与远程使用：

```powershell
dsh web                          # 启动 Web 工作台（--port / --host / --trusted-host / --no-open）
dsh web --no-open                # 启动服务但不自动打开浏览器（SSH 场景，URL 会打印在终端）
dsh --profile headless "运行测试" # 一次性持久化会话，打印最终答案后退出
dsh plugin --profile web add <路径或包名>   # 安装第三方插件
dsh plugin --profile web remove <插件名>    # 卸载插件
dsh --profile web --dump-config  # 查看组合后的完整配置树（不启动服务）
```

> **远程访问**：SSH 启动时服务仍会打印 URL 行，但跳过自动打开浏览器——由 SSH 客户端或编辑器转发本地地址访问；`--trusted-host` 可声明信任的局域网主机。

## 本仓库内容

- `dsh-balance-status/` — DeepSeek 账户余额 + Token 用量状态组件，注册为 web profile 的原生侧边栏插件（含 host 端 API、前端组件源码、构建与验证脚本），可作为桌面端插件的完整示例。
- `scripts/` — Harness 重启与验证脚本（插件开发调试用）。
- `package.json` / `pnpm-lock.yaml` — 工作区依赖（开发用）。

### 插件开发速览

```powershell
# 安装本地插件到 web profile（会同步 dsh.profile.bundles 清单）
dsh plugin --profile web add file:D:\dsh\dsh-balance-status

# 修改 src/* 后重新构建客户端 bundle，并再次 add 刷新副本
node dsh-balance-status/scripts/build-client.mjs
dsh plugin --profile web add file:D:\dsh\dsh-balance-status
```

> 组合配置（composition）与客户端 bundle 发现均在服务启动时解析，profile 变更后需重启 Harness 应用生效。

## 致谢

- [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) — DeepSeek Harness 本体（Cordis 插件架构、`dsh` CLI 与 Web 表层）
- [deepseek-ai/cordis](https://github.com/deepseek-ai/cordis) — 组合式插件内核

## License

[MIT](LICENSE)
