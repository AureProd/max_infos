#!/usr/bin/env bash
# Forbids any new `v-html` outside an explicit list.
#
# Biome offers no equivalent of ESLint's `vue/no-v-html` rule. This hook
# replaces it, more strictly: the old configuration accepted any waiver
# written as a comment, this one requires the file to be listed below.
set -euo pipefail

ALLOWED=(
  # SVG built by the code, from data these modules escape themselves. No
  # user input.
  "app/components/PlateImage.vue"
  "app/components/SlideView.vue"

  # Article body and its preview. The HTML comes from the SERVER, rendered
  # and sanitised by server/utils/markdown.ts at save time — never built in
  # the browser. Nothing unsanitised can enter the database, so nothing
  # unsanitised can come out of it.
  "app/pages/article/[slug].vue"
  "app/pages/admin/[slug].vue"
  "app/components/ArticlePreview.vue"
)

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
