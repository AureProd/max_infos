// Commits conventionnels. La liste des préfixes est celle qui était admise
// par conventional-pre-commit, à l'identique : la règle ne change pas, seul
// l'outil qui l'applique change.
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
    // Les messages de ce dépôt expliquent le POURQUOI : le corps est souvent
    // long, et les règles de longueur par défaut le tronqueraient.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
}
