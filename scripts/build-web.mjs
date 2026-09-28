// Static-exports the Next.js app and copies web/out into shell/Assets/web.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { root, run } from "./lib.mjs";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
run(npm, ["run", "build"], { cwd: join(root, "web"), shell: true });

const out = join(root, "web", "out");
const dest = join(root, "shell", "Assets", "web");
if (!existsSync(join(out, "index.html"))) {
  console.error("web/out/index.html missing: did the export fail?");
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(out, dest, { recursive: true });
console.log(`\nCopied web/out -> shell/Assets/web`);
