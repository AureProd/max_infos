<script setup lang="ts">
import { nb } from '#shared/utils/format'

definePageMeta({ middleware: 'admin' })

/**
 * The social network accounts, configured by Max.
 *
 * Connect, order, hide, disconnect: everything that decides what the home
 * page shows. The displayed identity — name, picture, bio — is NOT editable
 * here: it comes from Instagram, and that is what keeps it true. Attaching
 * a post to an article stays in the Publications screen.
 */
const route = useRoute()
/** Return message from the OAuth flow, carried by the URL. */
const back = computed(() => route.query.instagram as string | undefined)

const { data: accounts, refresh } = await useFetch('/api/admin/social-accounts', {
  key: 'comptes-sociaux',
})

const state = ref<'repos' | 'enregistrement' | 'enregistré' | 'échec'>('repos')
const message = ref('')

/**
 * No explicit type on `$fetch`: Nitro's is inferred from the handler, so
 * that a field renamed server-side makes `pnpm typecheck` fail here. A type
 * written by hand would have accepted anything.
 */
async function set(
  id: number,
  changes: { visible?: boolean; position?: number; postsOnHome?: number },
): Promise<void> {
  state.value = 'enregistrement'
  try {
    await $fetch(`/api/admin/social-accounts/${id}`, { method: 'PUT', body: changes })
    await refresh()
    state.value = 'enregistré'
  } catch (e) {
    state.value = 'échec'
    message.value = (e as { statusMessage?: string }).statusMessage ?? 'Enregistrement impossible'
  }
}

/** Swaps two accounts, writing only the two positions. */
async function move(i: number, sens: -1 | 1): Promise<void> {
  const list = accounts.value ?? []
  const here = list[i]
  const la = list[i + sens]
  if (!here || !la) return
  await set(here.id, { position: la.position })
  await set(la.id, { position: here.position })
}

const syncTask = ref<number | 'tous' | null>(null)

async function syncPosts(account?: number): Promise<void> {
  syncTask.value = account ?? 'tous'
  message.value = ''
  try {
    const summary = await $fetch('/api/admin/instagram/sync', {
      method: 'POST',
      query: account ? { account } : {},
    })
    const failures = summary.accounts.filter((c) => c.error)
    message.value = failures.length
      ? `${summary.fresh} nouvelle(s). En échec : ${failures.map((c) => `@${c.username} (${c.error})`).join(', ')}`
      : `${summary.views} publication(s) vue(s), ${summary.fresh} nouvelle(s).`
    await refresh()
  } catch (e) {
    message.value = (e as { statusMessage?: string }).statusMessage ?? 'Synchronisation impossible'
  } finally {
    syncTask.value = null
  }
}

/**
 * Disconnecting ERASES the account's posts and their attachments.
 *
 * Hence the confirmation announcing the exact count: it is final, and
 * resyncing after reconnecting would not give the article attachments back.
 */
async function signOut(account: {
  id: number
  username: string | null
  nbPublications: number
}): Promise<void> {
  const accord = confirm(
    `Déconnecter @${account.username} supprimera aussi ses ${account.nbPublications} publication(s) et leurs liens vers les articles. Cette action est définitive.`,
  )
  if (!accord) return
  await $fetch(`/api/admin/social-accounts/${account.id}`, { method: 'DELETE' })
  await refresh()
}

useSeoMeta({ title: 'Réseaux', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="wrap">
    <section class="admin-page">
      <AdminNav>
        <span v-if="state === 'enregistré'" class="note">enregistré</span>
        <span v-else-if="state === 'échec'" class="err">échec</span>
        <button
          class="btn"
          type="button"
          :disabled="syncTask !== null || !(accounts ?? []).length"
          @click="syncPosts()"
        >
          {{ syncTask === 'tous' ? 'Synchronisation…' : 'Tout synchroniser' }}
        </button>
        <a class="btn btn-primary" href="/api/admin/instagram/connect">Connecter un compte</a>
      </AdminNav>

      <h1>Réseaux</h1>

      <p v-if="back === 'ok'" class="note">Le compte est connecté.</p>
      <p v-else-if="back === 'refus'" class="err">
        L'autorisation a été refusée côté Instagram.
      </p>
      <p v-if="message" class="hint">{{ message }}</p>

      <p class="hint">
        Chaque compte affiché occupe sa propre section sur la page d'accueil, dans l'ordre
        ci-dessous. Le nom et la photo sont ceux du compte Instagram : ils se corrigent là-bas.
        Pour rattacher une publication à un article, voir
        <NuxtLink to="/admin/publications">Publications</NuxtLink>.
      </p>

      <ul class="list">
        <li v-for="(c, i) in accounts ?? []" :key="c.id">
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
                  <span v-if="!c.signedIn" class="err">jeton absent — reconnecter</span>
                  <strong v-else-if="c.jetonAlerte">
                    Jeton vieux de {{ c.jetonAgeJours }} jours : à renouveler avant 60.
                  </strong>
                </div>
              </div>
            </div>

            <div class="cluster">
              <button class="btn" type="button" :disabled="i === 0" @click="move(i, -1)">
                ↑
              </button>
              <button
                class="btn"
                type="button"
                :disabled="i === (accounts ?? []).length - 1"
                @click="move(i, 1)"
              >
                ↓
              </button>

              <label class="field">
                <input
                  type="checkbox"
                  :checked="c.visible"
                  @change="set(c.id, { visible: ($event.target as HTMLInputElement).checked })"
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
                    set(c.id, { postsOnHome: Number(($event.target as HTMLInputElement).value) })
                  "
                />
                publications
              </label>

              <button
                class="btn"
                type="button"
                :disabled="syncTask !== null"
                @click="syncPosts(c.id)"
              >
                {{ syncTask === c.id ? 'Synchronisation…' : 'Synchroniser' }}
              </button>
              <button class="btn" type="button" @click="signOut(c)">Déconnecter</button>
            </div>
          </div>
        </li>
      </ul>

      <p v-if="!(accounts ?? []).length" class="empty">
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
