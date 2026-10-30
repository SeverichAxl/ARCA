module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    '.next/',
    'coverage/',
    '**/prisma/migrations-extra/',
    '**/*.d.ts',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-empty-object-type': 'off',
  },
  overrides: [
    {
      files: ['services/*/src/domain/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '**/infrastructure',
                  '**/infrastructure/*',
                  '../infrastructure/*',
                  '../../infrastructure/*',
                  '../../../infrastructure/*',
                ],
                message:
                  'RNF-08: la capa de dominio no puede depender de infraestructura. Use puertos/abstracciones.',
              },
            ],
          },
        ],
      },
    },
  ],
};
