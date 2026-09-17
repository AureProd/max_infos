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
        <NuxtLink to="/about">À propos</NuxtLink>
        <!--
          La rédaction n'est pas une rubrique du site : c'est la porte du
          back-office, et elle ne sert qu'à deux personnes. Une icône, donc,
          plutôt qu'un troisième onglet qui ferait croire à un contenu.

        -->
        <NuxtLink class="nav-icon" to="/admin" title="Rédaction" aria-label="Rédaction">
          <i class="pi pi-file-edit" aria-hidden="true" />
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>
