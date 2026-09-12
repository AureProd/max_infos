<script setup>
defineProps({
  dir: { type: Number, required: true },
  label: { type: String, required: true },
  disabled: { type: Boolean, default: false }
})
defineEmits(['click'])
</script>

<template>
  <button
    class="cbtn"
    :data-dir="dir"
    :aria-label="label"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <polyline v-if="dir < 0" points="15 5 8 12 15 19" />
      <polyline v-else points="9 5 16 12 9 19" />
    </svg>
  </button>
</template>
