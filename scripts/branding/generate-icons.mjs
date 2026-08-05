#!/usr/bin/env node
/**
 * ProjectHub brand icon generator.
 *
 * Single source of truth lives in `assets/branding/`:
 *   - icon.svg        full-detail master, used for every raster >= SMALL_MAX + 1 px
 *   - icon-small.svg  simplified master, used for every raster <= SMALL_MAX px
 *
 * Everything this script writes is a DERIVED artefact. Never hand-edit the
 * outputs; edit a master and re-run:
 *
 *   node scripts/branding/generate-icons.mjs
 *
 * Rasterisation goes through the Playwright Chromium already present in the
 * repo (dev-time only dependency, never shipped), so the SVG masters stay the
 * authoritative geometry instead of a hand-maintained drawing script.
 */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BRANDING = join(ROOT, 'assets', 'branding');
const TAURI_ICONS = join(ROOT, 'apps', 'desktop', 'src-tauri', 'icons');
const WEB_PUBLIC = join(ROOT, 'apps', 'web', 'public');
const DESKTOP_PUBLIC = join(ROOT, 'apps', 'desktop', 'public');

/** Rasters at or below this width use the simplified master. */
const SMALL_MAX = 56;

/** Frames packed into every .ico we emit. */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/** `type -> pixel size` table for the macOS .icns container. */
const ICNS_ENTRIES = [
  ['ic11', 32],
  ['ic12', 64],
  ['ic07', 128],
  ['ic08', 256],
  ['ic13', 256],
  ['ic09', 512],
  ['ic14', 512],
  ['ic10', 1024],
];

/**
 * Tauri icon set — path relative to src-tauri/icons -> pixel size.
 * Sizes mirror what `tauri icon` emits so the bundle layout stays unchanged.
 */
const TAURI_PNGS = {
  '32x32.png': 32,
  '64x64.png': 64,
  '128x128.png': 128,
  '128x128@2x.png': 256,
  'icon.png': 512,
  'Square30x30Logo.png': 30,
  'Square44x44Logo.png': 44,
  'Square71x71Logo.png': 71,
  'Square89x89Logo.png': 89,
  'Square107x107Logo.png': 107,
  'Square142x142Logo.png': 142,
  'Square150x150Logo.png': 150,
  'Square284x284Logo.png': 284,
  'Square310x310Logo.png': 310,
  'StoreLogo.png': 50,
  'android/mipmap-mdpi/ic_launcher.png': 48,
  'android/mipmap-mdpi/ic_launcher_round.png': 48,
  'android/mipmap-mdpi/ic_launcher_foreground.png': 108,
  'android/mipmap-hdpi/ic_launcher.png': 49,
  'android/mipmap-hdpi/ic_launcher_round.png': 49,
  'android/mipmap-hdpi/ic_launcher_foreground.png': 162,
  'android/mipmap-xhdpi/ic_launcher.png': 96,
  'android/mipmap-xhdpi/ic_launcher_round.png': 96,
  'android/mipmap-xhdpi/ic_launcher_foreground.png': 216,
  'android/mipmap-xxhdpi/ic_launcher.png': 144,
  'android/mipmap-xxhdpi/ic_launcher_round.png': 144,
  'android/mipmap-xxhdpi/ic_launcher_foreground.png': 324,
  'android/mipmap-xxxhdpi/ic_launcher.png': 192,
  'android/mipmap-xxxhdpi/ic_launcher_round.png': 192,
  'android/mipmap-xxxhdpi/ic_launcher_foreground.png': 432,
  'ios/AppIcon-20x20@1x.png': 20,
  'ios/AppIcon-20x20@2x.png': 40,
  'ios/AppIcon-20x20@2x-1.png': 40,
  'ios/AppIcon-20x20@3x.png': 60,
  'ios/AppIcon-29x29@1x.png': 29,
  'ios/AppIcon-29x29@2x.png': 58,
  'ios/AppIcon-29x29@2x-1.png': 58,
  'ios/AppIcon-29x29@3x.png': 87,
  'ios/AppIcon-40x40@1x.png': 40,
  'ios/AppIcon-40x40@2x.png': 80,
  'ios/AppIcon-40x40@2x-1.png': 80,
  'ios/AppIcon-40x40@3x.png': 120,
  'ios/AppIcon-60x60@2x.png': 120,
  'ios/AppIcon-60x60@3x.png': 180,
  'ios/AppIcon-76x76@1x.png': 76,
  'ios/AppIcon-76x76@2x.png': 152,
  'ios/AppIcon-83.5x83.5@2x.png': 167,
  'ios/AppIcon-512@2x.png': 1024,
};

/** Rewrite the master's `width`/`height` so an <img> gets an intrinsic size. */
function sizedSvg(svg, size) {
  return svg.replace(
    /<svg([^>]*?)\swidth="[^"]*"\s+height="[^"]*"/,
    `<svg$1 width="${size}" height="${size}"`,
  );
}

