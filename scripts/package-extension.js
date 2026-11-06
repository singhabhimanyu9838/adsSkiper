import { createWriteStream } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yazl from "yazl";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const outputDir = path.join(root, "artifacts");
const archivePath = path.join(outputDir, "autoskip-chromium.zip");

async function collectFiles(directory, relativeDirectory = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath, relativePath)));
    } else if (entry.isFile()) {
      files.push({ absolutePath, relativePath });
    }
  }

  return files;
}

await mkdir(outputDir, { recursive: true });
const files = await collectFiles(dist);
const archive = new yazl.ZipFile();
const output = createWriteStream(archivePath);
const completion = new Promise((resolve, reject) => {
  output.on("close", resolve);
  output.on("error", reject);
  archive.outputStream.on("error", reject);
  archive.outputStream.pipe(output);
});

for (const file of files) {
  archive.addFile(file.absolutePath, file.relativePath);
}
archive.end();
await completion;
console.info(`Created ${path.relative(root, archivePath)}`);
