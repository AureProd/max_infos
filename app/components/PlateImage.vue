<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    seed: number
    w?: number
    h?: number
    alt?: string
  }>(),
  { w: 400, h: 400, alt: "Visuel d'atelier" },
)

const p = computed(() => plate(props.seed, props.w, props.h))
</script>

<template>
  <!--
    v-html assumé : le SVG est construit par app/utils/plate.ts à partir
    d'une seule graine numérique. Aucune saisie utilisateur n'y entre.
    Ce fichier figure dans la liste autorisée de scripts/hooks/check-v-html.sh.
  -->
  <svg
    class="plate"
    :viewBox="p.viewBox"
    :style="{ aspectRatio: p.ratio }"
    preserveAspectRatio="xMidYMid slice"
    role="img"
    :aria-label="alt"
    v-html="p.inner"
  />
</template>
