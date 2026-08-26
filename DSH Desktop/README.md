# DSH Desktop 桌面端构建工作区（版本 1.0.3）

DeepSeek Harness 桌面端的源码与构建产物集中目录。桌面端为「纯壳封装 + 服务自愈」：
Electron 外壳（`shell\main.js`）只做窗口与等待页，界面本身由内置 `dsh web` 服务
（`DeepSeekHarness-1.0.3\resources\dsh` + `node`）提供。

## 目录结构

```
DSH Desktop\
├── DeepSeekHarness-1.0.3\        完整便携版应用（可直接运行 DeepSeek Harness.exe）
├── DeepSeek Harness-1.0.3.zip     上述目录的 zip 压缩包（255 MB）
├── shell\                        桌面端外壳源码（构建 app.asar 的输入）
│   ├── main.js                   主进程：窗口、服务自愈、托盘、等待页、内置窗口控件
│   ├── package.json              app 版本（当前 1.0.3）
│   └── assets\
│       ├── brand-mark.svg        等待页鲸鱼图标
│       ├── brand-name.svg        等待页 deepseek HARNESS 字标
│       └── tray.png              托盘图标
├── scripts\                      构建 / 验证脚本（Node.js 编写，见各文件头注释）
│   ├── pack-asar.mjs             从 shell\ 重建 app.asar（asar 二进制格式写回 + 回读校验）
│   ├── extract-asar.mjs          从已有的 app.asar 解包出 shell 源码（引导用）
│   ├── check-asar.mjs            校验 asar 内容：版本号 / 两处修复是否在包内
│   ├── verify-waiting-page.mjs   无头渲染等待页并核对鲸鱼-字标间距（需 Chrome）
│   └── verify-strip-fix.mjs      无头执行真实 WINDOW_UI_SCRIPT，验证弹层打开时
│                                 顶部 30px 空条自动隐藏（需 Chrome）
├── tools\rcedit\                 rcedit-x64.exe：改写 exe 版本资源
├── build.ps1                     一键构建：重建 asar → 刷新包 → 写版本号 → 校验 →
│                                 （-Zip）重新压缩
└── artifacts\                    构建产物（app.<版本>.asar，由 build.ps1 生成）
```

## 版本历史中的修复

1. **图片查看器右上角关闭按钮被遮挡**（1.0.0）
   原因：桌面端向页面顶部注入了一条 30px 高的不透明「空条」（z-index 2147483644），
   而图片预览弹层（Lightbox）的关闭按钮定位在 `top:20px`，上半部分被空条盖住
   （原始距离：按钮上缘离窗口顶 20px < 空条高 30px）。
   修复：`shell\main.js` 的 `WINDOW_UI_SCRIPT.hideCheck()` 在检测到大弹层
   （`role=dialog` / lightbox / modal / viewer，且 >300×200）时，将
   `#dsh-topstrip` 置为 `display:none` —— 关闭按钮完整可见；弹层关闭后空条恢复。

2. **加载页（等待页）鲸鱼图标与 deepseek HARNESS 间距过大**（1.0.0）
   原因：`.brand{ gap:clamp(14px,3vw,44px) }` 加上 brand-name.svg 内部
   `viewBox="26 0 156 24"` 产生的约 46px 左边距，实际可见间距约 91px。
   修复：
   - `shell\main.js` 等待页样式：`gap:clamp(14px,3vw,44px)` → `gap:clamp(6px,1vw,14px)`
   - `shell\assets\brand-name.svg`：`<svg>` 增加 `preserveAspectRatio="xMinYMin meet"`，
     消除 wordmark 内部的 40+px 透明偏移
   效果：鲸鱼与文字间可见间距 ≈ 20px，形成紧凑的官方锁版式。

3. **设置面板「桌面端设置」卡片与下方功能错峰出现**（1.0.1）
   原因：`UI_LOCALIZE_SCRIPT` 的 `scheduleCardSync()` 使用 80ms 防抖
   （`setTimeout(..., 80)`），设置面板打开后官方行先渲染、卡片约 5 帧后才补入，
   产生顿挫感。
   修复：`shell\main.js` 防抖 `80` → `00`（同帧挂载），卡片与下方功能同时出现。

