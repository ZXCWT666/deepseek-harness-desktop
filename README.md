# DeepSeek Harness 桌面端 · DSH Desktop

> **一款代码同时适配 Windows / Linux / macOS 的本地 Agent 工作台**——Electron 桌面壳 + 内置 Node.js 与 `dsh` CLI，双击即用，无需安装任何环境；模型、工具、Agent 循环、UI 全部可插拔，数据不出本机。

**DSH Desktop** 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`，DeepSeek 开源的 Agent 运行框架，核心架构"一切皆插件"）的桌面客户端：以 Electron 为壳、内置 Node.js 运行时与 `dsh` CLI，在 `http://127.0.0.1:3080` 拉起完整工作台，会话、设置、凭证、附件全部落盘 `$DSH_HOME`（默认 `~/.dsh`）。

---

## 核心特性（按重要程度）

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

## 下载安装

从 [**Releases**](https://github.com/ZXCWT666/deepseek-harness-desktop/releases) 下载对应平台的安装包（当前 **v1.1.0**）：

| 平台 | 推荐 | 备选 |
| --- | --- | --- |
| Windows | `DeepSeek.Harness.Setup.*.exe`（NSIS 安装） | `DeepSeek.Harness.*.exe`（便携）· `*.zip` |
| Linux | `*.AppImage`（chmod +x 后运行） | `*_amd64.deb` |
| macOS | `*-arm64.dmg`（Apple Silicon） | `*-x64.dmg`（Intel） |

安装后双击运行，自动在 `http://127.0.0.1:3080` 拉起工作台。

## 快速开始

1. 下载并运行对应平台安装包（免配置环境，无需安装 Node）；
2. **配置凭证**：设置 → Models 填入 DeepSeek API Key（默认读 `DEEPSEEK_API_KEY` 环境变量，可自定义 baseURL）；
3. **新建会话**：输入任务回车即开始，当前目录为默认 workspace 根；
4. 执行中实时查看思考与工具调用，需审批的工具会弹出授权请求。

## CLI 参考

```powershell
dsh web                          # 启动 Web 工作台（--host / --port / --trusted-host / --no-open）
dsh --profile headless "任务"     # 一次性持久化会话，打印最终答案后退出
dsh plugin --profile web add <路径或包名>    # 安装第三方插件
dsh --profile web --dump-config  # 查看组合后的完整配置树
```

## 插件扩展开发

插件 = host 半（`cordis.patch.yml` 注入 profile）+ 浏览器半（`exports["./client"]` 出货 bundle），经 slot 系统（`ctx.slots.inject` / `register`）挂到侧边栏、设置分区、工具卡片、会话流节点：

```powershell
dsh plugin --profile web add <插件路径或包名>   # 安装（自动同步 dsh.profile.bundles）
dsh plugin --profile web remove <插件名>        # 卸载
```

> profile 变更后需重启应用生效。

## 从源码构建 / 发布

构建工作区位于仓库 `DSH Desktop\`（详见 [DSH Desktop/README.md](DSH%20Desktop/README.md)）：

- **打包**：`electron-builder.yml` 三平台目标（win: nsis/portable；linux: AppImage/deb；mac: dmg/zip）；
- **运行时**：`scripts/fetch-runtime.mjs` 按平台获取官方 Node + dsh 依赖（原生模块按平台安装）；
- **发布链**：`.github/workflows/build-desktop.yml` 四矩阵构建，推送 `v*` tag 自动产出三平台安装包并挂到同名 Release；
- **本机一键发布**：`publish-version.ps1`（自动递增版本号 → 构建 → 推源码 → tag → Release + 修复清单）。

## 架构

```
浏览器表层  Web UI（lazy-CJS 模块 + slot 注入，可插第三方 UI 组件）
宿主服务层  HTTP 服务器 / API 网关 / 信任栅栏 / 附件（sha256 内容寻址）
核心服务层  Agent 主循环 / 会话持久化 / 工具执行 / LLM / 沙箱 / 凭证
插件内核    Cordis（组合式插件内核 + Loader + HMR）
Profile 层  组合包 bundles → cordis.patch.yml → --patch 覆盖
启动器      dsh CLI（--profile / web / headless / plugin）
桌面壳      Electron（内置 Node.js + dsh CLI，托盘/自启）
```

## 关键默认值

| 项 | 值 |
| --- | --- |
| Web 服务 | `127.0.0.1:3080`（`--host 0.0.0.0` 被拒绝；`--trusted-host` 可放行局域网） |
| 工具并行数 | 10 |
| DeepSeek 上下文窗口 | 1,000,000 |
| 压缩触发 / 保留 | 0.8 / 0.16，摘要 ≤8192 tokens |
| goal 轮次上限 | 256（连续 3 轮受阻判定阻塞） |
| 子代理深度 / 工作流 Agent 上限 | 3 / 1000 |
| MCP 工具超时 / 重连 | 60s / 500ms→30s，10 次放弃 |
| 权限预设 | `workspace-write + ask`（默认） |

---

## License

[MIT](LICENSE)
