import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  { ignores: ['**/node_modules/**', 'frontend/dist/**', 'backend/data/**', 'coverage/**'] },
  js.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: ['backend/**/*.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['netlify/functions/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  },
  {
    files: ['frontend/src/**/*.{js,vue}', 'frontend/test/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } }
  },
  {
    rules: {
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
      'vue/multi-word-component-names': 'off'
    }
  }
]
