<script setup lang="ts">
import { frDate } from '#shared/utils/format'

definePageMeta({ middleware: 'redaction' })

const { data: bord } = await useFetch('/api/admin/dashboard', { key: 'admin-bord' })

const { utilisateur } = useUtilisateur()

/** « Bonjour Max » plutôt qu'un titre d'écran : c'est sa page d'accueil. */
const prenom = computed(() => utilisateur.value?.name?.split(' ')[0] ?? '')

useSeoMeta({ title: 'Rédaction', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="wrap">
    <section class="admin-page">
      <AdminNav>
        <NuxtLink class="btn btn-primary" to="/redaction/articles">Écrire</NuxtLink>
      </AdminNav>

      <h1>{{ prenom ? `Bonjour ${prenom}` : 'Tableau de bord' }}</h1>

      <ul v-if="bord?.alertes.length" class="alertes">
        <li v-for="(a, i) in bord.alertes" :key="i" :class="a.niveau">
          <NuxtLink :to="a.lien">{{ a.message }}</NuxtLink>
        </li>
      </ul>

      <div class="chiffres">
        <div class="chiffre">
          <strong>{{ bord?.vuesSemaine ?? 0 }}</strong>
          <span>lectures sur sept jours</span>
        </div>
        <div class="chiffre">
          <strong>{{ bord?.nbBrouillons ?? 0 }}</strong>
          <span>brouillon(s) en cours</span>
        </div>
        <div class="chiffre">
          <strong>{{ bord?.nonRattachees.length ?? 0 }}</strong>
          <span>publication(s) à rattacher</span>
        </div>
      </div>

      <div class="colonnes">
        <section>
          <h2>Reprendre un brouillon</h2>
          <p v-if="!bord?.brouillons.length" class="empty">Aucun brouillon en attente.</p>
          <ul v-else class="list">
            <li v-for="b in bord.brouillons" :key="b.slug">
              <div class="entry">
                <div>
                  <h3><NuxtLink :to="`/redaction/${b.slug}`">{{ b.title }}</NuxtLink></h3>
                  <div class="meta">
                    <span>modifié le {{ frDate(b.updatedAt.slice(0, 10)) }}</span>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </section>

        <section>
          <h2>Le plus lu cette semaine</h2>
          <p v-if="!bord?.populaires.length" class="empty">
            Pas encore de lecture enregistrée. C'est normal les premiers jours.
          </p>
          <ul v-else class="list">
            <li v-for="p in bord.populaires" :key="p.slug">
              <div class="entry">
                <div>
                  <h3><NuxtLink :to="`/article/${p.slug}`" target="_blank">{{ p.title }}</NuxtLink></h3>
                  <div class="meta"><span class="pill">{{ p.vues }} lectures</span></div>
                </div>
              </div>
            </li>
          </ul>
        </section>
      </div>

      <section v-if="bord?.nonRattachees.length">
        <h2>Publications sans article</h2>
        <p class="hint">
          Ces publications existent sur les réseaux mais ne sont rattachées à aucun article.
        </p>
        <ul class="list">
          <li v-for="p in bord.nonRattachees" :key="p.id">
            <div class="entry">
              <div>
                <h3>{{ (p.caption ?? '').slice(0, 80) || 'Sans légende' }}</h3>
                <div class="meta">
                  <span class="pill">{{ p.network }}</span>
                  <time v-if="p.postedAt" :datetime="p.postedAt">
                    {{ frDate(p.postedAt.slice(0, 10)) }}
                  </time>
                </div>
              </div>
              <NuxtLink class="btn" to="/redaction/publications">Rattacher</NuxtLink>
            </div>
          </li>
        </ul>
      </section>
    </section>
  </div>
</template>

<style scoped>
.chiffres {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin: 20px 0;
}
.chiffre {
  border: 1px solid var(--rule, #ddd);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.chiffre strong {
  font-size: 2rem;
  line-height: 1;
}
.chiffre span {
  font-size: 0.85rem;
  opacity: 0.7;
}
.colonnes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}
.alertes {
  list-style: none;
  padding: 0;
  margin: 16px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.alertes li {
  padding: 10px 14px;
  border-radius: 8px;
  border-left: 3px solid var(--rule, #ddd);
  background: color-mix(in srgb, currentColor 4%, transparent);
}
.alertes li.attention {
  border-left-color: #c2410c;
}
</style>
