// Installs the packaged build for local testing without needing to trust a certificate:
// extracts dist/*.msix to dist/layout and registers it loose (Windows Developer Mode must be on).
//   node scripts/install-local.mjs          install and launch
import { copyFileSync, readdirSync, rmSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { powershell as ps, root } from "./lib.mjs";

const dist = join(root, "dist");
if (!existsSync(dist)) throw new Error("No package in dist/. Run `npm run package` first.");
// If more than one _Test folder somehow exists (e.g. a Debug and a Release build side by side), take the
// most recently built one rather than whichever readdir happens to list first.
const tests = readdirSync(dist)
  .filter((d) => d.endsWith("_Test"))
  .map((d) => ({ d, mtime: statSync(join(dist, d)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);
if (tests.length === 0) throw new Error("No package in dist/. Run `npm run package` first.");
const test = tests[0].d;
const msix = readdirSync(join(dist, test)).find((f) => f.endsWith(".msix"));
const layout = join(dist, "layout");
const zip = join(dist, "layout.zip");

ps("Stop-Process -Name Feathershot -Force -ErrorAction SilentlyContinue; Get-AppxPackage ChristopherShim.Feathershot | Remove-AppxPackage");
rmSync(layout, { recursive: true, force: true });
copyFileSync(join(dist, test, msix), zip);
ps(`Expand-Archive '${zip}' '${layout}' -Force`);
rmSync(zip);
for (const f of ["AppxSignature.p7x", "AppxBlockMap.xml", "[Content_Types].xml", "AppxMetadata"]) rmSync(join(layout, f), { recursive: true, force: true });
ps(`Add-AppxPackage -Register '${join(layout, "AppxManifest.xml")}'`);
const family = ps("(Get-AppxPackage ChristopherShim.Feathershot).PackageFamilyName");
spawnSync("explorer.exe", [`shell:AppsFolder\\${family}!App`]);
console.log(`Installed and launched (${family}). Log: %LOCALAPPDATA%\\Packages\\${family}\\LocalState\\feathershot.log`);
if (!existsSync(layout)) process.exit(1);
