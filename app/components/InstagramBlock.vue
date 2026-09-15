<script setup lang="ts">
import { nb } from '#shared/utils/format'

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
</script>

<template>
  <section v-for="account in accounts ?? []" :key="account.id" class="section">
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
