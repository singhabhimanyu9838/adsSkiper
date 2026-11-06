import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const outputDir = path.join(root, "artifacts");
const archivePath = path.join(outputDir, "autoskip-chromium.zip");

await mkdir(outputDir, { recursive: true });
const archive = archiver("zip", { zlib: { level: 9 } });
const output = createWriteStream(archivePath);
archive.pipe(output);
archive.directory(dist, false);
await archive.finalize();
await new Promise((resolve, reject) => {
  output.on("close", resolve);
  output.on("error", reject);
  archive.on("error", reject);
});
console.info(`Created ${path.relative(root, archivePath)}`);
