# DeepSeek Harness 桌面端 · DSH Desktop

> 基于 DeepSeek 开源「一切皆插件」（*Everything is a Plugin*）架构的本地 Agent 工作台。Electron 桌面壳 + 内置 Node.js 运行时与 `dsh` CLI，一键启动，模型、工具、Agent 循环、会话、UI 全部可插拔，数据不出本机。

## 简介

**DeepSeek Harness**（`dsh`）是 [DeepSeek AI](https://deepseek.com) 开源的 Agent 运行框架（agent harness），核心架构是**一切皆插件**：模型适配器、工具、Agent 主循环、会话持久化、权限策略、浏览器界面，甚至 Agent 人设，全部以 Cordis 插件组合包（bundle）的形式按需叠加。其插件内核 [Cordis](https://github.com/cordiverse/cordis) 的设计描述见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper)。

**DeepSeek Harness 桌面端**（DSH Desktop）在此基础上提供开箱即用的本地桌面形态：以 Electron 为壳，内置 Node.js 运行时与 `dsh` CLI，双击启动即在 `http://127.0.0.1:3080` 拉起完整 Web 工作台，无需任何环境配置。全部会话、设置、凭证、附件数据统一存放在 `$DSH_HOME`（默认 `~/.dsh`），本地优先。

> 状态说明：DeepSeek Harness 目前处于 developer preview，官方明确提示存在破坏性变更；本仓库随上游迭代同步更新。

## 界面预览

| 新会话页面 | 访问权限选择 |
| --- | --- |
| ![新会话页面](docs/screenshot-new-session.png) | ![访问权限选择（只读 / 工作区写入 / 完全访问）](docs/screenshot-access-modes.png) |

| Agent 档位（关闭 / 低 / 高 / 最高） | 桌面端设置 |
| --- | --- |
| ![Agent 档位菜单](docs/screenshot-reasoning-levels.png) | ![设置 - 通用设置 / 模型 / 插件 / Agent 预设、外观主题](docs/screenshot-settings.png) |

*新会话页面：左侧工作区与设置，中间为「探索未至之境」输入区，支持标准模式档位、访问权限与模型选择；设置页提供开机自启、托盘、Agent 预设、语言与外观主题等桌面端配置。*

## 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│ 浏览器表层  Web UI（客户端插件系统：lazy-CJS 模块 + slot 注入） │
├─────────────────────────────────────────────────────────────┤
│ 宿主服务层  HTTP 服务器 / API 网关 / 信任栅栏 / 附件 / 静态资源 │
├─────────────────────────────────────────────────────────────┤
│ 核心服务层  Agent 主循环 / 会话持久化 / 工具执行 / LLM / 沙箱  │
│            凭证 / 权限 / 目标 / 计划 / 子代理 / 工作流 / 技能  │
├─────────────────────────────────────────────────────────────┤
│ 插件内核    Cordis（组合式插件内核 + Loader + HMR）            │
├─────────────────────────────────────────────────────────────┤
│ Profile 层  组合包 bundles → cordis.patch.yml → --patch 覆盖   │
├─────────────────────────────────────────────────────────────┤
│ 启动器      dsh CLI（--profile / web / headless / plugin）    │
├─────────────────────────────────────────────────────────────┤
│ 桌面壳      Electron（内置 Node.js + dsh CLI，托盘/自启）      │
└─────────────────────────────────────────────────────────────┘
```

下面按层自底向上展开每个机制的细节。

---

## 一、启动链路与插件内核

### 1.1 dsh CLI（启动器）

`dsh` 只解析自己的 flag，第一个无法识别的 token 之后的所有内容原样交给被引导的 profile 应用：

| 命令 | 用途 |
| --- | --- |
| `dsh --profile <name>` | 启动 `$DSH_HOME/profiles/<name>` 下的指定 profile |
| `dsh web` | `--profile web` 的别名（浏览器表层组合） |
| `dsh --profile headless "任务"` | 运行一个全新的持久化会话，打印最终答案后退出 |
| `dsh plugin --profile <name> <pnpm args>` | 在 profile 目录转发给 pnpm 管理插件（add / rm / list…） |
| `dsh --profile <name> --help` | 查看该 profile 应用的参数（不是启动器的） |
| `dsh --dump-config` / `--dump-default-config` | 离线打印组合后的配置树（含 / 不含用户层） |
| `dsh --patch <path>` | 追加一个 patch 覆盖层（可重复） |

- 运行命令时的**当前目录即默认 workspace 根**；
- `web` 与 `headless` profile 首次使用时从随附模板自动初始化，其余 profile 必须通过 `dsh plugin` 创建；
- 无效命令、跨模式选项、配置错误、启动失败一律以非零状态退出。

### 1.2 Profile 与配置树叠加

profile 目录（`$DSH_HOME/profiles/<name>/`）包含：

- `package.json` —— 树外插件依赖；
- `dsh.profile` —— profile 清单，其中 `bundles` 是有序的组合包列表；
- `cordis.patch.yml` —— 用户自己的 patch 层。

配置树以**空根为起点**，按以下顺序叠加：

1. `dsh.profile.bundles` 中各组合包的 patch（`@deepseek-ai/dsh-base` 永远是第一层，提供模型适配器、工具、持久化、策略、设置/凭证、遥测、子代理等全部基础行）；
2. profile 自身的 `cordis.patch.yml`；
3. home 级 `$DSH_HOME/cordis.patch.yml`（优先级更高，先逐 profile 再 home）；
4. `--patch` 覆盖层（最上）。

细节规则：

- 用户 patch 按 id 定位会**替换目标行整个 `config`**（不做深度合并，未改字段须重述）；`insert` 添加条目；
- patch 文件为空或只有注释会直接抛错，禁用某层请用 `[]`；
- `!!js` 表达式在该行声明的注入全部激活后、按该行插件自身的 ctx 求值（因此 `dsh-cmdline` 的 flag 值可在配置里直接读 `ctx.webStartup.host` / `ctx.webStartup.port`）；
- 组合包在 manifest 中以 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` 声明；
- `healProfilesModuleFallback` 维护 `$DSH_HOME/profiles/node_modules` 的扁平符号链接，使裸插件名能经 Node 常规向上查找解析。

### 1.3 启动流程（dsh-app-boot）

1. **环境快照**：`loadLayeredEnv` 冻结「继承进程环境 → 项目 `.env`（cwd）→ 用户 `.env`（`$DSH_HOME/.env`）」三层，并拒绝 bootstrap-only 变量；
2. **建根 ctx**：创建根 Cordis Context，向 Loader 的 `!!js` 暴露 `dshHomePath(...)`，安装 Loader；
3. **挂载 include 树**：注册 `cordis:include` / `cordis:group` builtin，`loadProfile` 双锚点解析 bundles（先 dsh 安装目录，再 profile 自身 node_modules），`composeEntries` 用 include 的 `applyEntryPatches` 叠加各 patch 层——**与实际启动内容严格一致**；
4. **结算审计**：include 树结算后 `assertEntriesLoaded` / `assertEntriesActivated` 检查未解析插件与未激活 fiber，失败则 dispose 部分构造的上下文并以一行 stderr + `exit(1)` 收场（`installFailLoud`）；
5. **注入源码上下文**：向系统提示词插入 `harness:source` 段（harness 身份之后、persona 之前），告知 Agent 代码所在路径并警示用 `pwd` 确认。

### 1.4 Cordis 内核机制

- **scope（作用域上下文）**：`dsh-scope` 提供带标签的 Cordis Context，Agent 主循环为每个存活 agent 建一个 scope，agent preset 常驻挂载是其 agents 的父 scope；事件沿父链向上放行、注册视图沿链向下继承。
- **settings（用户设置服务）**：按 namespace 分节；解析优先级为 schema 默认值 → 注册方 `base`（entry 配置子集）→ 用户文档分节。`mutate` 支持 `set/unset` 路径操作避免误删未回传的机密；`expectedRevision` 实现乐观并发，冲突拒绝为 `SETTINGS_CONFLICT`。文件后端默认 `$DSH_HOME/settings.yaml`（YAML/JSON），写入是持跨进程写锁的读-改-写，`0600` 原子落盘，watcher 按内容抑制自写。
- **storage（非会话数据）**：具名后端注册表（json、sqlite），`dsh-storage-json` 每个单元一个 `<unit>.json`，内存态为最终权威，每次写入临时文件 + fsync + 原子 rename 整体重发；`dsh-storage-domain` 提供 zod schema 约束的领域数据形式，同领域写串行化。
- **commands（面向用户的命令）**：`/` 开头的小写命令注册表，支持 `recordInput`、图片输入声明、可中止 handler；在 agent 上下文中注册则精确到该 agent 并遮蔽同名全局；命令结果**绝不进入模型历史**。
- **schedule（持久提醒）**：三个会话内工具 `schedule_create / schedule_list / schedule_delete`，支持 `after_seconds`、绝对 `at`（UTC/IANA 时区、DST 缺口拒绝）、≥5 分钟的 `every_seconds`；记录持久化、回放校验严格（拒绝未知版本/重用 id/形状不匹配）。
- **repeat-tool-reminder**：监视完全相同的连续工具调用（规范化参数比较），达到 `thresholds: [3,5,8]` 时注入逐级增强的提醒（经 `additionalContexts`，绝不替换内容）。
- **invariants**：可配置运行时不变式注册表（`enabled` / allowlist / blocklist），失败原子 dispose 相关子级。
- **HMR 双通道**：`cordis-plugin-hmr` 负责源码热重载（沿 Node 模块图溯源、只重载受影响的插件条目、框架级变化回退 `loader.exit()` 重启进程，路径 canonicalize 规避 Windows 8.3 别名）；`dsh-app-boot.watchUserPatches` 负责用户 patch 文件热重载（事务性重组整个 patch 列表，失败保留最后可用树并广播 `hmr/config-update-failed`）。

---

## 二、会话与持久化

### 2.1 落盘格式

- 会话以 **JSONL（zstd 压缩帧）** 持久化，路径形如 `<root>/--<normalized-cwd>--/<encoded-id>/session.jsonl.zstd`，默认 zstd 压缩约省 60% 体积；
- `packChunks` 开启时打包 chunk 分片行；首行是 `SessionHeader`（含 `delegationDepth` / `agentPreset` 等元信息）；
- 本地存储按天分桶，只重读发生变化的日志文件。

### 2.2 崩溃恢复与检查点

- 恢复时不截断崩溃轮次，而是用**合成 closer**（`tool/result` + `step/end` + `turn/end{interrupted}`）把中断的轮次「正式关闭」，会话日志保持自洽；
- `readFrom` 提供只读后缀窗口；checkpoint 策略在 `llm/stream`、顶层工具正文、pre-step 边界三种时机 flush。

### 2.3 投影缓存与全文检索

- 投影缓存（`session_projcache`）按 `stateVersion` 失效；冷会话恢复走「缓存行 → restoreFloor → readFrom → restore → fail-soft 回写」阶梯，两个读取面都不调用会修复的 `load()`；
- 会话查询另有独立的 **SQLite FTS5（unicode61）全文索引**，TEMP 行遮蔽持久基库。

### 2.4 上下文压缩（compaction）

| 配置 | 默认值 |
| --- | --- |
| `thresholdRatio` | 0.8（上下文占用率达 80% 触发） |
| `retainRatio` | 0.16（保留最近 16%） |
| `maxTokens` | 8192（摘要输出上限） |
| `compactionRetries` / `maxOverflowRetries` | 1 / 1 |
| `auto` | true |

成功序列为 `start → summary → 单个 user/message replace → end`；崩溃锁 = 有 start 无 end。另有 tool-result pruner（阈值 8192 / 4096 / 1024）。

### 2.5 Token 计量口径

- 固定启发式：每 token ≈ 4 字符 + 结构开销，**无精确 tokenizer**；
- 提供方返回的用量仅在与规范 envelope 完全匹配时复用；`projectedTokens` 让压缩效应即时反映；占用率是刻意近似，不用于门控。

---

## 三、Agent 编排

### 3.1 主循环（dsh-agent-loop）

每步流程：`systemPrompt.assemble()` 组装系统提示词 → 可见工具 schema + 派生历史 → `ctx.llm` 流式请求 → 工具调用按 `pre-execute → execute → post-execute → finalizeContent → result` 管线执行。

- 系统提示词段序：**身份 −100 → persona 0 → 工具引导 100–199 → 动态上下文 → waterfall → complete**；
- 工具**并行执行上限 `maxParallelToolCalls = 10`**；
- 工具结果过大时由 spill 策略（见 5.8）控制在模型上下文之外。

### 3.2 目标（goal）

- 事件溯源、同会话内唯一当前目标，`GoalRef{id, revision}` CAS 提交；
- 上限 `maxGoalRounds = 256`；连续受阻 `blockedAfterConsecutiveRounds = 3` 轮判定阻塞；
- 续行从不持久化：会话启动即停用，需显式 `resume` 恢复；提示词 `<goal_round>` 携带 JSON 引用的目标与轮次。

### 3.3 规划模式（plan mode）

软引导而非强制：`/plan` 进入、`/plan off` 或模型获批的 `exit_plan_mode` 退出；以 `plan/mode` 日志事件与计划详情 UI 配合呈现。

### 3.4 子代理（subagent）

单个委派原语：

- **fork**：继承父 agent 已完成轮次的对话前缀；**spawn**：从空对话开始；
- 委派深度上限 `maxDepth = 3`；子代理会话独立持久化，UI 上有 lineage 谱系导航；
- 可继续对话（Activation 用 inbox 作 FIFO，`followup()` 不抢控）。

### 3.5 工作流（workflow）

模型编写 JavaScript 脚本、扇出多个 agent 的编排原语，提供 `agent() / parallel() / pipeline() / phase() / log()` 钩子：

- 每次运行一个 worker thread + `node:vm` 执行脚本（**注意：不是安全边界**）；
- 上限：`maxTotalAgents = 1000`、`maxConcurrentAgents = 0`（按 CPU 自适应）、`maxItemsPerCall = 4096`、`syncTimeoutMs = 5000`、`disposeGraceMs = 5000`；
- 持久化的顶层运行会在 UI 中重建为独立会话节点，可实时打开成员子会话。

### 3.6 Ralph 循环

另一种面向「新鲜 Agent 迭代」的执行原语：每轮启动无对话种子全新 agent，`maxRounds = 256`，轮间只传递有界结构化报告（`maxHandoffChars = 16384`）。

### 3.7 技能（skills）

- 定义：`<root>/<name>/SKILL.md`（或 `<name>.md`），frontmatter 必填 `name`（kebab-case）与 `description`，可选 `whenToUse` / `disable-model-invocation` / `user-invocable`；
- 发现：按 rank 扫描（数字越大越晚）：

| rank | 位置 |
| --- | --- |
| 100 | 项目 `.dsh/skills` |
| 200 | 项目 `.agents/skills` |
| 300 | 自定义目录 |
| 400 | `<dshHome>/skills` |
| 500 | `<agentsHome>/skills` |

- 项目根 = 最近的 `.git` 祖先；`dsh-tool-skill` 把技能内容以 `<available_skills>` / `<skill_content>` 注入模型；`dsh-skill-badge` 提供技能徽章（默认关闭）。

---

## 四、工具执行与沙箱

### 4.1 Shell 调用链

- **bash / pwsh 单次执行**：`dsh-shell`（服务定义）→ `dsh-bash-local` / `dsh-pwsh-local`（每次 spawn 非登录 shell，不保留状态）→ `dsh-subprocess-local`（detached 进程树 + 有界输出 spill）；
- **持久 shell**：`dsh-terminal` + `dsh-terminal-bash` + `tool-bash-persistent` / `tool-pwsh-persistent` 提供 owner 隔离的 PTY；
- 平台门控：Windows 上 bash 栈整体禁用，自动挂载 pwsh 栈（`dsh-base` 的 patch 中 `!!js process.platform` 门控）。

### 4.2 沙箱三层结构

1. **词汇层**（`dsh-sandbox`）：sandbox 能力声明；
2. **实现层**（`dsh-sandbox-local`）：Linux 优先 bwrap、其次 landlock；macOS 用 Seatbelt；Windows 经 `dsh-sandbox-windows-acl` 的 **WRITE_RESTRICTED 受限令牌**；
3. **策略层**（`dsh-sandbox-policy`）：默认 `read-only`，可按会话以 `sandbox` / `mode` 事件覆盖。

文件效果策略：Windows 经 ACL 受限令牌 runner 执行；`fs-sandbox` 围栏 `ctx.fs` 写入并复用 `writableRoots`；Windows temp 仅 `workspace-write` 授予会话私有子目录 `<temp>\dsh-<hash>`。

### 4.3 文件系统四层栈

`dsh-tool-fs`（模型工具面）→ `dsh-fs-observation-policy`（事件门禁）→ `dsh-fs`（12 个原语：read / write / edit / glob / grep / info / list 等）→ `dsh-fs-local`（实现）。策略核心是**已观测状态 + 版本 CAS**：模型基于观测快照修改，版本失配即拒绝。

### 4.4 后台任务与超时

- **jobs**：`dsh-jobs` → `dsh-jobs-local`（每 owner 并发上限 `maxConcurrentJobsPerOwner = 10`）→ 工具面 `job_output / job_list / job_kill`；
- **工具超时**：`dsh-tool-call-timeout-policy` 零配置生效（`TOOL_TIMEOUT`）；bash/pwsh 执行器另有硬预算（bash 120s / pwsh 600s）；Code runtime 用 `computeMs / maxWallMs / maxOutputBytes`。

---

## 五、模型接入、凭证与网络

### 5.1 LLM 抽象（dsh-llm）

- `LlmRuntime` = 适配器注册表 + **单一流式接口**；流协议为原始分片：`block-start / text-delta / reasoning-delta / tool-call-delta / block-end / usage / finish`，失败统一收束为 `finish {kind: 'error'|'aborted'}`，绝不在流 API 上跨抛；
- 错误分类决定可否重试：上下文窗口溢出、配额、空响应（默认可重试）、**格式错误凭证（刻意不可重试）**；
- 服务只持有重试策略、不执行重试；不缓存、不限流。

### 5.2 DeepSeek 官方路由（dsh-llm-deepseek）

`deepseek-official` 路由，直接 fetch + SSE 分帧：

| 项 | 默认值 |
| --- | --- |
| `apiKeyEnv` | `DEEPSEEK_API_KEY` |
| `baseURL` | `https://api.deepseek.com`（`$DEEPSEEK_BASE_URL` 可覆写） |
| `thinking` | enabled |
| `reasoningEffort` | `off / low / high / max`（省略 ⇒ `high`） |
| `maxTokens` | 256000 |
| `streamIdleTimeoutMs` | 300000（5 分钟） |
| `maxRequestFilesBytes` / `maxImagesPerRequest` | 128MiB / 600 |
| `defaultContextWindow` | **1,000,000** |

- 内置模型：`deepseek-v4-flash` / `deepseek-v4-pro`（纯文本）、`deepseek-v4-flash-vision-exp`（支持图片，像素预算 640000、单图 ≤1MiB）；
- 图片经 `POST /files` 上传为 `{type:"file", file_id}` 块，失败回退内联 base64；
- 请求携带归因头 `x-deepseek-harness-user-id` / `-session-id`。

### 5.3 通用多提供方（dsh-llm-pi-ai）

基于 pi-ai 的适配器，profile 字典以路由为键（catalog 提供端点/协议/模型默认值，可逐字段覆盖）：`defaultContextWindow 262144`、`defaultMaxTokens 32768`、`streamIdleTimeoutMs 5 分钟`；`supportedProtocols()` 刻意窄于 pi-ai 全集（排除 Bedrock / Vertex / Azure / Codex 等需额外凭据的协议）。

### 5.4 重试策略（dsh-llm-retry）

在 agent 失败步骤边界执行（`agent/request-error`），每次适配器调用即一次提供方尝试：

- **normal 模式**：对 `EMPTY_RESPONSE / RATE_LIMIT / SERVER / TIMEOUT / TRANSPORT` 重试 5 次，**有界指数退避 500ms → 10s + 10% jitter**；
- **always 模式**：先请求下游恢复，再无上限重试；
- 有效的 `providerRetryAfterMs` 替换本地退避且不加 jitter；重试等待前追加 `llm/retry` 事件。

### 5.5 凭证系统

原则：**配置只引用机密、不携带机密**；消费方按操作解析（LLM 每次模型请求解析一次，不跨操作缓存）。

引用（`CredentialRef` = 环境变量名）解析优先级：

1. 继承的进程环境（只读，恒最优先）；
2. `$DSH_HOME/.credentials.yaml`（`set` / `unset` 可写，带版本 YAML，目录 `0700`、文档 `0600`，POSIX 下发现 group/other 权限位直接拒绝读取）；
3. `<cwd>/.env`（project-env）；
4. `$DSH_HOME/.env`（user-env）。

另一键空间是记录（`CredentialKey = <owner>/<id>`，用于 OAuth grant / ambient 认证），`modifyRecord` 是唯一写路径并跨进程持锁。缺失抛 `MISSING_CREDENTIAL`、非法抛 `INVALID_CREDENTIAL`。安全界线：挡得住其他 OS 用户，挡不住模型自身（工具进程同 UID）。

### 5.6 MCP 客户端（dsh-mcp-client）

- 桥接外部 MCP 服务器，工具以 `mcp__<serverName>__<rawName>` 注册进 `ctx.tools`（与 Claude Code / Codex 同形，规范化 64 字符 + 确定性 12 位 hash 防折叠）；
- 传输：`stdio` 与 `streamable-http`；**只桥接工具**，不桥接资源/提示词；
- 默认 `toolCallTimeoutMs 60000`；重连默认开启（500ms 起指数退避 → 30s 封顶，10 次后放弃并注销工具）；
- `notifications/tools/list_changed` 触发整世代重同步；图片是唯一持久化丰富结果桥接（PNG/JPEG/WebP/GIF）。

### 5.7 Web 搜索与抓取

- `dsh-web` 是搜索/抓取能力 seam（`ctx.web`）；DeepSeek 提供方走 **Anthropic 兼容 Messages API**（`POST https://api.deepseek.com/anthropic/v1/messages`），启用原生 `web_search_20250305` 服务器工具（默认 `model deepseek-v4-flash`、`maxTokens 4096`、`maxUses 5`）；
- **严格模式**：响应无 `web_search_tool_result` 块即报错，绝不从模型文本抓 URL；
- 工具面 `web_search`（默认 4 路并发、8 条结果、30s 超时）与 `web_fetch`（HTML 经 turndown 转 markdown，30s 超时、输出 ≤200K 字符）。

### 5.8 Spill（超大工具结果出上下文）

`tools/post-execute` 转换器：纯文本工具结果超过 `maxInlineBytes`（省略即禁用）时，把完整文本持久化到会话级私有文件，替换为**有界首尾预览 + 定位信息 + 取回指引**；替换内容严格 ≤ `maxInlineBytes`（先扣通知预算再缩预览）。存储为 `<root>/session-<hash>/<random>-<safeName>`（`0700` / `0600` / 排他创建）；存储失败保留内联结果，绝不把成功调用标记为失败。

### 5.9 动态 Cordis 包（dsh-tool-cordis）

五个自引用工具：`cordis_inspect`（只读报告运行现场）、`cordis_define`（登记包，预检不执行）、`cordis_run`（vm 沙箱求值 host 半 + 投递浏览器半，经 `cordis/request-run` 往返由页面批准）、`cordis_stop`、`cordis_undefine`。动态包只存在于共享进程内存、以会话为界，不写文件、不跨重启存续。**vm 沙箱隔离全局但不是安全边界**——授予它应像授予 bash 一样慎重。

---

## 六、Web 表层与宿主服务

### 6.1 服务拆分（谁是谁）

- `dsh-host-webserver`：真正的 HTTP 服务器（node:http，exact/prefix/upgrade 三类路由 + 唯一 fallback 席位；`host` 仅接受 `127.0.0.1` / `0.0.0.0`）；
- `dsh-host-frontend-static`：SPA dist 的唯一 fallback 所有者（index 走 renderIndex）；
- `dsh-web-app`：浏览器表层组合包——启动参数、浏览器清单、LAN 信任采样、`DSH_WEB_URL` 注入；
- `dsh-web`：**注意**——它是 Web 搜索/抓取能力 seam，不是 HTTP 服务器。

### 6.2 启动参数（dsh web）

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `--host` | `127.0.0.1` | 绑定地址；**`0.0.0.0` 被有意拒绝** |
| `--port` | `3080` | 端口；`0` = 由系统分配空闲端口 |
| `--trusted-host` | — | 浏览器信任栅栏额外接受的 authority（host 或 host:port，可重复） |
| `--no-open` | 关闭 | 不自动打开默认浏览器 |
| `--help` | — | 应用自己的帮助 |

本地启动默认自动打开浏览器；SSH 启动只打印 URL 行（转发地址由 SSH 客户端/编辑器持有）。

### 6.3 API 网关与信任栅栏

- **HTTP/RPC 网关**（`dsh-host-apiproxy`）：`/api` POST + SSE 事件流 + `POST /api/respond`，强制 application/json；含 `session.export` 流式 ZIP、workspace/session 重连基线、agentPreset / command / skill / settings / credentials / llm 等全域接口；
- **Typert RPC**（`dsh-api-gateway` + `dsh-typert-*` 三件套）：由业务反射 + Zod schema 生成远程调用产物，宿主方法以末参 `AbortSignal` 支持协作式取消；
- **信任栅栏**：服务绑定后采样一次 LAN 信任（bind 派生 + `--trusted-host`）作为 `/api` 前缀级放行依据；**高特权域（目录选择、openPath、agentPreset 写操作、settings、credentials、llm）只接受环回同源请求**。

### 6.4 权限预设（permission presets）

| 预设 | 效果 |
| --- | --- |
| `read-only` | read-only + ask |
| `workspace-write` | workspace-write + ask（**默认**） |
| `danger-full-access` | danger-full-access + never |

`custom` 只能推导、不能选中。

### 6.5 附件管线

浏览器 base64 → 限额校验（≤20 张 / ≤200MiB）+ 图像校验 → 规范化（EXIF 处理、8-bit sRGB、长边 ≤2048px、≤4MiB）→ 原子发布到 `<DSH_HOME>/attachments/v1/objects/<sha256-prefix>/<sha256>`（**sha256 内容寻址**）→ 会话只存引用 → 请求时派生确定版本（`request-images/`）以 `ImageBlock` 拼入模型。

### 6.6 headless 与 web 的差异

- **headless**：单任务组合，无 Host/HTTP/Web runtime/浏览器插件、无端口、禁 HMR；任务经位置参数传入，最终答案打印到 stdout，经 `ctx.appExit` 以 0/1 退出；
- **web**：完整浏览器表层——HTTP 服务器 + agent-presets（每会话一个预设）+ 浏览器插件名录 + `window.__DSH_BOOT__` 启动图。

---

## 七、浏览器 UI 层

### 7.1 模块加载系统（client-modules）

- Node ESM loader 的浏览器端对等，以**惰性 CJS 表**实现：执行插件 bundle 只注册 factory（`window.__ModuleLoader__.load({id, factory})`），副作用在 factory 闭包内、**物化时**运行；
- 解析分支顺序：平台种子词 → 记忆化 → 模块图记录（`window.__DSH_BOOT__`）→ 已登记 factory → 异常；
- 插件浏览器半经 `exports["./client"]` 出货，由 Node 侧扫描 Loader 配置发现 `dsh.client` 包并写入启动图，经 `/plugins` 提供文件 + sourcemap；
- **约束**：从 `@deepseek-ai/dsh-client-runtime` 导入值必须用 `/client` 子路径，否则会内联出第二个模块实例。

### 7.2 Slot 注入（第三方插件进 UI 的方式）

`ctx.slots.inject(slotName, callback)` 声明感知注入（声明存在时同步执行、否则等待），内部 `ctx.slots.register({name, key}, Component)` 注册条目。典型挂载点：

- `tool.call.toolview` —— 为工具注册自定义展示卡片；
- `conversation.chat.node` —— 为会话流注册新的业务行（类型化 `ChatNodeDataMap` 注册表，无需改中央 renderer）；
- `sidebar.workspaces` / `sidebar.settings` / `settings.section` / `settings.plugins.tab` / `settings.onboarding` —— 侧边栏与设置页；
- `conversation.composer` / `conversation.input.overlay` / `conversation.view` —— 输入区与视图标签页（Trajectory 等）。

### 7.3 客户端 HMR

浏览器订阅 SSE（`GET /plugins/events`），每个 `rebuilt` 帧按「invalidate → prefetch → registry.delete → 排空旧 fiber → 移除样式 → refresh → fiber.await」串行重载一个插件；依赖方由 Cordis 自身级联重载（fiber 激活 epoch 串联提供方 uid）。数据层（连接、Session 对象）不受影响；React 组件状态会随重建丢失（有意为之）。

### 7.4 主题系统

基于 `--dsw-*` token 基础样式表（静态尺度 + 别名语义层）；`light / dark / system` 三档偏好（system 经 `prefers-color-scheme` 解析）；`ui-theme` 只发布不可变快照、绝不接触 DOM——由 `ui-layout` 应用（`html color-scheme`、`body[data-ds-dark-theme]`、别名 token 内联变量）。五张样式表（base / design-platform / scrollbar / gradient-shadow-text / shiki）作为插件全局样式注入，卸载即移除。

### 7.5 设置架构

`ui-settings` 只提供 `settingsScope` / `settingsSchema` 与 slot 类型声明（`settings.trigger/header/close/action/section/plugins.tab/onboarding`），呈现内容由各功能贡献：模型页（汇聚 `llm.providers` + `settings.describe` + `credentials.describe`，密钥经 `credentials.set` 只写存储、`settings.yaml` 从不携带密钥值）、插件配置、插件列表、通用/引导。写入以命名空间 revision 围栏并发冲突。

### 7.6 会话渲染与轨迹

- 每个 Session 把连续事件窗口交给 `ConversationNodeAssembler`，插件注册业务 Definition 映射事件为稳定节点（State 在唯一 start 事件创建、update 折叠）；
- **Trajectory**：按轮次组织的虚拟化事件记录表（用户/助手/工具/嵌套子工具可筛选），选中打开局部检查器（token 用量、耗时、输入输出），不读取也不改变聊天快照；
- 工具调用渲染为可递归展开的 `ToolCallTree`，经 keyed slot 分发，与详情栏共用 terminal/read/diff/search/web 纯卡片模型。

---

## 八、桌面壳

- **Electron 封装**：系统托盘常驻，内置 Node.js 运行时与 `dsh` CLI（`resources/node`、`resources/dsh`）；
- 启动即拉起 `dsh web --no-open` 本地服务（`127.0.0.1:3080`）并在应用内呈现工作台；
- 桌面端设置提供**开机自动启动**、**关闭时最小化到托盘**、Agent 预设、语言（中文/英文）、外观主题（浅色/深色/跟随系统）、繁忙时 Enter 行为（排队发送）等选项；
- 数据与配置统一位于 `$DSH_HOME`，卸载/迁移不影响会话。

### 桌面端构建工作区（DSH Desktop/）

本仓库的 [`DSH Desktop/`](DSH%20Desktop/README.md) 目录是桌面端 v1.0.0 的**纯壳封装构建工作区**：Electron 外壳（`shell/main.js`）只负责窗口、服务自愈、托盘与等待页，界面本身由内置 `dsh web` 服务提供。包含两个已验证的修复（图片查看器关闭按钮被顶部空条遮挡、等待页鲸鱼与字标间距过大），以及一键构建脚本：

```powershell
# 一键重建 asar → 刷新便携包 → 写入 exe 版本号 → 校验 →（-Zip 重新压缩）
powershell -ExecutionPolicy Bypass -File "DSH Desktop\build.ps1" -Version 1.0.0 -Zip
```

> 便携版安装包（`DeepSeek Harness-1.0.0.zip`）因超出 GitHub 单文件 100MB 限制不入库，通过 Releases 发布；详细构建/部署/回滚说明见 [`DSH Desktop/README.md`](DSH%20Desktop/README.md)。

---

## 关键默认值速查

| 项 | 值 |
| --- | --- |
| Web 服务地址 | `127.0.0.1:3080` |
| 主循环工具并行数 | 10 |
| LLM 重试 | 5 次，指数退避 500ms→10s + 10% jitter |
| DeepSeek 上下文窗口 | 1,000,000（`defaultContextWindow`） |
| DeepSeek 默认模型档位 | `reasoningEffort: high`，`thinking: enabled` |
| 凭证文件 | `$DSH_HOME/.credentials.yaml`（`0700` / `0600`） |
| 压缩触发 / 保留 | 0.8 / 0.16，摘要 ≤8192 tokens |
| 会话落盘 | JSONL + zstd，`<root>/--<cwd>--/<id>/session.jsonl.zstd` |
| goal 轮次上限 / 阻塞判定 | 256 / 连续 3 轮 |
| 子代理深度 / 工作流 agent 上限 | 3 / 1000 |
| MCP 工具超时 / 重连 | 60s / 500ms→30s，10 次放弃 |
| 后台任务每 owner 并发 | 10 |
| 权限预设 | `workspace-write + ask`（默认） |
| 附件限额 | ≤20 张 / ≤200MiB，长边 ≤2048px、≤4MiB |

---

## 功能亮点

- **一切皆插件**：模型、工具、Agent 循环、会话、权限、UI 全部可组合、可替换、可扩展；
- **本地优先**：服务运行在 `127.0.0.1`，会话/设置/凭证/附件全部落盘 `$DSH_HOME`，数据不出本机；
- **完整 Agent 工具箱**：Bash/PowerShell 终端（含持久 PTY）、文件系统读写与搜索、Web 搜索与抓取、子代理、工作流、目标循环、规划模式、技能、Ralph 循环、MCP 外部工具接入；
- **可视化 GUI**：会话时间线、Trajectory 轨迹检查器、后台任务面板、插件清单、模型与凭证管理、权限预设切换、Agent 档位选择；
- **健壮会话**：zstd JSONL 持久化、崩溃轮次合成关闭、检查点、FTS5 全文检索、自动压缩控制上下文成本；
- **Token 与成本透明**：固定启发式计量 + 提供方用量复用，侧边栏余额与用量实时展示；
- **安全可控**：三档权限预设、三层沙箱（bwrap/landlock、Seatbelt、Windows ACL 受限令牌）、文件观察策略、凭证文件 0600 原子写、配置只引用不携带密钥；
- **开发友好**：客户端插件 HMR、动态 Cordis 包（浏览器半 + host 半）、`--dump-config` 离线检查配置树。

---

## 安装 / 快速开始

### 安装

1. 从 Releases 下载安装包（Windows 一键安装，免配置环境）；
2. 启动 **DeepSeek Harness 桌面端**，应用自动拉起本地服务（`http://127.0.0.1:3080`）并打开工作台；
3. 数据统一存放于 `$DSH_HOME`。

### 快速开始

1. **配置凭证**：设置 → Models 填入 DeepSeek API Key（默认读取 `DEEPSEEK_API_KEY` 环境变量，可自定义 `baseURL` 与密钥环境变量名）；
2. **新建会话**：输入任务回车即开始，当前目录为默认 workspace 根；
3. **观察与介入**：实时查看思考、工具调用与产出；需审批的工具弹出授权请求（可调整权限预设）；
4. **查看消耗**：侧边栏实时展示余额与今日 Token 消耗，点击查看周/月用量明细。

### CLI 参考

```powershell
dsh web                          # 启动 Web 工作台（--host / --port / --trusted-host / --no-open）
dsh --profile headless "任务"     # 一次性持久化会话，打印最终答案后退出
dsh plugin --profile web add <路径或包名>    # 安装第三方插件
dsh plugin --profile web remove <插件名>     # 卸载插件
dsh --profile web --dump-config  # 查看组合后的完整配置树（不启动服务）
```

---

## 插件扩展开发

DeepSeek Harness 坚持「一切皆插件」，桌面端同样原生支持通过 profile 插件扩展：

1. **host 半**：以组合包（bundle）注入 profile，声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`，由 `dsh plugin` 命令统一安装与管理；
2. **浏览器半**：包内声明 `dsh.client`（platform、inject 依赖），`exports["./client"]` 出货客户端 bundle；经 `/plugins` 由客户端模块系统加载；
3. **UI 注入**：`ctx.slots.inject(name, cb)` + `ctx.slots.register({name, key}, Component)` 挂到侧边栏、设置分区、工具卡片、会话流节点等 slot；
4. **数据通路**：host 侧挂 HTTP 端点或服务事件，浏览器侧经 `ctx.remote` / 会话投影消费。

```powershell
# 安装插件（本地目录或 npm 包均可，会自动同步 dsh.profile.bundles 清单）
dsh plugin --profile web add <插件路径或包名>

# 修改插件源码后重新构建客户端 bundle，并再次安装刷新副本
dsh plugin --profile web add <插件路径或包名>
```

> 组合配置（composition）与客户端 bundle 发现均在服务启动时解析，profile 变更后需重启 Harness 应用生效。

---

## 致谢

- [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) — DeepSeek Harness 本体（Cordis 插件架构、`dsh` CLI 与 Web 表层）
- [cordiverse/cordis](https://github.com/cordiverse/cordis) — 组合式插件内核（时空可组合性范式）

## License

[MIT](LICENSE)
