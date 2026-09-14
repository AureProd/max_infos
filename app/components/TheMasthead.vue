<script setup lang="ts">
const { data: site } = await useSite()
</script>

<template>
  <header class="mast">
    <div class="wrap mast-in">
      <NuxtLink class="brand" to="/">
        <span class="dot" aria-hidden="true" />
        <span>{{ site?.identity.name }}</span>
      </NuxtLink>
      <nav class="nav">
        <NuxtLink to="/">Accueil</NuxtLink>
        <NuxtLink to="/a-propos">À propos</NuxtLink>
        <NuxtLink to="/redaction">Rédaction</NuxtLink>
      </nav>
    </div>
  </header>
</template>
