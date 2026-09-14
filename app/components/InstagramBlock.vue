<script setup lang="ts">
import { nb } from '#shared/utils/format'

/**
 * Les comptes Instagram, une section chacun.
 *
 * Tout vient d'une seule réponse : les comptes que Max a choisi d'afficher,
 * dans l'ordre qu'il a fixé, chacun tronqué au nombre de publications qu'il
 * a choisi. Le nom, la photo et la bio sont ceux du compte tel qu'Instagram
 * les donne — plus rien n'est écrit à la main, donc plus rien ne peut être
 * faux.
 *
 * Les compteurs passent par `nb()`, jamais par `toLocaleString` : `Intl`
 * rend U+202F ou U+00A0 selon l'ICU embarquée, et l'hydratation casse.
 */
const { data: comptes } = await useFetch('/api/social-accounts', { key: 'comptes-sociaux-public' })
</script>

<template>
  <section v-for="compte in comptes ?? []" :key="compte.id" class="section">
    <div class="igp-head">
      <div class="igp-avatar">
        <div class="in">
          <img v-if="compte.avatarUrl" :src="compte.avatarUrl" :alt="`@${compte.username}`" />
        </div>
      </div>
      <div class="igp-id">
        <a class="igp-handle" :href="compte.url ?? undefined" target="_blank" rel="noopener">
          @{{ compte.username }}
          <span class="igp-follow">Suivre</span>
        </a>
        <div class="igp-stats">
          <span
            ><b>{{ nb(compte.mediaCount ?? compte.publications.length) }}</b> publications</span
          >
          <span v-if="compte.followers"
            ><b>{{ nb(compte.followers) }}</b> abonné(e)s</span
          >
        </div>
        <p v-if="compte.biography" class="igp-bio">{{ compte.biography }}</p>
      </div>
    </div>

    <div class="section-head">
      <h2>{{ compte.displayName ?? `Sur @${compte.username}` }}</h2>
      <span class="rule" />
      <a class="note" :href="compte.url ?? undefined" target="_blank" rel="noopener">
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
      <li v-for="item in compte.publications" :key="item.id">
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
