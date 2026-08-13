import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import security from 'eslint-plugin-security';
import globals from 'globals';

export default defineConfig(
  // ==========================================
  // 1. GLOBAL IGNORES
  // ==========================================
  // Build output and dependencies only. Test directories are linted like any
  // other source — see section 5 for the one rule they relax.
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },

  // ==========================================
  // 2. BASE TYPESCRIPT RULES (The Strictness Engine)
  // ==========================================
  // Applies to every .ts/.tsx file in the workspace. Later sections add to this,
  // they never replace it.
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
      // --- Type safety ---
      '@typescript-eslint/no-namespace': 'off',      // Needed for Express type augmentation
      '@typescript-eslint/no-unused-vars': 'off',    // Disabled for faster prototyping
      '@typescript-eslint/no-explicit-any': 'error', // Critical for ISO 27001 compliance
      '@typescript-eslint/no-deprecated': 'error',   // Stay updated...

      // --- Security & hygiene ---
      'no-eval': 'error',         // Arbitrary code execution
      'no-implied-eval': 'error', // Same risk via setTimeout('...') / new Function('...')
      'no-console': 'error',      // Logs leak data — relaxed for tests in section 5

      // Double-casting through `unknown` launders any value into any type, which
      // defeats `no-explicit-any` above without ever writing the word `any`.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression > TSAsExpression > TSUnknownKeyword',
          message:
            'Double-cast through `unknown` bypasses type checking. Validate the value (e.g., with Zod) instead.',
        },
      ],

      // --- Formatting ---
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }],
      indent: ['error', 2, { SwitchCase: 1 }],
      'comma-dangle': [
        'error',
        {
          arrays: 'always-multiline',
          objects: 'always-multiline',
          imports: 'always-multiline',
          exports: 'always-multiline',
          functions: 'never',
        },
      ],
      'max-len': [
        'error',
        {
          code: 100,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
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
      'react/prop-types': 'off',         // TypeScript handles props, not PropTypes
    },
  },

  // ==========================================
  // 4. BACKEND (Node / Express / Security)
  // ==========================================
  // The security plugin is scoped here rather than globally — its checks target
  // server-side sinks (fs, child_process, non-literal regex).
  {
    files: ['backend/src/**/*.ts', 'backend/prisma.config.ts'],
    extends: [security.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'security/detect-object-injection': 'off',        // False positives on normal array indexing
      'security/detect-non-literal-fs-filename': 'off', // Example of adjusting security rules
    },
  },

  // ==========================================
  // 5. TESTS (Vitest)
  // ==========================================
  // Tests get the full strictness engine from section 2. This block relaxes the
  // single rule that does not apply to them.
  {
    files: ['**/tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': 'off', // Tests report progress and results to stdout
    },
  },
);
