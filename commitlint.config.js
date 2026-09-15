// Conventional commits. The list of prefixes is the one
// conventional-pre-commit allowed, unchanged: the rule stays the same, only
// the tool applying it changes.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    // The messages of this repository explain WHY: the body is often long,
    // and the default length rules would truncate it.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
}
