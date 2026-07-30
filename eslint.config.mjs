import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/** @type {import('eslint').Linter.FlatConfig[]} */
const nextConfig = require('eslint-config-next/core-web-vitals');

/** @type {import('eslint').Linter.FlatConfig[]} */
const eslintConfig = [
  {
    // Klien Prisma hasil generate — tidak pernah disunting tangan, dan isinya
    // menyumbang 2.637 dari 2.808 error saat pertama kali lint bisa dijalankan
    // lagi. Membiarkannya berarti output lint tidak terpakai.
    ignores: ['src/generated/**'],
  },
  ...nextConfig,
  {
    settings: {
      react: { version: '19' },
    },
    rules: {
      'prefer-const': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Aturan @typescript-eslint HARUS dibatasi ke file TypeScript. Di flat
    // config, sebuah rule bernama `@typescript-eslint/x` hanya sah kalau plugin
    // itu terdaftar untuk file yang sedang dilint — dan eslint-config-next
    // mendaftarkannya hanya untuk ts/tsx. Tanpa batas `files` di bawah, blok ini
    // ikut mengenai src/app/[locale]/signup/page.jsx (satu-satunya file .jsx),
    // dan ESLint berhenti dengan "plugin @typescript-eslint is not defined"
    // untuk SELURUH perintah — itulah sebabnya `npm run lint` mati total
    // meski `eslint <file>.ts` satuan tetap jalan.
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
];

export default eslintConfig;
