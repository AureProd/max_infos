<script setup lang="ts">
import { networkLabel } from '#shared/utils/social'

/**
 * The stand-in for a post with no picture.
 *
 * A post typed in by hand carries no media: no API hands over a LinkedIn
 * post, and an Instagram link pasted on its own gives nothing either. The
 * abstract plate that used to fill the hole said nothing — the reader saw
 * a coloured rectangle and could not tell where the post came from.
 *
 * The network's own mark, drawn in CSS and SVG: no file to load, and it
 * never pretends to be a picture of the post.
 */
const props = defineProps<{ network: string; label?: string | null }>()

const name = computed(() => networkLabel(props.network))
</script>

<template>
  <div class="plate" :class="`is-${network}`" role="img" :aria-label="`${name} — sans image`">
    <svg v-if="network === 'linkedin'" viewBox="0 0 24 24" width="46" height="46" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.76V21h-4v-5.6c0-1.34-.03-3.06-1.9-3.06-1.9 0-2.2 1.46-2.2 2.96V21h-4V9Z"
      />
    </svg>
    <svg v-else viewBox="0 0 24 24" width="46" height="46" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        d="M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3Z"
      />
      <circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="1.7" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
    </svg>
    <span class="plate-name">{{ label || name }}</span>
  </div>
</template>

<style scoped>
.plate {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  height: 100%;
  color: #fff;
  background: linear-gradient(140deg, #2b3038, #171a1f);
}
.plate.is-instagram {
  background: linear-gradient(140deg, #8a3ab9, #e95950 55%, #fcaf45);
}
.plate.is-linkedin {
  background: linear-gradient(140deg, #0a66c2, #084c92);
}
.plate-name {
  font-family: var(--display);
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.9;
}
</style>
