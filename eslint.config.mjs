// @ts-check
import js from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import importPlugin from 'eslint-plugin-import';
import promisePlugin from 'eslint-plugin-promise';
import sonarjs from 'eslint-plugin-sonarjs';
import unusedImports from 'eslint-plugin-unused-imports';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // 1. Игнорируемые директории
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'database/**', '**/*.js'],
  },

  // 2. Базовые конфигурации
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  eslintPluginPrettierRecommended,

  // 3. Основные правила для TypeScript
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    settings: {
      'import/resolver': {
        typescript: true,
      },
    },
    plugins: {
      import: importPlugin,
      'unused-imports': unusedImports,
      promise: promisePlugin,
      sonarjs,
      // boundaries,
    },
    rules: {
      // ----- TYPESCRIPT (СТРОГО) -----
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      // '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowNumber: true,
        },
      ],
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
      '@typescript-eslint/no-unused-vars': 'off',

      // ----- UNUSED IMPORTS -----
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],

      // ----- IMPORTS (АРХИТЕКТУРА) -----
      'import/order': [
        'error',
        {
          groups: [['builtin', 'external'], ['internal'], ['parent', 'sibling', 'index']],
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
          'newlines-between': 'always',
        },
      ],

      'import/no-cycle': 'error',

      // ----- PROMISE -----
      'promise/catch-or-return': ['error', { allowFinally: true }],

      // ----- РАЗМЕР И СЛОЖНОСТЬ -----
      'max-lines': ['error', 500],
      'max-lines-per-function': ['error', 80],
      'max-params': ['error', 4],
      'complexity': ['error', 10],

      // ----- МАГИЧЕСКИЕ ЧИСЛА -----
      'no-magic-numbers': [
        'warn',
        {
          ignore: [0, 1, -1, 2, 60, 1000, 24, 3600, 10_080],
          ignoreArrayIndexes: true,
          enforceConst: true,
        },
      ],

      // ----- SONARJS -----
      'sonarjs/no-identical-functions': ['error',  3 ],
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-duplicate-string': ['error', { threshold: 5 }],
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-use-of-empty-return-value': 'error',
      'sonarjs/no-collapsible-if': 'error',
      'sonarjs/no-redundant-boolean': 'error',
      'sonarjs/prefer-immediate-return': 'warn',
      'sonarjs/no-useless-catch': 'error',
      'sonarjs/prefer-while': 'warn',

      // ----- SONARJS (ВЫКЛЮЧЕННЫЕ) -----
      'sonarjs/no-all-duplicated-branches': 'off',
      'sonarjs/no-element-overwrite': 'off',
      'sonarjs/no-extra-semicolon': 'off',
      'sonarjs/no-redundant-jump': 'off',
      'sonarjs/no-nested-template-literals': 'off',

      // ----- NAMING CONVENTIONS -----
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase'],
          prefix: ['I'],
        },
        {
          selector: 'typeAlias',
          format: ['PascalCase'],
        },
        {
          selector: 'enum',
          format: ['PascalCase'],
        },
        {
          selector: 'class',
          format: ['PascalCase'],
        },
        {
          selector: ['function', 'method'],
          format: ['camelCase'],
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE'],
        },
      ],

      // ----- PRETTIER -----
      'prettier/prettier': [
        'error',
        {
          endOfLine: 'lf',
          singleQuote: true,
          trailingComma: 'all',
          printWidth: 100,
        },
      ],
    },
  },

  // 4. СПЕЦИАЛЬНЫЕ ПРАВИЛА ДЛЯ ТЕСТОВ
  {
    files: ['**/*.spec.ts', '**/*.test.ts', 'test/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'max-params': 'off',
      'complexity': 'off',
      'no-magic-numbers': 'off',
      'sonarjs/no-identical-functions': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'import/no-relative-parent-imports': 'off',
      'import/no-cycle': 'off',
      'boundaries/element-types': 'off',
    },
  },

  // 5. СПЕЦИАЛЬНЫЕ ПРАВИЛА ДЛЯ MIGRATION SCRIPTS
  {
    files: ['database/migrations/**/*.sql.ts'],
    rules: {
      'no-magic-numbers': 'off',
      'max-lines': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'boundaries/element-types': 'off',
    },
  },
);
