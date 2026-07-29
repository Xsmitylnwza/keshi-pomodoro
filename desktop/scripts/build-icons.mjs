import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, 'assets', 'keshi-icon.svg');
const outputDirectory = path.join(root, 'assets', 'generated');
const svg = await readFile(source);

await mkdir(outputDirectory, { recursive: true });
const pngPaths = [];
for (const size of [16, 24, 32, 48, 64, 128, 256]) {
  const output = path.join(outputDirectory, `keshi-icon-${size}.png`);
  await sharp(svg).resize(size, size).png().toFile(output);
  pngPaths.push(output);
}
await sharp(svg).resize(512, 512).png().toFile(path.join(outputDirectory, 'keshi-icon.png'));
await writeFile(
  path.join(outputDirectory, 'keshi-icon.ico'),
  await pngToIco(pngPaths),
);
