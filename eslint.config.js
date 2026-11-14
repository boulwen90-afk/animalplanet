import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'test-results/',
      'playwright-report/',
      'tools/blender/.venv/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Game logic must stay free of Phaser and the browser so it can be unit tested.
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'phaser', message: 'src/sim must not depend on Phaser.' }],
          patterns: [
            {
              group: ['**/render/**', '**/testing/**'],
              message: 'src/sim must not depend on rendering or test hooks.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'src/sim must not use browser globals.' },
        { name: 'document', message: 'src/sim must not use browser globals.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG instead.' },
        { object: 'Date', property: 'now', message: 'The simulation must be deterministic.' },
      ],
    },
  },
  prettier,
);