/** Rasterise one master at one size, returning both PNG bytes and raw RGBA. */
async function raster(page, svg, size) {
  const result = await page.evaluate(
    async ({ markup, px }) => {
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
      await img.decode();

      const canvas = document.createElement('canvas');
      canvas.width = px;
      canvas.height = px;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, px, px);

      return {
        rgba: Array.from(ctx.getImageData(0, 0, px, px).data),
        dataUrl: canvas.toDataURL('image/png'),
      };
    },
    { markup: sizedSvg(svg, size), px: size },
  );

  return {
    size,
    rgba: Buffer.from(result.rgba),
    png: Buffer.from(result.dataUrl.slice('data:image/png;base64,'.length), 'base64'),
  };
}

/** Pack RGBA into the bottom-up 32bpp DIB that an .ico BMP frame expects. */
function bmpFrame({ size, rgba }) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // colour rows + AND mask rows
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);

  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const src = (size - 1 - y) * size * 4; // DIBs are stored bottom-up
    const dst = y * size * 4;
    for (let x = 0; x < size; x += 1) {
      pixels[dst + x * 4 + 0] = rgba[src + x * 4 + 2]; // B
      pixels[dst + x * 4 + 1] = rgba[src + x * 4 + 1]; // G
      pixels[dst + x * 4 + 2] = rgba[src + x * 4 + 0]; // R
      pixels[dst + x * 4 + 3] = rgba[src + x * 4 + 3]; // A
    }
  }

  // 1bpp AND mask, DWORD-aligned rows. Left zeroed: the alpha channel owns
  // transparency on every Windows version this app targets.
  const mask = Buffer.alloc(Math.ceil(size / 32) * 4 * size);
  return Buffer.concat([header, pixels, mask]);
}

/**
 * Assemble an .ico. Frames <= 128px are stored as BMP and 256px as PNG, which
 * is the layout Windows and `tauri-winres` both expect.
 */
function buildIco(frames) {
  const payloads = frames.map((frame) =>
    frame.size >= 256 ? frame.png : bmpFrame(frame),
  );

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(frames.length, 4);

  const directory = Buffer.alloc(16 * frames.length);
  let offset = header.length + directory.length;

  frames.forEach((frame, index) => {
    const at = index * 16;
    directory.writeUInt8(frame.size >= 256 ? 0 : frame.size, at + 0);
    directory.writeUInt8(frame.size >= 256 ? 0 : frame.size, at + 1);
    directory.writeUInt8(0, at + 2); // palette size
    directory.writeUInt8(0, at + 3); // reserved
    directory.writeUInt16LE(1, at + 4); // colour planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(payloads[index].length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += payloads[index].length;
  });

  return Buffer.concat([header, directory, ...payloads]);
}

/** Assemble a PNG-backed .icns container. */
function buildIcns(pngBySize) {
  const chunks = ICNS_ENTRIES.map(([type, size]) => {
    const data = pngBySize.get(size);
    const head = Buffer.alloc(8);
    head.write(type, 0, 4, 'ascii');
    head.writeUInt32BE(8 + data.length, 4);
    return Buffer.concat([head, data]);
  });

  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(8);
  head.write('icns', 0, 4, 'ascii');
  head.writeUInt32BE(8 + body.length, 4);
  return Buffer.concat([head, body]);
}

async function emit(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
  return path;
}

async function main() {
  const full = await readFile(join(BRANDING, 'icon.svg'), 'utf8');
  const small = await readFile(join(BRANDING, 'icon-small.svg'), 'utf8');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><body>');

  const cache = new Map();
  const at = async (size) => {
    if (!cache.has(size)) {
      cache.set(size, await raster(page, size <= SMALL_MAX ? small : full, size));
    }
    return cache.get(size);
  };

  let written = 0;

  // 1. Tauri icon set.
  for (const [relative, size] of Object.entries(TAURI_PNGS)) {
    await emit(join(TAURI_ICONS, relative), (await at(size)).png);
    written += 1;
  }

  // 2. Windows .ico — the file `tauri-build` embeds as the exe/window icon.
  const icoFrames = [];
  for (const size of ICO_SIZES) icoFrames.push(await at(size));
  const ico = buildIco(icoFrames);
  await emit(join(TAURI_ICONS, 'icon.ico'), ico);
  await emit(join(WEB_PUBLIC, 'favicon.ico'), ico);
  written += 2;

  // 3. macOS .icns.
  const icnsPngs = new Map();
  for (const [, size] of ICNS_ENTRIES) icnsPngs.set(size, (await at(size)).png);
  await emit(join(TAURI_ICONS, 'icon.icns'), buildIcns(icnsPngs));
  written += 1;

  // 4. iOS home-screen icon for the web app.
  await emit(join(WEB_PUBLIC, 'apple-touch-icon.png'), (await at(180)).png);
  written += 1;

  // 5. The one SVG each app ships, copied verbatim from the master.
  for (const dir of [WEB_PUBLIC, DESKTOP_PUBLIC]) {
    await emit(join(dir, 'favicon.svg'), full);
    written += 1;
  }

  await browser.close();
  console.log(`generated ${written} brand assets from assets/branding/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
