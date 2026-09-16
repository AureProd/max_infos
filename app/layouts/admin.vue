<script setup lang="ts">
import { isCurrentScreen } from '~/utils/admin-nav'

/**
 * The back-office chrome, in ONE place.
 *
 * Until now every admin page rebuilt it by hand, under the PUBLIC masthead:
 * the screen showed two navigations stacked, one for visitors and one for
 * Max. The layout removes that duplication.
 *
 * It is LIGHT, while the public site is dark. A working tool reads better
 * in daylight, and the contrast says at a glance which side one is on —
 * publishing or editing.
 */
const { user, peut, signOut } = useUser()

/**
 * The technical screens are NOT in Max's menu.
 *
 * This hiding is comfort, not security: the server refuses anyway, and it
 * alone protects. But a menu offering forbidden screens makes a tool feel
 * like it was not built for you.
 */
const seesTech = peut('tech')

const route = useRoute()

const screens = computed(() =>
  [
    { to: '/admin', label: 'Tableau de bord', tech: false },
    { to: '/admin/articles', label: 'Articles', tech: false },
    { to: '/admin/publications', label: 'Publications', tech: false },
    { to: '/admin/social', label: 'Réseaux', tech: false },
    { to: '/admin/about', label: 'À propos', tech: false },
    { to: '/admin/tech', label: 'Technique', tech: true },
  ].filter((e) => !e.tech || seesTech.value),
)
</script>

<template>
  <div class="admin-shell admin-ui">
    <header class="admin-head">
      <div class="admin-head-in">
        <NuxtLink class="admin-brand" to="/admin">
          <span class="admin-dot" />
          <span>Back-office</span>
        </NuxtLink>

        <nav class="admin-menu" aria-label="Sections du back-office">
          <NuxtLink
            v-for="e in screens"
            :key="e.to"
            :to="e.to"
            :aria-current="isCurrentScreen(route.path, e.to) ? 'page' : undefined"
          >
            {{ e.label }}
          </NuxtLink>
        </nav>

        <div class="admin-who">
          <span class="admin-user">{{ user?.name ?? user?.email }}</span>
          <!-- The role, shown rather than guessed: which screens are
               missing from the menu is otherwise a puzzle. -->
          <span v-if="seesTech" class="admin-tag">technique</span>
          <NuxtLink class="admin-out" to="/" target="_blank">Voir le site ↗</NuxtLink>
          <button class="admin-out" type="button" @click="signOut">Se déconnecter</button>
        </div>
      </div>
    </header>

    <main class="admin-main">
      <slot />
    </main>
  </div>
</template>

<style>
/* Importée ici plutôt que dans nuxt.config : la feuille du back-office ne
   part pas dans le bundle des pages publiques, qui ne l'utilisent jamais. */
@import '~/assets/css/admin.css';
</style>
