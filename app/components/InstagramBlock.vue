<script setup lang="ts">
import { nb } from '#shared/utils/format'
import { postsWorthShowing } from '#shared/utils/social'

/**
 * The Instagram accounts, one section each.
 *
 * Everything comes from a single response: the accounts Max chose to
 * display, in the order he set, each truncated to the post count he chose.
 * The name, the picture and the bio are the account's as Instagram gives
 * them — nothing is written by hand any more, so nothing can be wrong.
 *
 * The counters go through `nb()`, never `toLocaleString`: `Intl` renders
 * U+202F or U+00A0 depending on the bundled ICU, and hydration breaks.
 */
const { data: accounts } = await useFetch('/api/social-accounts', { key: 'comptes-sociaux-public' })

/**
 * The posts belonging to no account.
 *
 * The sections above are built per ACCOUNT. A post added by hand from the
 * Publications screen has none, so until this fetch existed it appeared
 * NOWHERE: three of them sat invisible in production from 15/09/2026, while
 * the admin screen listed them as perfectly visible.
 *
 * Filtered on the account and not on `source`, whose default is 'manual':
 * that column says where a post came from, not whether a section already
 * shows it, and the home page would have displayed some of them twice.
 */
const { data: loose } = await useFetch('/api/social-posts', {
  key: 'publications-sans-compte',
  query: { account: 'none' },
})

/**
 * Only accounts that have something to show.
 *
 * The seed creates a mock-up account with no avatar, no bio and posts
 * without thumbnails: the home page displayed an empty profile header above
 * abstract plates. No connected account, no section.
 */
const shown = computed(() => (accounts.value ?? []).filter((a) => a.publications.length > 0))

/**
 * Only the networks the site actually has an account for.
 *
 * A LinkedIn post typed in by hand carries neither title nor image — no API
 * will ever hand them over — and it showed up here as a bare plate. It
 * belongs on the article it illustrates, which is where the article page
 * now puts it.
 */
const networksConnected = computed(() => [...new Set((accounts.value ?? []).map((a) => a.network))])

const looseShown = computed(() => postsWorthShowing(loose.value ?? [], networksConnected.value))
</script>

<template>
  <!--
    Un compte sans publication n'affiche plus son en-tête de profil seule :
    tant qu'aucun compte n'est connecté, la section disparaît au lieu de
    montrer un avatar vide au-dessus d'une grille vide.
  -->
  <section v-for="account in shown" :key="account.id" class="section">
    <div class="igp-head">
      <div class="igp-avatar">
        <div class="in">
          <img v-if="account.avatarUrl" :src="account.avatarUrl" :alt="`@${account.username}`" />
        </div>
      </div>
      <div class="igp-id">
        <a class="igp-handle" :href="account.url ?? undefined" target="_blank" rel="noopener">
          @{{ account.username }}
          <span class="igp-follow">Suivre</span>
        </a>
        <div class="igp-stats">
          <span
            ><b>{{ nb(account.mediaCount ?? account.publications.length) }}</b> publications</span
          >
          <span v-if="account.followers"
            ><b>{{ nb(account.followers) }}</b> abonné(e)s</span
          >
        </div>
        <p v-if="account.biography" class="igp-bio">{{ account.biography }}</p>
      </div>
    </div>

    <div class="section-head">
      <h2>{{ account.displayName ?? `Sur @${account.username}` }}</h2>
      <span class="rule" />
      <a class="note" :href="account.url ?? undefined" target="_blank" rel="noopener">
        Voir le compte ↗
      </a>
    </div>

    <!--
      Cartes maison plutôt que l'embed officiel : Instagram le sert en thème
      CLAIR, sans moyen de le changer, ce qui produisait des blocs blancs au
      milieu d'un site sombre. La carte est dessinée avec le CSS du site à
      partir des données de l'API.
    -->
    <ul class="pubs">
      <li v-for="item in account.publications" :key="item.id">
        <PublicationCard :publication="item" :handle="account.username" />
      </li>
    </ul>
  </section>

  <section v-if="looseShown.length" class="section">
    <div class="section-head">
      <h2>Sur les réseaux</h2>
      <span class="rule" />
    </div>
    <ul class="pubs">
      <li v-for="item in looseShown" :key="item.id">
        <PublicationCard :publication="item" />
      </li>
    </ul>
  </section>
</template>

<style scoped>
.igp-avatar .in img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
