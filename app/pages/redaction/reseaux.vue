<script setup lang="ts">
import { nb } from '#shared/utils/format'

definePageMeta({ middleware: 'redaction' })

/**
 * Les comptes de réseaux sociaux, réglés par Max.
 *
 * Connecter, ordonner, masquer, déconnecter : tout ce qui décide de ce que
 * l'accueil montre. L'identité affichée — nom, photo, bio — n'est PAS
 * éditable ici : elle vient d'Instagram, et c'est ce qui la garde vraie.
 * Le rattachement d'une publication à un article, lui, reste dans l'écran
 * Publications.
 */
const route = useRoute()
/** Message de retour du flux OAuth, porté par l'URL. */
const retour = computed(() => route.query.instagram as string | undefined)

const { data: comptes, refresh } = await useFetch('/api/admin/social-accounts', {
  key: 'comptes-sociaux',
})

const etat = ref<'repos' | 'enregistrement' | 'enregistré' | 'échec'>('repos')
const message = ref('')

/**
 * Pas de type explicite sur `$fetch` : celui de Nitro est déduit du
 * handler, si bien qu'un champ renommé côté serveur fait échouer
 * `pnpm typecheck` ici. Un type écrit à la main aurait tout accepté.
 */
async function regler(
  id: number,
  changements: { visible?: boolean; position?: number; postsOnHome?: number },
): Promise<void> {
  etat.value = 'enregistrement'
  try {
    await $fetch(`/api/admin/social-accounts/${id}`, { method: 'PUT', body: changements })
    await refresh()
    etat.value = 'enregistré'
  } catch (e) {
    etat.value = 'échec'
    message.value = (e as { statusMessage?: string }).statusMessage ?? 'Enregistrement impossible'
  }
}

/** Échange deux comptes de place, en n'écrivant que les deux positions. */
async function deplacer(i: number, sens: -1 | 1): Promise<void> {
  const liste = comptes.value ?? []
  const ici = liste[i]
  const la = liste[i + sens]
  if (!ici || !la) return
  await regler(ici.id, { position: la.position })
  await regler(la.id, { position: ici.position })
}

const synchro = ref<number | 'tous' | null>(null)

async function synchroniser(compte?: number): Promise<void> {
  synchro.value = compte ?? 'tous'
  message.value = ''
  try {
    const bilan = await $fetch('/api/admin/instagram/sync', {
      method: 'POST',
      query: compte ? { compte } : {},
    })
    const echecs = bilan.comptes.filter((c) => c.erreur)
    message.value = echecs.length
      ? `${bilan.nouvelles} nouvelle(s). En échec : ${echecs.map((c) => `@${c.username} (${c.erreur})`).join(', ')}`
      : `${bilan.vues} publication(s) vue(s), ${bilan.nouvelles} nouvelle(s).`
    await refresh()
  } catch (e) {
    message.value = (e as { statusMessage?: string }).statusMessage ?? 'Synchronisation impossible'
  } finally {
    synchro.value = null
  }
}

/**
 * Déconnecter EFFACE les publications du compte et leurs rattachements.
 *
 * D'où la confirmation qui annonce le nombre exact : c'est définitif, et une
 * resynchronisation après reconnexion ne rendrait pas les rattachements aux
 * articles.
 */
async function deconnecter(compte: {
  id: number
  username: string | null
  nbPublications: number
}): Promise<void> {
  const accord = confirm(
    `Déconnecter @${compte.username} supprimera aussi ses ${compte.nbPublications} publication(s) et leurs liens vers les articles. Cette action est définitive.`,
  )
  if (!accord) return
  await $fetch(`/api/admin/social-accounts/${compte.id}`, { method: 'DELETE' })
  await refresh()
}

useSeoMeta({ title: 'Réseaux', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="wrap">
    <section class="admin-page">
      <AdminNav>
        <span v-if="etat === 'enregistré'" class="note">enregistré</span>
        <span v-else-if="etat === 'échec'" class="err">échec</span>
        <button
          class="btn"
          type="button"
          :disabled="synchro !== null || !(comptes ?? []).length"
          @click="synchroniser()"
        >
          {{ synchro === 'tous' ? 'Synchronisation…' : 'Tout synchroniser' }}
        </button>
        <a class="btn btn-primary" href="/api/admin/instagram/connect">Connecter un compte</a>
      </AdminNav>

      <h1>Réseaux</h1>

      <p v-if="retour === 'ok'" class="note">Le compte est connecté.</p>
      <p v-else-if="retour === 'refus'" class="err">
        L'autorisation a été refusée côté Instagram.
      </p>
      <p v-if="message" class="hint">{{ message }}</p>

      <p class="hint">
        Chaque compte affiché occupe sa propre section sur la page d'accueil, dans l'ordre
        ci-dessous. Le nom et la photo sont ceux du compte Instagram : ils se corrigent là-bas.
        Pour rattacher une publication à un article, voir
        <NuxtLink to="/redaction/publications">Publications</NuxtLink>.
      </p>

      <ul class="list">
        <li v-for="(c, i) in comptes ?? []" :key="c.id">
          <div class="entry">
            <div class="cluster">
              <img v-if="c.avatarUrl" class="avatar" :src="c.avatarUrl" :alt="`@${c.username}`" />
              <div>
                <h3>
                  <a :href="c.url ?? undefined" target="_blank" rel="noopener">@{{ c.username }}</a>
                </h3>
                <div class="meta">
                  <span v-if="c.displayName">{{ c.displayName }}</span>
                  <span>{{ nb(c.nbPublications) }} publication(s)</span>
                  <span v-if="c.followers">{{ nb(c.followers) }} abonné(e)s</span>
                  <span>
                    Synchronisé : {{ c.lastSyncAt ? c.lastSyncAt.slice(0, 10) : 'jamais' }}
                  </span>
                  <span v-if="!c.connecte" class="err">jeton absent — reconnecter</span>
                  <strong v-else-if="c.jetonAlerte">
                    Jeton vieux de {{ c.jetonAgeJours }} jours : à renouveler avant 60.
                  </strong>
                </div>
              </div>
            </div>

            <div class="cluster">
              <button class="btn" type="button" :disabled="i === 0" @click="deplacer(i, -1)">
                ↑
              </button>
              <button
                class="btn"
                type="button"
                :disabled="i === (comptes ?? []).length - 1"
                @click="deplacer(i, 1)"
              >
                ↓
              </button>

              <label class="field">
                <input
                  type="checkbox"
                  :checked="c.visible"
                  @change="regler(c.id, { visible: ($event.target as HTMLInputElement).checked })"
                />
                Sur l'accueil
              </label>

              <label class="field">
                <input
                  type="number"
                  min="1"
                  max="50"
                  :value="c.postsOnHome"
                  @change="
                    regler(c.id, { postsOnHome: Number(($event.target as HTMLInputElement).value) })
                  "
                />
                publications
              </label>

              <button
                class="btn"
                type="button"
                :disabled="synchro !== null"
                @click="synchroniser(c.id)"
              >
                {{ synchro === c.id ? 'Synchronisation…' : 'Synchroniser' }}
              </button>
              <button class="btn" type="button" @click="deconnecter(c)">Déconnecter</button>
            </div>
          </div>
        </li>
      </ul>

      <p v-if="!(comptes ?? []).length" class="empty">
        Aucun compte connecté. « Connecter un compte » ouvre l'autorisation Instagram.
      </p>
    </section>
  </div>
</template>

<style scoped>
.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}
</style>
