# DeepSeek Harness 桌面端 · DSH Desktop

> **一款代码同时适配 Windows / Linux / macOS 的本地 Agent 工作台**——Electron 桌面壳 + 内置 Node.js 与 `dsh` CLI，双击即用，无需安装任何环境；模型、工具、Agent 循环、UI 全部可插拔，数据不出本机。

**DSH Desktop** 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`，DeepSeek 开源的 Agent 运行框架，核心架构"一切皆插件"）的桌面客户端：以 Electron 为壳、内置 Node.js 运行时与 `dsh` CLI，在 `http://127.0.0.1:3080` 拉起完整工作台，会话、设置、凭证、附件全部落盘 `$DSH_HOME`（默认 `~/.dsh`）。

---

## 核心特性

### 1.三平台支持：Windows / Linux / macOS

同一套代码直接适配三大桌面系统：

| 平台 | 安装包 |
| --- | --- |
| Windows | NSIS 安装包（`Setup`）· 便携版（`exe`）· zip |
| Linux | AppImage · deb |
| macOS | dmg（Apple Silicon arm64 / Intel x64） |

- macOS 使用原生红绿灯（hiddenInset 标题栏），自动隐藏自绘窗口按钮；
- Linux 开机自启走 XDG autostart；三平台托盘、无边框窗口体验一致；
- 推送 `v*` tag 后 CI 自动构建四矩阵（win / linux / mac-arm64 / mac-x64）并挂到 GitHub Release。

## 下载安装

从 [**Releases**](https://github.com/ZXCWT666/deepseek-harness-desktop/releases) 下载对应平台的安装包（当前 **v1.1.1**）：

| 平台 | 推荐 | 备选 |
| --- | --- | --- |
| Windows | `DeepSeek.Harness.Setup.*.exe`（NSIS 安装） | `DeepSeek.Harness.*.exe`（便携）· `*.zip` |
| Linux | `*.AppImage`（chmod +x 后运行） | `*_amd64.deb` |
| macOS | `*-arm64.dmg`（Apple Silicon） | `*-x64.dmg`（Intel） |

安装后双击运行，自动在 `http://127.0.0.1:3080` 拉起工作台。

### 2.完全自包含：免安装环境，双击即用

- **内置 Node.js 运行时 + dsh 依赖树**随包分发（原生模块按平台安装），无需本机安装 Node / dsh / Python 等任何环境；
- 也支持自动发现本机 npx 缓存 / npm 全局 / PATH 中的 dsh；
- **服务静默自愈**：后台检查器每 1.5s 探测服务，不可达时按 3s→60s 指数退避自动重启，服务就绪自动进入页面，全程不弹阻塞对话框。

### 3.完整 Agent 工具箱

- Bash / PowerShell（含持久 PTY）、文件系统读写与搜索、Web 搜索与抓取；
- **子代理（subagent）**：多 agent 协作，深度上限 3；
- **工作流（workflow）**：脚本化多 agent 编排，Agent 上限 1000；
- **目标循环（goal）**：长任务自动推进（轮次上限 256，连续受阻自动判定阻塞）；
- **规划模式（plan mode）**：先出方案再执行；
- **技能（skills）**：文件系统技能库，按需加载；
- **MCP 外部工具接入**：超时 60s、断线重连 500ms→30s、10 次放弃。

### 4.本地优先与健壮会话

- 会话、设置、凭证、附件**全部落盘本机**（`$DSH_HOME`），数据不出机器；
- 会话 JSONL + zstd 持久化、崩溃轮次自动修复、检查点、SQLite 全文检索；
- 自动压缩（触发 0.8 / 保留 0.16）控制上下文成本。

### 5.模型接入

- DeepSeek 官方路由：上下文窗口 **100 万**，thinking / reasoningEffort 可调；
- pi-ai 通用多提供方适配；
- 5 次重试、指数退避 500ms→10s + jitter。

### 6.安全可控

- 三档权限预设：`read-only` / `workspace-write` / `danger-full-access`（默认 `workspace-write + ask`）；
- 三层沙箱：bwrap（Linux）/ Seatbelt（macOS）/ Windows ACL 受限令牌；
- 凭证文件 0600 原子写，配置只引用密钥、不携带密钥；
- 桌面壳 sandbox + contextIsolation + webSecurity 全开，页面外链统一交给系统浏览器。

### 7.可视化 GUI 与桌面体验

- 会话时间线、Trajectory 轨迹检查器、后台任务面板、插件清单、模型与凭证管理；
- 主题：浅色 / 深色 / 跟随系统；
- **无边框窗口**：内置最小化 / 最大化 / 关闭按钮（悬浮页头），侧边栏 Logo 可拖动窗口，图片查看器等全屏弹层打开时控件自动隐藏；
- **系统托盘**：单击显示主窗口，「关闭时最小化到托盘」可开关；
- **开机自启**：Windows / macOS 原生 API、Linux autostart，设置页一键开关；
- **界面本地化**：自动移除「预览版」徽标，权限选项与推理档位自动转中文（不动聊天内容）。

### 8.一切皆插件

模型、工具、Agent 循环、会话、权限、UI 全部可组合、可替换、可扩展；浏览器表层为 lazy-CJS 模块 + slot 注入，第三方插件可原生注入侧边栏 / 设置页 / 工具卡片 / 会话流节点。

---

## 界面预览

| 新会话页面 | 访问权限选择 |
| --- | --- |
| ![新会话页面](docs/screenshot-new-session.png) | ![访问权限选择](docs/screenshot-access-modes.png) |

| Agent 档位 | 桌面端设置 |
| --- | --- |
| ![Agent 档位菜单](docs/screenshot-reasoning-levels.png) | ![设置页](docs/screenshot-settings.png) |

---
[MIT](LICENSE)
