<script setup lang="ts">
import { frShort } from '#shared/utils/format'
import { mediaLabel, networkLabel } from '#shared/utils/social'

/**
 * Home-made card for a social post.
 *
 * Replaces Instagram's official embed, served in a LIGHT THEME with no way
 * to change it — white blocks in the middle of a dark site, each imposing
 * its own height. The card is drawn with the site's CSS from the API data:
 * it fits in, it loads without an iframe, and it sends nothing to Meta
 * until the visitor clicks.
 *
 * It borrows the PROPORTIONS of a real post — a compact header, then the
 * image, then a short caption — but stays at our scale: every card is the
 * same height, so the grid keeps its rhythm whatever the content.
 */
interface Publication {
  id: number
  network: 'instagram' | 'linkedin'
  shortcode: string | null
  permalink: string | null
  mediaType: 'reel' | 'carousel' | 'image' | 'post' | null
  caption: string | null
  thumbnailUrl: string | null
  mediaUrl?: string | null
  postedAt: string | null
}

const props = defineProps<{ publication: Publication; handle?: string | null }>()

const kind = computed(() => mediaLabel(props.publication.mediaType))
const isReel = computed(() => props.publication.mediaType === 'reel')

/**
 * The video, when we have it.
 *
 * Only a synced account gives one: a link pasted by hand carries no file.
 * And these CDN addresses EXPIRE after a few weeks, which is why a missing
 * or stale one falls back to the thumbnail rather than to a broken player.
 */
const video = computed(() => props.publication.mediaUrl ?? null)
const isCarousel = computed(() => props.publication.mediaType === 'carousel')

/** Truncated on a whole word: cutting mid-word shows. */
const caption = computed(() => {
  const t = props.publication.caption ?? ''
  if (t.length <= 120) return t
  return `${t.slice(0, t.lastIndexOf(' ', 120))}…`
})
</script>

<template>
  <a class="pub" :href="publication.permalink ?? '#'" target="_blank" rel="noopener noreferrer">
    <div class="pub-head">
      <span class="pub-avatar" aria-hidden="true" />
      <span class="pub-handle">{{ handle ? `@${handle}` : networkLabel(publication.network) }}</span>
      <time v-if="publication.postedAt" class="pub-date" :datetime="publication.postedAt">
        {{ frShort(publication.postedAt.slice(0, 10)) }}
      </time>
    </div>

    <div class="pub-media">
      <!--
        La vidéo joue d'elle-même, muette et en boucle, comme sur Instagram.
        `preload="metadata"` plutôt que le fichier entier : la carte affiche
        sa première image sans télécharger tout le MP4, et la lecture ne
        démarre que lorsqu'elle entre à l'écran.
      -->
      <video
        v-if="video"
        :src="video"
        :poster="publication.thumbnailUrl ?? undefined"
        autoplay
        muted
        loop
        playsinline
        preload="metadata"
      />
      <img
        v-else-if="publication.thumbnailUrl"
        :src="publication.thumbnailUrl"
        :alt="caption || kind"
        loading="lazy"
      />
      <PlateImage v-else :seed="publication.id * 7" :w="400" :h="400" :alt="kind" />

      <!--
        Un reel n'est pas une photo : il se signale par une pastille de
        lecture, comme partout ailleurs, et non par le mot « Reel » posé
        dans un coin.
      -->
      <span v-if="isReel && !video" class="pub-play" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M8 5v14l11-7z" fill="currentColor" />
        </svg>
      </span>
      <span v-else-if="isCarousel" class="pub-stack" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="15" height="15">
          <path
            d="M8 3h11a2 2 0 0 1 2 2v11M5 7h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          />
        </svg>
      </span>
      <span class="a-sr">{{ kind }}</span>
    </div>

    <p class="pub-legende">{{ caption }}</p>
  </a>
</template>
