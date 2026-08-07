import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'packages/bangumi-openapi/src/generated/**',
    ],
  },
  {
    files: [
      'scripts/**/*.{js,ts}',
      'tests/**/*.{js,ts}',
      'packages/bangumi-core/src/services/**/*.{js,ts}',
      'packages/tools/src/definitions/**/*.{js,ts}',
      'packages/auth/src/**/*.{js,ts}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
);
