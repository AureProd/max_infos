<script setup lang="ts">
const { user, peut, signOut } = useUser()

/**
 * The technical screens are NOT in Max's menu.
 *
 * This hiding is comfort, not security: the server refuses anyway, and it
 * alone protects. But a menu offering forbidden screens makes a tool feel
 * like it was not built for you.
 */
const seesTech = peut('tech')

const screens = computed(() =>
  [
    { to: '/admin', label: 'Tableau de bord', tech: false },
    { to: '/admin/articles', label: 'Articles', tech: false },
    { to: '/admin/publications', label: 'Publications', tech: false },
    { to: '/admin/social', label: 'Réseaux', tech: false },
    { to: '/admin/home', label: 'Accueil', tech: false },
    { to: '/admin/about', label: 'À propos', tech: false },
    { to: '/admin/appearance', label: 'Apparence', tech: false },
    { to: '/admin/tech', label: 'Technique', tech: true },
  ].filter((e) => !e.tech || seesTech.value),
)
</script>

<template>
  <div class="admin-bar">
    <nav class="cnav">
      <NuxtLink v-for="e in screens" :key="e.to" :to="e.to">{{ e.label }}</NuxtLink>
    </nav>
    <div class="cluster">
      <span class="pill">{{ user?.name ?? user?.email }}</span>
      <slot />
      <button class="btn" type="button" @click="signOut">Se déconnecter</button>
    </div>
  </div>
</template>
