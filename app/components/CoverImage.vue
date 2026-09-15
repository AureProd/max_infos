<script setup lang="ts">
/**
 * Article cover. The original artwork is 4:5 portrait on a flat grey
 * background: we keep its native framing by default and turn off the flat
 * background, which glares on a dark theme.
 */
const props = withDefaults(
  defineProps<{
    src?: string | null
    seed?: number
    ratio?: string
    alt?: string
    tinted?: boolean
  }>(),
  { src: null, seed: 1, ratio: '4 / 5', alt: '', tinted: true },
)

const failed = ref(false)
watch(
  () => props.src,
  () => {
    failed.value = false
  },
)
</script>

<template>
  <div :class="['frame', tinted && 'tinted']" :style="{ aspectRatio: ratio }">
    <img
      v-if="src && !failed"
      class="cover"
      :src="src"
      :alt="alt"
      loading="lazy"
      @error="failed = true"
    />
    <PlateImage v-else :seed="seed" :w="600" :h="750" :alt="alt" />
  </div>
</template>
