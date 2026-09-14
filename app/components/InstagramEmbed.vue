<script setup lang="ts">
/**
 * Embed officiel Instagram. La publication est rendue par Instagram
 * lui-même : média, légende, flèches de carrousel d'origine. Aucun jeton.
 *
 * Deux contraintes imposées par Instagram, qu'on ne peut pas contourner :
 * le cadre est servi en thème CLAIR, et sa hauteur doit être réservée à
 * l'avance (l'iframe ne sait pas se redimensionner). C'est précisément ce
 * qui motive le passage à des cartes maison au lot 6, alimentées par l'API.
 */
const props = withDefaults(
  defineProps<{
    shortcode: string
    kind?: 'p' | 'reel'
    vertical?: boolean
  }>(),
  { kind: 'p', vertical: true },
)

const src = computed(
  () => `https://www.instagram.com/${props.kind}/${props.shortcode}/embed/captioned/`,
)

/** En-tête du compte, actions et pied du cadre. */
const CHROME = 112
</script>

<template>
  <div
    class="ig-embed"
    :style="{ '--media-ratio': vertical ? 16 / 9 : 1, '--chrome': `${CHROME}px` }"
  >
    <iframe
      :src="src"
      title="Publication Instagram"
      loading="lazy"
      scrolling="no"
      frameborder="0"
    />
  </div>
</template>
