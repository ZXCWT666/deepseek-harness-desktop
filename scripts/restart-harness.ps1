# Detached harness restart + verification for the balance-status plugin.
# Runs outside the dsh web process tree (scheduled task), so it survives the
# server restart and writes evidence to D:\dsh\restart-verify.txt.
$ErrorActionPreference = 'Continue'

$log = @()
$log += "restart begin $(Get-Date -Format o)"

Start-Sleep -Seconds 30

# 1. Stop the dsh web node process (the GUI server), then the app shell.
Get-Process node -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -eq 'C:\Users\USER\AppData\Local\Programs\DeepSeek Harness\resources\node\node.exe' } |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Get-Process 'DeepSeek Harness' -ErrorAction SilentlyContinue |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# 2. Relaunch the app (it boots dsh web --no-open with the web profile again).
Start-Process 'C:\Users\USER\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe' -ErrorAction SilentlyContinue
$log += "app relaunched, waiting for boot"
Start-Sleep -Seconds 50

# 3. Verify: status endpoint, boot manifest entry, client bundle.
try {
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3080/balance-status/status' -UseBasicParsing -TimeoutSec 40
  $log += "status HTTP $($r.StatusCode)"
  $log += $r.Content.Substring(0, [Math]::Min(900, $r.Content.Length))
} catch {
  $log += "status ERR: $($_.Exception.Message)"
}
try {
  $b = Invoke-WebRequest -Uri 'http://127.0.0.1:3080/' -UseBasicParsing -TimeoutSec 40
  $i = $b.Content.IndexOf('dsh-balance-status')
  $log += "boot entry dsh-balance-status present in manifest: $($i -ge 0)"
  if ($i -ge 0) {
    $start = [Math]::Max(0, $i - 120)
    $log += $b.Content.Substring($start, [Math]::Min(320, $b.Content.Length - $start))
  }
} catch {
  $log += "root ERR: $($_.Exception.Message)"
}
try {
  $c = Invoke-WebRequest -Uri 'http://127.0.0.1:3080/plugins/dsh-balance-status/client.js' -UseBasicParsing -TimeoutSec 40
  $log += "client.js HTTP $($c.StatusCode) len $($c.Content.Length)"
} catch {
  $log += "client.js ERR: $($_.Exception.Message)"
}

$log += "restart end $(Get-Date -Format o)"
$log | Out-File 'D:\dsh\restart-verify.txt' -Encoding utf8

# clean up the one-shot task
schtasks /Delete /TN 'dsh-balance-status-restart' /F | Out-Null
