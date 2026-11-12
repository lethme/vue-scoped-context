import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
    {
        ignores: [
            './**/dist/**',
            'dist/**',
            './**/node_modules/**',
            'node_modules/**',
            './**/coverage/**',
            'coverage/**',
            './**/playground/**',
            'playground/**',
        ],
    },

    ...tseslint.configs.recommended,

    {
        files: ['**/*.{js,mjs,cjs,ts,tsx}'],

        plugins: {
            '@stylistic': stylistic,
        },

        rules: {
            // Formatting
            '@stylistic/indent': ['error', 4, {
                SwitchCase: 1,
            }],
            '@stylistic/object-curly-spacing': ['error', 'always'],
            '@stylistic/array-bracket-spacing': ['error', 'never'],
            '@stylistic/quotes': ['error', 'single', {
                avoidEscape: true,
            }],
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/comma-dangle': ['error', 'always-multiline'],
            '@stylistic/eol-last': ['error', 'always'],
            '@stylistic/no-trailing-spaces': ['error', {
                skipBlankLines: true,
            }],
            '@stylistic/no-multiple-empty-lines': ['error', {
                max: 1,
                maxEOF: 0,
            }],
            '@stylistic/key-spacing': ['error', {
                beforeColon: false,
                afterColon: true,
            }],
            '@stylistic/space-before-function-paren': ['error', {
                anonymous: 'always',
                named: 'never',
                asyncArrow: 'always',
            }],
            '@stylistic/arrow-spacing': 'error',
            '@stylistic/space-infix-ops': 'error',
            '@stylistic/keyword-spacing': 'error',
            '@stylistic/space-before-blocks': 'error',

            // TypeScript
            '@typescript-eslint/consistent-type-imports': ['error', {
                prefer: 'type-imports',
                fixStyle: 'inline-type-imports',
            }],
        },
    },
);
