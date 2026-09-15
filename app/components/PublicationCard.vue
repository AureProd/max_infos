<script setup lang="ts">
import { frShort } from '#shared/utils/format'

/**
 * Home-made card for a social post.
 *
 * Replaces Instagram's official embed, served in a LIGHT THEME with no way
 * to change it — white blocks in the middle of a dark site. The card is
 * drawn with the site's CSS from the API data: it fits in, it loads without
 * an iframe, and it sends nothing to Meta until the visitor clicks.
 */
interface Publication {
  id: number
  network: 'instagram' | 'linkedin'
  shortcode: string | null
  permalink: string | null
  mediaType: 'reel' | 'carousel' | 'image' | 'post' | null
  caption: string | null
  thumbnailUrl: string | null
  postedAt: string | null
}

const props = defineProps<{ publication: Publication }>()

const LABELS: Record<string, string> = {
  reel: 'Reel',
  carousel: 'Carrousel',
  image: 'Image',
  post: 'Publication',
}

const kind = computed(() => LABELS[props.publication.mediaType ?? 'post'] ?? 'Publication')

/** Truncated on a whole word: cutting mid-word shows. */
const caption = computed(() => {
  const t = props.publication.caption ?? ''
  if (t.length <= 140) return t
  return `${t.slice(0, t.lastIndexOf(' ', 140))}…`
})
</script>

<template>
  <a class="pub" :href="publication.permalink ?? '#'" target="_blank" rel="noopener noreferrer">
    <div class="pub-media">
      <img
        v-if="publication.thumbnailUrl"
        :src="publication.thumbnailUrl"
        :alt="caption || kind"
        loading="lazy"
      />
      <PlateImage v-else :seed="publication.id * 7" :w="400" :h="500" :alt="kind" />
      <span class="pub-type">{{ kind }}</span>
    </div>
    <p v-if="caption" class="pub-legende">{{ caption }}</p>
    <div class="meta">
      <time v-if="publication.postedAt" :datetime="publication.postedAt">
        {{ frShort(publication.postedAt.slice(0, 10)) }}
      </time>
      <span>{{ publication.network === 'instagram' ? 'Instagram' : 'LinkedIn' }} ↗</span>
    </div>
  </a>
</template>
