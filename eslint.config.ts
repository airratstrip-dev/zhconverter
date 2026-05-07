import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig([
    {
        files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
        plugins: { js },
        rules: {
            'semi': ['error', 'always'],           // 強制結尾分號
            'quotes': ['warn', 'single'],         // 使用單引號
            'indent': ['error', 4],                // 強制縮排 4 個空格
            'brace-style': ['error', 'stroustrup'] // 大括號風格使用 Stroustrup
        },
        languageOptions: { globals: globals.browser }
    },
    tseslint.configs.recommended,
]);
