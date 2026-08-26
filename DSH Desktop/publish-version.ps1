# ============================================================
# DSH Desktop 版本发布流程（GitHub Release 发布协议）
#   1) 递增 shell\package.json 版本号（-Bump patch/minor/major 或 -Version 指定）
#   2) build.ps1 构建包 + 生成发布 zip（DeepSeek Harness-<版本>.zip）
#   3) git add -A && commit && push（源码同步到仓库 main）
#   4) 打 tag v<版本> 并推送
#   5) 创建 GitHub Release（tag 同名），正文 = 修复清单（-Notes 或自动从 git log 生成）
#   6) 把 zip 上传为 Release 附件
#
# 用法（从仓库根目录运行；凭据取自 git credential，不在脚本里保存任何令牌）：
#   powershell -ExecutionPolicy Bypass -File .\DSH Desktop\publish-version.ps1 -Bump patch `
#       -Message "修复 xxx" -Notes @"
#   - 修复1：xxx
#   - 修复2：yyy
#   "@
#   powershell -ExecutionPolicy Bypass -File .\DSH Desktop\publish-version.ps1 -Bump minor -Message "新功能"
#   powershell -ExecutionPolicy Bypass -File .\DSH Desktop\publish-version.ps1 -Version 1.0.3 -Notes "..."
#   powershell -ExecutionPolicy Bypass -File .\DSH Desktop\publish-version.ps1 -NoRelease   # 只构建+推源码
# ============================================================
param(
  [ValidateSet('patch', 'minor', 'major')] [string]$Bump = '',
  [string]$Version = '',
  [string]$Message = '',
  [string]$Notes = '',
  [switch]$NoRelease
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$repo = 'ZXCWT666/deepseek-harness-desktop'
$api = "https://api.github.com/repos/$repo"

# --- 0) GitHub 令牌：从系统 git 凭据取（不写入任何文件） ---
function Get-GitHubToken {
  $cred = 'protocol=https`nhost=github.com`n`n' | git credential fill 2>$null
  $line = $cred | Where-Object { $_ -match '^password=' }
  if (-not $line) { return '' }
  return $line.Substring(9).Trim()
}
$token = Get-GitHubToken
if (-not $token) { throw '未找到 GitHub 凭据（git credential）——请先用 git 登录，或检查凭据管理器' }
$headers = @{ Authorization = "token $token"; 'User-Agent' = 'dsh-release'; Accept = 'application/vnd.github+json' }

# --- 1) 计算并写入新版本号 ---
$pkgPath = Join-Path $PSScriptRoot 'shell\package.json'
$pkg = Get-Content $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
$cur = [version]$pkg.version

if ($Version) { $new = [version]$Version } else {
  $bump = if ($Bump) { $Bump } else { 'patch' }
  if ($bump -eq 'major') { $new = [version]"$($cur.Major + 1).0.0" }
  elseif ($bump -eq 'minor') { $new = [version]"$($cur.Major).$($cur.Minor + 1).0" }
  else { $new = [version]"$($cur.Major).$($cur.Minor).$($cur.Build + 1)" }
}
$pkg.version = $new.ToString()
$pkg | ConvertTo-Json -Depth 4 | Set-Content $pkgPath -Encoding UTF8
Write-Host "==> 版本: $cur -> $new" -ForegroundColor Cyan

# --- 2) 构建包 + 生成发布 zip ---
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build.ps1')
if ($LASTEXITCODE -ne 0) { throw "build.ps1 失败 (exit $LASTEXITCODE)" }
$appDir = Join-Path $PSScriptRoot "DeepSeekHarness-$new"
$zipPath = Join-Path $PSScriptRoot "DeepSeek Harness-$new.zip"
if (-not (Test-Path (Join-Path $appDir 'resources\app.asar'))) { throw "包目录缺失: $appDir" }
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Push-Location $PSScriptRoot
try { tar.exe -a -c -f $zipPath $appDir } finally { Pop-Location }
if ($LASTEXITCODE -ne 0) { throw "tar 打包失败 (exit $LASTEXITCODE)" }
Write-Host "==> zip 已生成: $zipPath" -ForegroundColor Green

# --- 3) 提交并推送源码 ---
$commitMsg = "release: DSH Desktop v$new"
if ($Message) { $commitMsg += " — $Message" }
git -C $root add -A
git -C $root commit -m $commitMsg
if ($LASTEXITCODE -ne 0) { throw "git commit 失败 (exit $LASTEXITCODE)" }
git -C $root push
if ($LASTEXITCODE -ne 0) { throw "git push 失败 (exit $LASTEXITCODE)" }
Write-Host "==> 源码已推送 main" -ForegroundColor Green

if ($NoRelease) { Write-Host "==> 已跳过 Release 发布（-NoRelease）"; Write-Host "==> 完成"; exit 0 }

# --- 4) tag + 推送 tag ---
$tag = "v$new"
git -C $root tag -f -a $tag -m "DSH Desktop v$new"
git -C $root push --force origin $tag
if ($LASTEXITCODE -ne 0) { throw "git push $tag 失败 (exit $LASTEXITCODE)" }

# --- 5) 生成 Release 正文（修复清单） ---
$lastTag = (git -C $root describe --tags --abbrev=0 "$tag^" 2>$null)
$body = ''
if ($Notes) { $body = $Notes }
elseif ($lastTag) {
  $log = (git -C $root log "--pretty=format:- %s" "$lastTag..HEAD") -join "`n"
  $body = "## 自 $lastTag 以来的变更`n`n$log"
} else {
  $log = (git -C $root log "--pretty=format:- %s" "-5") -join "`n"
  $body = "## 最近变更`n`n$log"
}

# --- 6) 创建 Release 并上传 zip ---
$payload = @{ tag_name = $tag; name = "DSH Desktop v$new"; body = $body; draft = $false; prerelease = $false } | ConvertTo-Json
$release = Invoke-RestMethod -Method Post -Uri "$api/releases" -Headers $headers -Body $payload -ContentType 'application/json' -TimeoutSec 60
Write-Host "==> Release 已创建: $($release.html_url)" -ForegroundColor Green

$assetName = "DeepSeek Harness-$new.zip"
$uploadUrl = "https://uploads.github.com/repos/$repo/releases/$($release.id)/assets?name=$([uri]::EscapeDataString($assetName))"
try {
  $asset = Invoke-RestMethod -Method Post -Uri $uploadUrl -Headers $headers -ContentType 'application/zip' -InFile $zipPath -TimeoutSec 1800
  Write-Host "==> 附件已上传: $($asset.browser_download_url) ($([math]::Round($asset.size/1MB,1)) MB)" -ForegroundColor Green
} catch {
  Write-Warning "附件上传失败: $($_.Exception.Message)"
  Write-Host "==> 可手动补传: 打开 Release 页面拖入 $zipPath" -ForegroundColor Yellow
}

Write-Host "==> 发布完成: $($release.html_url)" -ForegroundColor Green
