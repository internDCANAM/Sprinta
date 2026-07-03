import tseslint from 'typescript-eslint'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import security from 'eslint-plugin-security'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**'] },

  {
    files: ['backend/src/**/*.ts', 'frontend/src/**/*.{ts,tsx}', 'shared/src/**/*.ts'],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression > TSAsExpression > TSUnknownKeyword',
          message:
            'Double-cast through `unknown` bypasses type checking the same way `any` does — validate the value (e.g. with a Zod schema) instead of asserting its shape.',
        },
      ],
    },
  },

  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
    settings: {
      react: { version: 'detect' },
    },
    languageOptions: {
      globals: globals.browser,
    },
  },

  {
    files: ['backend/src/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    ...security.configs.recommended,
    rules: {
      ...security.configs.recommended.rules,
      'security/detect-object-injection': 'off', // constant false positives on normal array indexing in TypeScript
      'security/detect-non-literal-fs-filename': 'error', // this app serves documents from local storage — path traversal risk is real, not theoretical
      'security/detect-child-process': 'error',
    },
  },

  prettier,
)
