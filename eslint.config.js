import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  reactHooks.configs.flat.recommended,
  { rules: { 'react/prop-types': 'off', 'react-hooks/set-state-in-effect': 'off', 'react-hooks/refs': 'off' } },
  {
    files: ['src/**/*.{ts,tsx}'],
    settings: { react: { version: 'detect' } },
    languageOptions: { globals: { window: 'readonly', document: 'readonly', Image: 'readonly', URL: 'readonly', File: 'readonly', Blob: 'readonly', crypto: 'readonly', HTMLElement: 'readonly', KeyboardEvent: 'readonly', HTMLDivElement: 'readonly', HTMLInputElement: 'readonly', HTMLImageElement: 'readonly' } },
  },
);
