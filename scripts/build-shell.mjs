// Builds the WinUI 3 shell with MSBuild (found via vswhere). With --package it also produces the MSIX.
//   node scripts/build-shell.mjs              Release build
//   node scripts/build-shell.mjs --package    Release MSIX (sideload + Store upload) into dist/, signed
//                                              with a local dev certificate so you can install and test it
//   node scripts/build-shell.mjs --store      Release .msixupload only, UNSIGNED, for Partner Center —
//                                              the Store re-signs it on ingestion, so no local cert is used
//   node scripts/build-shell.mjs --debug      Debug build
// Signing (--package only): set FEATHERSHOT_CERT_THUMBPRINT to sign with your own certificate; otherwise a
// self-signed dev certificate matching the manifest's publisher is created in the user's store (public
// part: dist/dev-cert.cer). --store never touches this — read the checklist it prints before submitting.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { findMSBuild, powershell, root, run } from "./lib.mjs";

const pkg = process.argv.includes("--package");
const store = process.argv.includes("--store");
const debug = process.argv.includes("--debug");
const config = debug ? "Debug" : "Release";
const dist = join(root, "dist");
const msbuild = findMSBuild();

const args = [
  join(root, "shell", "Feathershot.csproj"),
  "/restore",
  `/p:Configuration=${config}`,
  "/p:Platform=x64",
  "/p:RuntimeIdentifier=win-x64",
  "/v:m",
  "/nologo",
];

function devCertThumbprint() {
  const cer = join(dist, "dev-cert.cer");
  const ps = [
    "$subject = 'CN=793116DF-0464-46D0-AC72-104D05CB9BA4'",
    "$c = Get-ChildItem Cert:\\CurrentUser\\My | Where-Object { $_.Subject -eq $subject -and $_.NotAfter -gt (Get-Date) } | Select-Object -First 1",
    "if (-not $c) { $c = New-SelfSignedCertificate -Type Custom -Subject $subject -KeyUsage DigitalSignature -FriendlyName 'Feathershot dev' -CertStoreLocation 'Cert:\\CurrentUser\\My' -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3','2.5.29.19={text}') }",
    `Export-Certificate -Cert $c -FilePath '${cer}' -Force | Out-Null`,
    "$c.Thumbprint",
  ].join("; ");
  const thumb = powershell(ps).split(/\r?\n/).pop() ?? "";
  if (!/^[0-9A-F]{40}$/i.test(thumb)) throw new Error("Could not create the dev certificate.");
  return thumb;
}

/**
 * Visual Studio's Publish -> Associate App with the Store writes shell/Package.StoreAssociation.xml with
 * the reserved Publisher, and updates Package.appxmanifest's Identity to match it. If association was
 * skipped (or the manifest was hand-edited since), the two won't agree — that's the actual signal to warn
 * on, not the shape of the Publisher value itself (an MSA developer account's real Publisher is a
 * GUID-based CN, indistinguishable from a placeholder by looks alone).
 */
function warnIfNotAssociated() {
  const manifest = readFileSync(join(root, "shell", "Package.appxmanifest"), "utf8");
  const publisher = manifest.match(/Publisher="([^"]+)"/)?.[1];
  const assocPath = join(root, "shell", "Package.StoreAssociation.xml");
  const assocPublisher = existsSync(assocPath) ? readFileSync(assocPath, "utf8").match(/<Publisher>([^<]+)<\/Publisher>/)?.[1] : undefined;
  if (publisher && publisher === assocPublisher) return;
  console.warn(
    "\nWarning: shell/Package.appxmanifest's Identity Publisher doesn't match shell/Package.StoreAssociation.xml\n" +
    "(or that file is missing). Partner Center will reject a submission whose identity doesn't match your\n" +
    "reservation. Fix: in Visual Studio, right-click the shell project -> Publish -> Associate App with the\n" +
    "Store, then run this again. See docs/store-submission.md.\n",
  );
}

if (pkg) {
  mkdirSync(dist, { recursive: true });
  const thumb = process.env.FEATHERSHOT_CERT_THUMBPRINT || devCertThumbprint();
  args.push(
    "/p:GenerateAppxPackageOnBuild=true",
    `/p:AppxPackageDir=${dist}\\`,
    "/p:AppxBundle=Never",
    "/p:UapAppxPackageBuildMode=StoreAndSideload",
    "/p:AppxPackageSigningEnabled=true",
    "/p:GenerateTemporaryStoreCertificate=false",
    `/p:PackageCertificateThumbprint=${thumb}`,
  );
} else if (store) {
  mkdirSync(dist, { recursive: true });
  warnIfNotAssociated();
  args.push(
    "/p:GenerateAppxPackageOnBuild=true",
    `/p:AppxPackageDir=${dist}\\`,
    "/p:AppxBundle=Never",
    "/p:UapAppxPackageBuildMode=StoreUpload",
    "/p:AppxPackageSigningEnabled=false",
    "/p:GenerateTemporaryStoreCertificate=false",
  );
}

run(msbuild, args);

if (pkg || store) {
  const found = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(msix|msixupload)$/i.test(f)) found.push(p);
    }
  };
  walk(dist);
  console.log("\nPackages:");
  for (const p of found) console.log(`  ${(statSync(p).size / 1048576).toFixed(1)} MB  ${p}`);
  if (found.some((p) => /\.msix(upload)?$/i.test(p) && statSync(p).size > 50 * 1048576))
    console.warn("\nWarning: package is over the 50 MB target. Check trimming and bundled assets.");
  if (pkg) console.log("\nTo install the sideload build: trust dist/dev-cert.cer (Local Machine > Trusted People, needs admin), then open the .msix.");
  if (store) {
    console.log("\nThis .msixupload is UNSIGNED — Partner Center signs it on ingestion, so this is expected, not a mistake.");
    console.log("Before you submit it, see the checklist below (also in docs/store-submission.md).");
  }
}
