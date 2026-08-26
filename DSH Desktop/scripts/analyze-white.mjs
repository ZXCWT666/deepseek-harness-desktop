import fs from "node:fs";
import { execFileSync } from "node:child_process";
const ps = `
Add-Type -AssemblyName System.Drawing
$out = @()
for ($i = 0; $i -lt 120; $i++) {
  $f = "D:\\dsh\\resizeband-{0:D3}.png" -f $i
  $bmp = [System.Drawing.Bitmap]::FromFile($f)
  $white = 0; $total = 0
  for ($y = 0; $y -lt 200; $y += 4) {
    for ($x = 0; $x -lt 2560; $x += 4) {
      $p = $bmp.GetPixel($x, $y)
      $total++
      if ($p.R -gt 225 -and $p.G -gt 225 -and $p.B -gt 225) { $white++ }
    }
  }
  $bmp.Dispose()
  $out += "{0:D3} white={1}/{2} ({3})" -f $i, $white, $total, [math]::Round(100 * $white / $total, 1)
}
$out | Out-File "D:\\dsh\\resizeband-analysis.txt" -Encoding utf8
`;
fs.writeFileSync(process.env.TEMP + "/wb.ps1", ps, "utf8");
execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", process.env.TEMP + "/wb.ps1"]);
const lines = fs.readFileSync("D:/dsh/resizeband-analysis.txt", "utf8").split(/\r?\n/).filter(Boolean);
// 找 white 比例 > 5% 的帧
const flash = lines.filter((l) => parseFloat(l.match(/\(([\d.]+)\)/)[1]) > 5);
console.log("frames with >5% white:", flash.length);
console.log(flash.slice(0, 20).join("\n"));
console.log("--- max whites ---");
const sorted = [...lines].sort((a, b) => parseFloat(b.match(/\(([\d.]+)\)/)[1]) - parseFloat(a.match(/\(([\d.]+)\)/)[1]));
console.log(sorted.slice(0, 8).join("\n"));
