#!/usr/bin/env bash
# Interdit tout nouveau `v-html` en dehors d'une liste explicite.
#
# Biome ne fournit pas l'équivalent de la règle `vue/no-v-html` d'ESLint.
# Ce hook la remplace, en plus strict : l'ancienne configuration acceptait
# n'importe quelle dérogation posée en commentaire, celle-ci exige que le
# fichier soit inscrit ci-dessous.
#
# Les deux fichiers autorisés injectent du SVG qu'ils ont eux-mêmes
# construit, à partir de données déjà échappées — jamais de saisie
# utilisateur. Le rendu Markdown des articles, lui, sera assaini côté
# serveur au lot 5 et stocké en base : il n'a pas besoin de dérogation.
set -euo pipefail

AUTORISES=(
  "app/components/PlateImage.vue"
  "app/components/SlideView.vue"
)

fautifs=()
while IFS= read -r fichier; do
  [ -z "${fichier}" ] && continue
  permis=0
  for a in "${AUTORISES[@]}"; do
    [ "${fichier}" = "${a}" ] && permis=1 && break
  done
  [ "${permis}" -eq 0 ] && fautifs+=("${fichier}")
done < <(grep -rl --include='*.vue' 'v-html' app/ 2>/dev/null || true)

if [ ${#fautifs[@]} -gt 0 ]; then
  echo "/!\\ v-html trouvé dans un fichier non autorisé :"
  printf '    %s\n' "${fautifs[@]}"
  echo
  echo "    v-html insère du HTML sans échappement : c'est la porte d'entrée"
  echo "    classique du XSS. Si l'usage est légitime (SVG construit par le"
  echo "    code, jamais de saisie utilisateur), ajouter le fichier à la"
  echo "    liste AUTORISES de scripts/hooks/check-v-html.sh, en expliquant"
  echo "    pourquoi dans le message de commit."
  exit 1
fi
