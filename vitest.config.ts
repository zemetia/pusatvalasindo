import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: true,
    // `.claude/worktreesnya` berisi checkout git terpisah milik sesi agent —
    // salinan penuh src/ termasuk file test versi lama. Tanpa dikecualikan,
    // vitest menjalankan test dari checkout LAIN dan melaporkan kegagalan yang
    // tidak berhubungan sama sekali dengan kode di direktori kerja ini.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.claude/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        '.next',
        '.storybook',
        '**/*.stories.tsx',
        '**/*.config.*',
        '**/index.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@src': resolve(__dirname, './src'),
    },
  },
});
