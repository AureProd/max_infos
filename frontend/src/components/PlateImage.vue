<script setup>
import { computed } from 'vue'
import { plate } from '@/lib/plate'

const props = defineProps({
  seed: { type: Number, required: true },
  w: { type: Number, default: 400 },
  h: { type: Number, default: 400 },
  alt: { type: String, default: "Visuel d'atelier" }
})

const p = computed(() => plate(props.seed, props.w, props.h))
</script>

<template>
  <!-- eslint-disable vue/no-v-html -- SVG généré par plate.js, aucune saisie utilisateur -->
  <svg
    class="plate"
    :viewBox="p.viewBox"
    :style="{ aspectRatio: p.ratio }"
    preserveAspectRatio="xMidYMid slice"
    role="img"
    :aria-label="alt"
    v-html="p.inner"
  />
  <!-- eslint-enable vue/no-v-html -->
</template>
