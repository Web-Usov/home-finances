// Shared ESLint 9 flat-config presets.
// Usage in a package's eslint.config.mjs:
//   import { node } from '@family-budget/eslint-config';
//   export default [...node, { ignores: ['dist/**'] }];
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/** Files and folders that are never linted (build output and generated code). */
export const ignores = [
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.expo/**',
  '**/.turbo/**',
  '**/node_modules/**',
  '**/web-build/**',
  // Orval output: regenerated from swagger.json, never edited by hand.
  '**/src/api/**',
  // Prisma generated client.
  '**/prisma/generated/**',
];

/** Language-agnostic TypeScript rules shared by every preset. */
export const base = tseslint.config(
  { ignores },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'warn',
    },
  },
  {
    // Tests and tool configs may log freely.
    files: ['**/*.config.*', '**/*.spec.ts', '**/*.int-spec.ts', '**/*.test.{ts,tsx}', 'test/**', 'scripts/**'],
    rules: { 'no-console': 'off' },
  },
  {
    // CommonJS tool configs (babel, metro, tailwind, orval, jest) need require/module.
    files: ['**/*.{js,cjs}'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  // Must stay last: turns off rules that conflict with Prettier.
  prettier,
);

/** NestJS / Node packages. */
export const node = tseslint.config(...base, {
  languageOptions: { globals: { ...globals.node, ...globals.es2022 } },
});

/** Expo / React Native packages. */
export const reactNative = tseslint.config(...base, {
  files: ['**/*.{ts,tsx,js,jsx}'],
  plugins: { react, 'react-hooks': reactHooks },
  languageOptions: {
    globals: { ...globals.es2022, __DEV__: 'readonly' },
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  settings: { react: { version: 'detect' } },
  rules: {
    ...react.configs.recommended.rules,
    ...reactHooks.configs.recommended.rules,
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
  },
});

export default { base, node, reactNative, ignores };
