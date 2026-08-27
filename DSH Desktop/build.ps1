# ============================================================
# DSH Desktop 构建脚本
# 从 shell\ 源码重建 app.asar -> 刷新 DeepSeekHarness-<版本>\ 包
# -> 写入 exe 版本号 -> 校验 -> （可选）重新压缩 zip
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File build.ps1            # 用 shell\package.json 的版本
#   powershell -ExecutionPolicy Bypass -File build.ps1 -Version 1.0.1
#   powershell -ExecutionPolicy Bypass -File build.ps1 -Zip       # 构建后重新打包 zip
# ============================================================
param(
  [string]$Version = "",
  [switch]$Zip
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# --- node 解释器：优先本机 node，其次已安装应用的捆绑运行时 ---
$node = (Get-Command node -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if (-not $node) {
  $bundled = "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\node\node.exe"
  if (Test-Path $bundled) { $node = $bundled } else { throw 'node.exe 未找到' }
}

# --- 版本号：优先 -Version 参数，默认取 shell\package.json ---
$pkg = Get-Content "$root\shell\package.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$ver = if ($Version) { $Version } else { [string]$pkg.version }
Write-Host "==> 构建版本: $ver" -ForegroundColor Cyan

# --- 1) 从 shell\ 重建 app.asar ---
New-Item -ItemType Directory -Path "$root\artifacts" -Force | Out-Null
$asarOut = "$root\artifacts\app.$ver.asar"
& $node "$root\scripts\pack-asar.mjs" $asarOut
if ($LASTEXITCODE -ne 0) { throw "pack-asar 失败 (exit $LASTEXITCODE)" }
Write-Host "==> app.asar 已生成: $asarOut" -ForegroundColor Green

# --- 2) 刷新 DeepSeekHarness-<版本>\ 包（缺失时从已安装应用目录复制模板） ---
$appDir = "$root\DeepSeekHarness-$ver"
if (-not (Test-Path "$appDir\resources\app.asar")) {
  $template = Get-ChildItem $root -Directory -Filter "DeepSeekHarness-*" |
    Sort-Object Name -Descending | Select-Object -First 1
  if (-not $template) {
    $installed = "$env:LOCALAPPDATA\Programs\DeepSeek Harness"
    if (Test-Path "$installed\DeepSeek Harness.exe") { $template = Get-Item $installed }
  }
  if (-not $template) { throw "未找到包模板：请先安装一份 DeepSeek Harness（或复制其应用目录到 $root 下名为 DeepSeekHarness-<版本>）" }
  Write-Host "==> 从模板复制: $($template.FullName) -> $appDir" -ForegroundColor Yellow
  Copy-Item $template.FullName $appDir -Recurse -Force
}
if (-not (Test-Path "$appDir\resources\app.asar")) {
  throw "未找到 $appDir\resources\app.asar —— 请先复制一份已安装的 DeepSeek Harness 应用目录作为包模板（或先运行 extract 流程）"
}
Copy-Item $asarOut "$appDir\resources\app.asar" -Force
Write-Host "==> 已更新 $appDir\resources\app.asar" -ForegroundColor Green

# --- 3) 写入 exe 版本号 ---
$rcedit = "$root\tools\rcedit\bin\rcedit-x64.exe"
& $rcedit "$appDir\DeepSeek Harness.exe" `
  --set-file-version "$ver.0" --set-product-version "$ver.0" `
  --set-version-string "FileVersion" "$ver.0" --set-version-string "ProductVersion" "$ver.0" `
  --set-version-string "ProductName" "DeepSeek Harness" --set-version-string "FileDescription" "DeepSeek Harness"
if ($LASTEXITCODE -ne 0) { throw "rcedit 失败 (exit $LASTEXITCODE)" }
Write-Host "==> exe 版本号已更新: $ver.0" -ForegroundColor Green

# --- 4) 校验 asar 内容 ---
& $node "$root\scripts\check-asar.mjs" "$appDir\resources\app.asar"
if ($LASTEXITCODE -ne 0) { throw "check-asar 失败 (exit $LASTEXITCODE)" }

# --- 5） （可选）重新压缩 zip ---
if ($Zip) {
  Push-Location $root
  Remove-Item "$root\DeepSeek Harness-$ver.zip" -Force -ErrorAction SilentlyContinue
  tar.exe -a -c -f "$root\DeepSeek Harness-$ver.zip" $appDir
  Pop-Location
  if ($LASTEXITCODE -ne 0) { throw "tar 失败 (exit $LASTEXITCODE)" }
  Write-Host "==> zip 已重新生成: $root\DeepSeek Harness-$ver.zip" -ForegroundColor Green
}

Write-Host "==> 完成。包目录: $appDir" -ForegroundColor Green
