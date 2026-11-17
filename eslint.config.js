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
  {
    // Two players' games stay alike only if every number comes out the same
    // in both browsers. These functions may round differently from engine to
    // engine; src/sim/math.ts has ones that do not. Tests may use them to
    // compare with.
    files: ['src/sim/**/*.ts'],
    ignores: ['src/sim/**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'src/sim must not use browser globals.' },
        { name: 'document', message: 'src/sim must not use browser globals.' },
        { name: 'Date', message: 'The simulation must not read the clock.' },
        { name: 'performance', message: 'The simulation must not read the clock.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG instead.' },
        ...[
          ['hypot', 'Use length() from src/sim/math.ts.'],
          ['sin', 'Use sin() from src/sim/math.ts.'],
          ['cos', 'Use cos() from src/sim/math.ts.'],
          ...[
            'tan',
            'asin',
            'acos',
            'atan',
            'atan2',
            'sinh',
            'cosh',
            'tanh',
            'asinh',
            'acosh',
            'atanh',
            'exp',
            'expm1',
            'log',
            'log1p',
            'log2',
            'log10',
            'pow',
            'cbrt',
          ].map((name) => [name, 'Its last digit differs between engines. See src/sim/math.ts.']),
        ].map(([property, message]) => ({ object: 'Math', property, message })),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "BinaryExpression[operator='**'], AssignmentExpression[operator='**=']",
          message: 'A power may round differently between engines. Multiply instead.',
        },
      ],
    },
  },
  prettier,
);
