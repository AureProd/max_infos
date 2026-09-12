<script setup>
import { computed } from 'vue'

/**
 * Embed officiel Instagram. La publication est rendue par Instagram
 * lui-même : média, légende, flèches de carrousel d'origine. Aucun jeton.
 *
 * Deux contraintes imposées par Instagram, qu'on ne peut pas contourner :
 * le cadre est servi en thème clair, et sa hauteur doit être réservée à
 * l'avance (l'iframe ne sait pas se redimensionner toute seule).
 * Un Reel vertical occupe 9:16, plus l'en-tête et le pied du cadre.
 */
const props = defineProps({
  shortcode: { type: String, required: true },
  kind: { type: String, default: 'p' },
  vertical: { type: Boolean, default: true }
})

const src = computed(
  () => `https://www.instagram.com/${props.kind}/${props.shortcode}/embed/captioned/`
)

const CHROME = 112 // en-tête du compte, actions et pied du cadre
</script>

<template>
  <div
    class="ig-embed"
    :style="{ '--media-ratio': vertical ? 16 / 9 : 1, '--chrome': CHROME + 'px' }"
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
