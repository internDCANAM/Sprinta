import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import security from 'eslint-plugin-security';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // ==========================================
  // 1. GLOBAL IGNORES
  // ==========================================
  { ignores: ['**/dist/**', '**/node_modules/**', 'backend/tests/**', 'frontend/tests/**'] },

  // ==========================================
  // 2. BASE TYPESCRIPT RULES (The Strictness Engine)
  // ==========================================
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-namespace': 'off', // Necessary for Express type augmentation
      '@typescript-eslint/no-unused-vars': 'off', // Disabled for faster prototyping
      '@typescript-eslint/no-explicit-any': 'error', // Critical for ISO 27001 compliance

      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression > TSAsExpression > TSUnknownKeyword',
          message:
            'Double-cast through `unknown` bypasses type checking. Validate the value (e.g., with Zod) instead.',
        },
      ],
    },
  },
  // ==========================================
  // 3. FRONTEND (React / Vite)
  // ==========================================
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    extends: [reactPlugin.configs.flat.recommended, reactHooks.configs.flat.recommended],
    languageOptions: {
      globals: globals.browser,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      'react/react-in-jsx-scope': 'off', // Not needed in modern React
      'react/prop-types': 'off', // TypeScript handles props, not PropTypes
    },
  },

  // ==========================================
  // 4. BACKEND (Node / Express / Security)
  // ==========================================
  {
    files: ['backend/src/**/*.ts', 'backend/prisma.config.ts'],
    extends: [
      security.configs.recommended, // Applies security checks primarily to the backend
    ],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'security/detect-object-injection': 'off', // False positive prone on normal array indexing in TypeScript
      'security/detect-non-literal-fs-filename': 'off', // Example of adjusting security rules
    },
  },

  // ==========================================
  // 5. CLI SCRIPTS (console output is the point)
  // ==========================================
  {
    files: ['backend/prisma/seed.ts', 'frontend/tests/proxy-smoke.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // ==========================================
  // 6. FORMATTING RESOLUTION
  // ==========================================
  prettier
);