4. **页面顶部内容被 30px 空条压住（页头标题被裁）**（1.0.2）
   原因：桌面端为无边框窗口注入的 `body{padding-top:30px}` 规则被 Web 端样式表
   （静态 CSS / 客户端模块后期注入的样式）同优先级覆盖，页面内容整体上移，
   页头（标题、Session log 胶囊）顶部被不透明的空条盖住。
   修复：`shell\main.js` 新增 `applyTopPadding()`，用内联 `!important` 强制
   `body{padding-top:30px}` 与 `#root{height:calc(100vh - 30px)}`，
   并在每次布局同步（MutationObserver 防抖）时重施，防止页面重渲染后丢失。

5. **窗口贴靠后三键概率移位、贴靠时三键概率消失**（1.0.3）
   原因：三键位置只依赖 DOM 变更（MutationObserver）同步，而窗口贴靠/拖动/缩放
   只改变布局、不产生 DOM 事件，定位停留在贴靠中途的瞬时坐标，导致移位甚至
   跑出视野。
   修复：`shell\main.js` 监听 `window.resize`（防抖 120ms 取最终值）重排三键；
   1.5s 轮询兜底改为无条件校正（缓存锚点只读一次 rect 并比较，漂移即修正）；
   `placeWinCtl()` 只写入变化值，锚点失联自动重扫，找不到才退回右上角。

## 重新构建 / 重新打包

```powershell
# 一键重建（默认版本 = shell\package.json 的版本；从仓库根目录运行）
powershell -ExecutionPolicy Bypass -File .\DSH Desktop\build.ps1

# 指定版本并重新生成 zip
powershell -ExecutionPolicy Bypass -File .\DSH Desktop\build.ps1 -Version 1.0.3 -Zip
```

构建流程：`pack-asar.mjs`（shell\ → artifacts\app.<ver>.asar）→ 覆盖
`DeepSeekHarness-1.0.3\resources\app.asar` → `rcedit` 写入 exe 版本
（1.0.3 → `1.0.3.0`）→ `check-asar.mjs` 校验。依赖：`node`（或已安装应用的
捆绑运行时）、Chrome（仅验证脚本需要）。

## 验证

```powershell
node .\DSH Desktop\scripts\check-asar.mjs ".\DSH Desktop\DeepSeekHarness-1.0.3\resources\app.asar"
node .\DSH Desktop\scripts\verify-waiting-page.mjs   # 输出渲染后的等待页间距
node .\DSH Desktop\scripts\verify-strip-fix.mjs      # 输出 dsh-topstrip display 状态
```

## 部署 / 回滚

- **直接使用**：解压 `DeepSeek Harness-1.0.3.zip`（或运行目录内 `DeepSeek Harness.exe`），
  端口默认 `http://127.0.0.1:3080`（桌面端启动内置 dsh web 服务）。
- **替换已安装版本**：退出应用后将 `resources\app.asar` 换成本包的
  `DeepSeekHarness-1.0.3\resources\app.asar` 即可。
- **shell 源码引导**：如需在任意的原版 app.asar 上重做修改，先
  `node scripts\extract-asar.mjs <输出目录> <app.asar>` 解包出原始源码，再比对
  本目录 `shell\` 中的修改（见上文「版本历史中的修复」）。

## 版本发布流程（升级协议）

> 约定：**每修复一个 bug 后，先询问是否升级；用户确认后自动递增版本号、
> 构建并把新版本发布到 GitHub Releases（正文写明修了哪些 bug）。**

```powershell
# 默认递增 patch（1.0.2 → 1.0.3），也可 -Bump minor / major 或直接 -Version 1.1.0
powershell -ExecutionPolicy Bypass -File .\DSH Desktop\publish-version.ps1 -Bump patch `
    -Message "修复 xxx" -Notes @"
- 修复1：xxx
- 修复2：yyy
"@

# 流程：改版本号 → build.ps1 构建 → tar 打包 zip →
#       git commit/push（源码）→ tag v<版本> 并推送 →
#       创建 GitHub Release（正文 = -Notes 修复清单，缺省自动取 git log）→ 上传 zip 附件
# 只构建+推源码不发布 Release：加 -NoRelease
```

发布产物（`DeepSeekHarness-<版本>\`、`*.zip`、`artifacts\`）已被 `.gitignore` 排除，
仓库只同步源码与脚本；发行版 zip 作为 GitHub Release 附件分发。
