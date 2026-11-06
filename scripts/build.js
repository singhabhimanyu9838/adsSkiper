import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await build({
  entryPoints: {
    background: path.join(root, "src/background/index.js"),
    content: path.join(root, "src/content/index.js"),
    "popup/popup": path.join(root, "src/popup/popup.js"),
    "options/options": path.join(root, "src/options/options.js"),
  },
  outdir: output,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome120",
  sourcemap: false,
});

for (const file of ["manifest.json"]) {
  await cp(path.join(root, file), path.join(output, file));
}
for (const directory of ["src/popup", "src/options", "assets"]) {
  const target = directory.startsWith("src/") ? directory.slice(4) : directory;
  await cp(path.join(root, directory), path.join(output, target), {
    recursive: true,
    filter: (source) => !source.endsWith(".js"),
  });
}
