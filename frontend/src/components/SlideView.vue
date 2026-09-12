<script setup>
import { computed } from 'vue'
import { slide } from '@/lib/slide'

const props = defineProps({
  spec: { type: Object, required: true },
  handle: { type: String, default: '@unmaxdinfo_' }
})
const s = computed(() => slide(props.spec, props.handle))
</script>

<template>
  <!-- eslint-disable vue/no-v-html -- SVG généré par slide.js, aucune saisie utilisateur -->
  <svg
    class="plate"
    :viewBox="s.viewBox"
    style="aspect-ratio: 1 / 1"
    role="img"
    :aria-label="s.label"
    v-html="s.inner"
  />
  <!-- eslint-enable vue/no-v-html -->
</template>
