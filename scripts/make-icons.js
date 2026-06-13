// Generates the PWA icon set into public/icons. Run once: npm run icons
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

// SSM wordmark on the brand gradient — matches the in-app logo chip.
function logoSvg(size, pad = 0) {
  const s = size;
  const fontSize = Math.round((s - pad * 2) * 0.30);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2E6FE8"/>
      <stop offset="1" stop-color="#1448AC"/>
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" fill="url(#g)"/>
  <text x="50%" y="${Math.round(s * 0.53)}" text-anchor="middle" dominant-baseline="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="bold"
        font-size="${fontSize}" letter-spacing="${Math.round(fontSize * 0.06)}"
        fill="#FFFFFF">SSM</text>
</svg>`;
}

const targets = [
  { name: 'icon-192.png', size: 192, pad: 0 },
  { name: 'icon-512.png', size: 512, pad: 0 },
  { name: 'icon-512-maskable.png', size: 512, pad: 64 }, // safe zone for maskable
  { name: 'apple-touch-icon.png', size: 180, pad: 0 },
  { name: 'favicon-32.png', size: 32, pad: 0 },
];

for (const t of targets) {
  await sharp(Buffer.from(logoSvg(t.size, t.pad))).png().toFile(path.join(outDir, t.name));
  console.log('made', t.name);
}
