<script setup lang="ts">
import type { SlideSpec } from '#shared/types/slide'

const props = withDefaults(defineProps<{ spec: SlideSpec; handle?: string }>(), {
  handle: '@unmaxdinfo_',
})

const s = computed(() => slide(props.spec, props.handle))
</script>

<template>
  <!--
    v-html assumé : le SVG est construit par app/utils/slide.ts, qui échappe
    lui-même les textes qu'on lui donne. Ce fichier figure dans la liste
    autorisée de scripts/hooks/check-v-html.sh.
  -->
  <svg
    class="plate"
    :viewBox="s.viewBox"
    style="aspect-ratio: 1 / 1"
    role="img"
    :aria-label="s.label"
    v-html="s.inner"
  />
</template>
