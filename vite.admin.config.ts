import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'package-cpanel-admin-bundle',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const outDir = path.resolve(__dirname, 'admin-panel-cpanel');
          if (!fs.existsSync(outDir)) {
            return;
          }

          // Rename admin.html -> index.html so cPanel opens the Admin Portal at "/" immediately
          const adminHtmlPath = path.resolve(outDir, 'admin.html');
          const indexHtmlPath = path.resolve(outDir, 'index.html');
          if (fs.existsSync(adminHtmlPath)) {
            fs.renameSync(adminHtmlPath, indexHtmlPath);
          }

          const srcAssets = path.resolve(__dirname, 'src/assets');
          const outAssets = path.resolve(outDir, 'src/assets');
          if (fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, outAssets, { recursive: true, force: true });
          }

          const phpBackendFiles = [
            'api.php',
            'config.php',
            'connection.php',
            'database.php',
            'db.php',
            'marzpay.php',
            'casino_royale.sql',
            '.htaccess',
          ];
          for (const fileName of phpBackendFiles) {
            const srcFile = path.resolve(__dirname, fileName);
            if (fs.existsSync(srcFile)) {
              fs.copyFileSync(srcFile, path.resolve(outDir, fileName));
            }
          }
        },
      },
    ],
    build: {
      outDir: 'admin-panel-cpanel',
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(__dirname, 'admin.html'),
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
