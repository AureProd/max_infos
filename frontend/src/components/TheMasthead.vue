<script setup>
import { SITE } from '@/data/site'
</script>

<template>
  <header class="mast">
    <div class="wrap mast-in">
      <RouterLink class="brand" to="/">
        <span class="dot" aria-hidden="true" />
        <span>{{ SITE.name }}</span>
      </RouterLink>
      <nav class="nav">
        <RouterLink to="/">Accueil</RouterLink>
        <RouterLink to="/a-propos">À propos</RouterLink>
        <RouterLink to="/redaction">Rédaction</RouterLink>
      </nav>
    </div>
  </header>
</template>
