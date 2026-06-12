// Generates the PWA icon set into public/icons. Run once: npm run icons
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

// SSM wordmark on the app's dark blue, with the accent bar from the header.
function logoSvg(size, pad = 0) {
  const s = size;
  const inner = s - pad * 2;
  const fontSize = Math.round(inner * 0.32);
  const barH = Math.round(inner * 0.10);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  <rect width="${s}" height="${s}" fill="#0F2137"/>
  <rect x="${pad}" y="${s - pad - barH}" width="${inner}" height="${barH}" fill="#2E6DB4"/>
  <text x="50%" y="${Math.round(s * 0.52)}" text-anchor="middle" dominant-baseline="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="bold"
        font-size="${fontSize}" letter-spacing="${Math.round(fontSize * 0.08)}"
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
