// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'node_modules/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js', '*.mjs', 'scripts/*.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.node, chrome: 'readonly' },
    },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // YouTube selectors must stay inside the adapter layer.
    files: ['src/**/*.ts'],
    ignores: ['src/youtube/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/yt-live-chat|ytd-|yt-emoji|yt-formatted-string|yt-button/]',
          message: 'YouTube DOM selectors must live in src/youtube/.',
        },
        {
          selector:
            'TemplateElement[value.raw=/yt-live-chat|ytd-|yt-emoji|yt-formatted-string|yt-button/]',
          message: 'YouTube DOM selectors must live in src/youtube/.',
        },
      ],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
