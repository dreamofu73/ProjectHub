import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

const cleanStarterAssetsPlugin = () => ({
  name: 'clean-starter-assets',
  buildStart() {
    ['hero.png', 'react.svg', 'vite.svg'].forEach(file => {
      const p = path.resolve(__dirname, 'src/assets', file);
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch {}
      }
    });

    // Generate multi-resolution valid BMP-header ICO file (16, 32, 48, 64, 128, 256) for Windows File Explorer & Tauri Rust builder
    try {
      const targetIcoPath = path.resolve(__dirname, 'src-tauri/icons/icon.ico');
      const sizes = [16, 32, 48, 64, 128, 256];
      const count = sizes.length;
      let headerLen = 6 + count * 16;
      let currentOffset = headerLen;
      const entries: Buffer[] = [];
      const buffers: Buffer[] = [];

      for (const S of sizes) {
        const imageSize = S * S * 4;
        const maskRowSize = Math.ceil(S / 32) * 4;
        const maskSize = maskRowSize * S;
        const dibHeaderSize = 40;
        const resSize = dibHeaderSize + imageSize + maskSize;

        const entry = Buffer.alloc(16);
        entry.writeUInt8(S === 256 ? 0 : S, 0);
        entry.writeUInt8(S === 256 ? 0 : S, 1);
        entry.writeUInt8(0, 2);
        entry.writeUInt8(0, 3);
        entry.writeUInt16LE(1, 4);
        entry.writeUInt16LE(32, 6);
        entry.writeUInt32LE(resSize, 8);
        entry.writeUInt32LE(currentOffset, 12);
        entries.push(entry);

        currentOffset += resSize;

        const dibHeader = Buffer.alloc(40);
        dibHeader.writeUInt32LE(40, 0);
        dibHeader.writeInt32LE(S, 4);
        dibHeader.writeInt32LE(S * 2, 8);
        dibHeader.writeUInt16LE(1, 12);
        dibHeader.writeUInt16LE(32, 14);
        dibHeader.writeUInt32LE(0, 16);
        dibHeader.writeUInt32LE(imageSize, 20);

        const pixelData = Buffer.alloc(imageSize);
        const cx = (S - 1) / 2;
        const cy = (S - 1) / 2;
        const rCorner = S * 0.35;
        const rCornerSq = (S * 0.16) ** 2;

        for (let y = 0; y < S; y++) {
          const bmpY = S - 1 - y;
          for (let x = 0; x < S; x++) {
            const offset = (bmpY * S + x) * 4;
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const cornerDist = Math.max(0, Math.abs(dx) - rCorner) ** 2 + Math.max(0, Math.abs(dy) - rCorner) ** 2;

            if (cornerDist > rCornerSq) {
              pixelData[offset + 0] = 0; pixelData[offset + 1] = 0; pixelData[offset + 2] = 0; pixelData[offset + 3] = 0;
            } else if (dist <= S * 0.11) {
              pixelData[offset + 0] = 255; pixelData[offset + 1] = 255; pixelData[offset + 2] = 255; pixelData[offset + 3] = 255;
            } else if (dist <= S * 0.17) {
              pixelData[offset + 0] = 202; pixelData[offset + 1] = 56; pixelData[offset + 2] = 67; pixelData[offset + 3] = 255;
            } else if (Math.abs(dx) < Math.max(1, S * 0.045) || Math.abs(dy) < Math.max(1, S * 0.045)) {
              pixelData[offset + 0] = 255; pixelData[offset + 1] = 255; pixelData[offset + 2] = 255; pixelData[offset + 3] = 230;
            } else if (dist <= S * 0.38) {
              pixelData[offset + 0] = 241; pixelData[offset + 1] = 102; pixelData[offset + 2] = 99; pixelData[offset + 3] = 255;
            } else {
              pixelData[offset + 0] = 42; pixelData[offset + 1] = 23; pixelData[offset + 2] = 15; pixelData[offset + 3] = 255;
            }
          }
        }

        const maskData = Buffer.alloc(maskSize, 0);
        buffers.push(Buffer.concat([dibHeader, pixelData, maskData]));
      }

      const icoHeader = Buffer.alloc(6);
      icoHeader.writeUInt16LE(0, 0);
      icoHeader.writeUInt16LE(1, 2);
      icoHeader.writeUInt16LE(count, 4);

      const finalIco = Buffer.concat([icoHeader, ...entries, ...buffers]);
      fs.writeFileSync(targetIcoPath, finalIco);
    } catch {}
  }
});

// Desktop Vite Configuration for ProjectHub
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cleanStarterAssetsPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: false,
        ws: true,
      }
    }
  }
})
