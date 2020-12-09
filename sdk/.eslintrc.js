module.exports = {
  parser: '@typescript-eslint/parser', // Specifies the ESLint parser
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
    ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
    sourceType: 'module' // Allows for the use of imports
  },
  plugins: ['@typescript-eslint', 'jest'],
  env: {
    es6: true,
    node: true,
    jest: true
  },

  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended', // Uses the recommended rules from the @typescript-eslint/eslint-plugin
    // 'plugin:prettier/recommended',
    'prettier/@typescript-eslint', // Uses eslint-config-prettier to disable ESLint rules from @typescript-eslint/eslint-plugin that would conflict with prettier
    'plugin:jest/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/recommended-requiring-type-checking'
  ],

  rules: {
    '@typescript-eslint/ban-ts-ignore': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/prefer-regexp-exec': 'off',
    '@typescript-eslint/require-await': 'off',
    'no-warning-comments': 'off',
    'max-lines-per-function': ['error', 100],
    'arrow-parens': ['error', 'as-needed'],
    'arrow-spacing': [
      'error',
      {
        after: true,
        before: true
      }
    ],
    camelcase: ['error', { properties: 'never' }],
    '@typescript-eslint/camelcase': ['error', { properties: 'never' }],
    'capitalized-comments': 'off',
    'class-methods-use-this': 'error',
    'comma-dangle': 'error',
    'comma-spacing': [
      'error',
      {
        after: true,
        before: false
      }
    ],
    'comma-style': ['error', 'last'],
    complexity: 'error',
    'computed-property-spacing': 'error',
    'consistent-return': 'warn',
    'consistent-this': 'error',
    curly: 'off',
    'default-case': 'error',
    'dot-location': 'off',
    'dot-notation': 'error',
    'eol-last': 'error',
    eqeqeq: 'error',
    'id-length': 'off',
    'indent-legacy': 'off',
    'init-declarations': 'error',
    'jsx-quotes': 'error',
    'key-spacing': 'error',
    'keyword-spacing': [
      'error',
      {
        after: true,
        before: true
      }
    ],
    'no-debugger': [0],
    'linebreak-style': ['error', 'unix'],
    'max-len': 'off',
    'max-params': 'off',
    'max-statements': 'off',
    'multiline-comment-style': ['error', 'separate-lines'],
    'multiline-ternary': 'off',
    'newline-after-var': 'off',
    'newline-before-return': 'off',
    'no-await-in-loop': 'off',
    'no-catch-shadow': 'off',
    'no-confusing-arrow': 'off',
    'no-implicit-coercion': 'off',
    'no-magic-numbers': 'off',
    'no-mixed-operators': 1,
    'no-nested-ternary': 'off',
    'no-process-env': 'off',
    'no-process-exit': 'off',
    'no-sync': 'off',
    'no-ternary': 'off',
    'no-throw-literal': 'warn',
    'no-undefined': 'off',
    'no-underscore-dangle': ['error', { allow: ['_state', '__scope__'] }],
    'no-unused-vars': 'off', // causing issue with TS types
    'object-curly-spacing': ['error', 'always'],
    'object-property-newline': [
      'error',
      {
        allowAllPropertiesOnSameLine: true
      }
    ],
    'one-var': 'off',
    'no-console': 'off',
    'padded-blocks': 'off',
    'prefer-named-capture-group': 'off',
    'prefer-reflect': 'off',
    'quote-props': 'off',
    quotes: ['error', 'single'],
    'require-atomic-updates': 'off',
    'require-await': 'off',
    'require-jsdoc': 'warn',
    'require-unicode-regexp': 'off',
    'semi-style': ['error', 'last'],
    'sort-imports': 'off',
    'sort-keys': 'off',
    'space-in-parens': ['error', 'never'],
    'spaced-comment': ['error', 'always'],
    strict: ['error', 'never'],
    'unicode-bom': ['error', 'never']
  }
};
