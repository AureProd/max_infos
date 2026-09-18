#!/usr/bin/env bash
# Forbids any new `v-html` outside an explicit list.
#
# Biome offers no equivalent of ESLint's `vue/no-v-html` rule. This hook
# replaces it, more strictly: the old configuration accepted any waiver
# written as a comment, this one requires the file to be listed below.
set -euo pipefail

# Une liste blanche qui nomme des fichiers disparus n'est plus une liste
# blanche : elle dit que quelqu'un a cessé de la relire. Deux entrées ne
# correspondaient plus à rien — `SlideView.vue`, supprimé avec le bloc
# « Décliner », et `admin/[slug].vue`, dont l'aperçu est passé dans un
# composant. Le contrôle plus bas refuse désormais une entrée morte.
ALLOWED=(
  # SVG built by the code, from data these modules escape themselves. No
  # user input.
  "app/components/PlateImage.vue"

  # Article body and its preview. The HTML comes from the SERVER, rendered
  # and sanitised by server/utils/markdown.ts at save time — never built in
  # the browser. Every write path sanitises, ARCHIVE IMPORT INCLUDED, so
  # nothing unsanitised can enter the database and nothing unsanitised can
  # come out of it.
  "app/pages/article/[slug].vue"
  "app/components/ArticlePreview.vue"
)

# Une entrée qui ne désigne plus rien, ou un fichier qui n'a plus de
# `v-html`, sort de la liste : sinon elle couvrirait demain un usage que
# personne n'a examiné.
stale=()
for a in "${ALLOWED[@]}"; do
  if [ ! -f "${a}" ] || ! grep -q "v-html" "${a}"; then
    stale+=("${a}")
  fi
done
if [ ${#stale[@]} -gt 0 ]; then
  echo "Liste blanche v-html périmée — ces entrées ne portent plus de v-html :" >&2
  printf '  %s\n' "${stale[@]}" >&2
  echo "Retire-les de scripts/hooks/check-v-html.sh." >&2
  exit 1
fi

offenders=()
while IFS= read -r file; do
  [ -z "${file}" ] && continue
  allowed=0
  for a in "${ALLOWED[@]}"; do
    [ "${file}" = "${a}" ] && allowed=1 && break
  done
  [ "${allowed}" -eq 0 ] && offenders+=("${file}")
done < <(grep -rl --include='*.vue' 'v-html' app/ 2>/dev/null || true)

if [ ${#offenders[@]} -gt 0 ]; then
  echo "/!\\ v-html found in a file that is not allowed:"
  printf '    %s\n' "${offenders[@]}"
  echo
  echo "    v-html inserts HTML without escaping: it is the classic way in"
  echo "    for XSS. If the use is legitimate (SVG built by the code, never"
  echo "    user input), add the file to the ALLOWED list of"
  echo "    scripts/hooks/check-v-html.sh, explaining why in the commit"
  echo "    message."
  exit 1
fi
