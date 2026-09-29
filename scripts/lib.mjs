import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// A parent PowerShell 7 session leaks its module path into Windows PowerShell 5 and breaks the Cert: drive.
export const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toUpperCase() !== "PSMODULEPATH"));

export function powershell(cmd) {
  const r = spawnSync("powershell", ["-NoProfile", "-Command", cmd], { encoding: "utf8", env: cleanEnv() });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout.trim();
}

/**
 * Removes stale build output before a rebuild: any previous _Test folder and .msixupload (so a fresh
 * build can't be shadowed by an old one) and dist/layout (the installed copy). Keeps dev-cert.* so the
 * signing certificate doesn't need regenerating every time. Stops Feathershot.exe first — Windows won't
 * delete a running exe's files, and the app is normally still sitting in the tray from the last run.
 */
export function cleanDist() {
  // `-ErrorAction SilentlyContinue` suppresses the "no such process" error message, but powershell.exe
  // still exits 1 when Stop-Process sets $? to false internally - `exit 0` forces a clean exit code so
  // this doesn't look like a real failure when Feathershot just isn't running yet (e.g. a fresh clone).
  powershell("Stop-Process -Name Feathershot -Force -ErrorAction SilentlyContinue; exit 0");
  const dist = join(root, "dist");
  if (!existsSync(dist)) return;
  for (const name of readdirSync(dist)) {
    if (name === "layout" || name.endsWith("_Test") || name.endsWith(".msixupload")) {
      rmSync(join(dist, name), { recursive: true, force: true });
    }
  }
}

/** Runs a command, streaming output, and exits the script if it fails. */
export function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: root, shell: false, ...opts });
  if (r.status !== 0) {
    console.error(`\nFailed: ${cmd} (exit ${r.status ?? r.error})`);
    process.exit(r.status ?? 1);
  }
}

/** Finds MSBuild.exe with vswhere (Visual Studio 2022 or newer, WinUI workload). */
export function findMSBuild() {
  const vswhere = join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Microsoft Visual Studio", "Installer", "vswhere.exe");
  if (!existsSync(vswhere)) throw new Error("vswhere.exe not found. Install Visual Studio 2022+ with the WinUI application development workload.");
  const r = spawnSync(vswhere, ["-latest", "-products", "*", "-requires", "Microsoft.Component.MSBuild", "-find", "MSBuild\\**\\Bin\\MSBuild.exe"], { encoding: "utf8" });
  const path = r.stdout.split(/\r?\n/).find(Boolean);
  if (!path) throw new Error("MSBuild not found by vswhere.");
  return path;
}
