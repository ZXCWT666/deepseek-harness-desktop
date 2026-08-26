# ============================================================
# DSH Desktop 版本发布流程（升级协议）
#   1) 递增 shell\package.json 版本号（-Bump patch/minor/major 或 -Version 指定）
#   2) build.ps1 构建包（asar + exe 版本 + 校验）
#   3) git add -A && commit "release: DSH Desktop v<版本> — <Message>" && push
#
# 用法（从仓库根目录运行）：
#   powershell -ExecutionPolicy Bypass -File .\DSH Desktop\publish-version.ps1 -Bump patch -Message "修复 xxx"
#   powershell -ExecutionPolicy Bypass -File .\DSH Desktop\publish-version.ps1 -Version 1.0.4 -Message "修复 xxx"
#   powershell -ExecutionPolicy Bypass -File .\DSH Desktop\publish-version.ps1 -Bump minor   # 无 Message 时只发布版本
# ============================================================
param(
  [ValidateSet('patch', 'minor', 'major')] [string]$Bump = '',
  [string]$Version = '',
  [string]$Message = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# --- 1) 计算并写入新版本号 ---
$pkgPath = Join-Path $PSScriptRoot 'shell\package.json'
$pkg = Get-Content $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
$cur = [version]$pkg.version

if ($Version) {
  $new = [version]$Version
} else {
  $bump = if ($Bump) { $Bump } else { 'patch' }
  $nextPath = @{ patch = 2; minor = 1; major = 0 }[$bump]
  if ($bump -eq 'major') { $new = [version]"$($cur.Major + 1).0.0" }
  elseif ($bump -eq 'minor') { $new = [version]"$($cur.Major).$($cur.Minor + 1).0" }
  else { $new = [version]"$($cur.Major).$($cur.Minor).$($cur.Build + 1)" }
}

$pkg.version = $new.ToString()
$pkg | ConvertTo-Json -Depth 4 | Set-Content $pkgPath -Encoding UTF8
Write-Host "==> 版本: $cur -> $new" -ForegroundColor Cyan

# --- 2) 构建包（build.ps1 使用 shell\package.json 的版本） ---
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build.ps1')
if ($LASTEXITCODE -ne 0) { throw "build.ps1 失败 (exit $LASTEXITCODE)" }

# --- 3) 提交并推送 ---
$commitMsg = "release: DSH Desktop v$new"
if ($Message) { $commitMsg += " — $Message" }
git -C $root add -A
git -C $root commit -m $commitMsg
if ($LASTEXITCODE -ne 0) { throw "git commit 失败 (exit $LASTEXITCODE)" }
git -C $root push
if ($LASTEXITCODE -ne 0) { throw "git push 失败 (exit $LASTEXITCODE)" }

Write-Host "==> 已发布: $commitMsg" -ForegroundColor Green
