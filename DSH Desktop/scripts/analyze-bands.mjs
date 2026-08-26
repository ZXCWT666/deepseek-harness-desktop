import fs from "node:fs";
import { execFileSync } from "node:child_process";
// 用 PS + System.Drawing 逐帧分析：y0..50 带内的亮像素聚类（三键 = 约90px 的亮簇）
const ps = `
Add-Type -AssemblyName System.Drawing
$rows = @()
for ($i = 0; $i -lt 600; $i++) {
  $f = "D:\\dsh\\dragband-{0:D3}.png" -f $i
  if (-not (Test-Path $f)) { continue }
  $bmp = [System.Drawing.Bitmap]::FromFile($f)
  $cols = @{}
  for ($y = 0; $y -lt 50; $y += 3) {
    for ($x = 0; $x -lt 2560; $x += 2) {
      $p = $bmp.GetPixel($x, $y)
      if ($p.R -gt 185 -and $p.G -gt 185 -and $p.B -gt 185) { $cols[$x] = 1 }
    }
  }
  $bmp.Dispose()
  $xs = $cols.Keys | Sort-Object
  $clusters = @()
  $start = -1; $last = -1
  foreach ($x in $xs) {
    if ($start -lt 0) { $start = $x; $last = $x; continue }
    if ($x - $last -gt 40) { $clusters += "$start-$last"; $start = $x }
    $last = $x
  }
  if ($start -ge 0) { $clusters += "$start-$last" }
  $rows += "$i : " + ($clusters -join ",")
}
$rows | Out-File "D:\\dsh\\dragband-analysis.txt" -Encoding utf8
`;
fs.writeFileSync(process.env.TEMP + "/band-analysis.ps1", ps, "utf8");
const out = execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", process.env.TEMP + "/band-analysis.ps1"], { encoding: "utf8", shell: false });
console.log("analysis done");
