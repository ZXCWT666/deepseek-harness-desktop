# DSH Desktop 桌面端构建工作区（版本 1.0.0）

DeepSeek Harness 桌面端的源码与构建产物集中目录。桌面端为「纯壳封装 + 服务自愈」：
Electron 外壳（`shell\main.js`）只做窗口与等待页，界面本身由内置 `dsh web` 服务
（`DeepSeek Harness-1.0.0\resources\dsh` + `node`）提供。

## 目录结构

```
DSH Desktop\
├── DeepSeek Harness-1.0.0\        完整便携版应用（可直接运行 DeepSeek Harness.exe）
├── DeepSeek Harness-1.0.0.zip     上述目录的 zip 压缩包（255 MB）
├── shell\                        桌面端外壳源码（构建 app.asar 的输入）
│   ├── main.js                   主进程：窗口、服务自愈、托盘、等待页、内置窗口控件
│   ├── package.json              app 版本（当前 1.0.0）
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

## 版本 1.0.0 包含的两个修复

1. **图片查看器右上角关闭按钮被遮挡**
   原因：桌面端向页面顶部注入了一条 30px 高的不透明「空条」（z-index 2147483644），
   而图片预览弹层（Lightbox）的关闭按钮定位在 `top:20px`，上半部分被空条盖住
   （原始距离：按钮上缘离窗口顶 20px < 空条高 30px）。
   修复：`shell\main.js` 的 `WINDOW_UI_SCRIPT.hideCheck()` 在检测到大弹层
   （`role=dialog` / lightbox / modal / viewer，且 >300×200）时，将
   `#dsh-topstrip` 置为 `display:none` —— 关闭按钮完整可见；弹层关闭后空条恢复。

2. **加载页（等待页）鲸鱼图标与 deepseek HARNESS 间距过大**
   原因：`.brand{ gap:clamp(14px,3vw,44px) }` 加上 brand-name.svg 内部
   `viewBox="26 0 156 24"` 产生的约 46px 左边距，实际可见间距约 91px。
   修复：
   - `shell\main.js` 等待页样式：`gap:clamp(14px,3vw,44px)` → `gap:clamp(6px,1vw,14px)`
   - `shell\assets\brand-name.svg`：`<svg>` 增加 `preserveAspectRatio="xMinYMin meet"`，
     消除 wordmark 内部的 40+px 透明偏移
   效果：鲸鱼与文字间可见间距 ≈ 20px，形成紧凑的官方锁版式。

## 重新构建 / 重新打包

```powershell
# 一键重建（默认版本 = shell\package.json 的版本）
powershell -ExecutionPolicy Bypass -File D:\dsh\DSH Desktop\build.ps1

# 指定版本并重新生成 zip
powershell -ExecutionPolicy Bypass -File D:\dsh\DSH Desktop\build.ps1 -Version 1.0.0 -Zip
```

构建流程：`pack-asar.mjs`（shell\ → artifacts\app.<ver>.asar）→ 覆盖
`DeepSeek Harness-1.0.0\resources\app.asar` → `rcedit` 写入 exe 版本
（1.0.0 → `1.0.0.0`）→ `check-asar.mjs` 校验。依赖：`node`（或已安装应用的
捆绑运行时）、Chrome（仅验证脚本需要）。

## 验证

```powershell
node D:\dsh\DSH Desktop\scripts\check-asar.mjs "D:\dsh\DSH Desktop\DeepSeek Harness-1.0.0\resources\app.asar"
node D:\dsh\DSH Desktop\scripts\verify-waiting-page.mjs   # 输出渲染后的等待页间距
node D:\dsh\DSH Desktop\scripts\verify-strip-fix.mjs      # 输出 dsh-topstrip display 状态
```

## 部署 / 回滚

- **直接使用**：解压 `DeepSeek Harness-1.0.0.zip`（或运行目录内 `DeepSeek Harness.exe`），
  端口默认 `http://127.0.0.1:3080`（桌面端启动内置 dsh web 服务）。
- **替换已安装版本**：退出应用后将 `resources\app.asar` 换成本包的
  `DeepSeek Harness-1.0.0\resources\app.asar` 即可。
- **shell 源码引导**：如需在任意的原版 app.asar 上重做修改，先
  `node scripts\extract-asar.mjs <输出目录> <app.asar>` 解包出原始源码，再比对
  本目录 `shell\` 中的两处修改（见上文「两个修复」）。
