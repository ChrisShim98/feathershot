// Starts `next dev`, builds the Debug shell into a package, installs it locally and launches it.
// The Debug shell probes http://localhost:3000 and loads it instead of the bundled export, so edits under
// web/ hot-reload inside the real WebView2. Debug builds also expose DevTools at http://localhost:9222.
// The package is registered loose (unsigned), so Windows Developer Mode must be on.
import { spawn } from "node:child_process";
import { join } from "node:path";
import { cleanDist, root, run } from "./lib.mjs";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const web = spawn(npm, ["run", "dev"], { cwd: join(root, "web"), stdio: "inherit", shell: true });

// A Debug package must not be mixed with an earlier Release one in dist/, and Feathershot is normally
// still running in the tray from the last time this was run — stop it before touching its files.
cleanDist();
run("node", [join(root, "scripts", "build-shell.mjs"), "--package", "--debug"]);
run("node", [join(root, "scripts", "install-local.mjs")]);

console.log("\nFeathershot is running in the tray. Edit files under web/ for hot reload. Ctrl+C stops the dev server.");
process.on("SIGINT", () => { web.kill(); process.exit(0); });
web.on("exit", (c) => process.exit(c ?? 0));
