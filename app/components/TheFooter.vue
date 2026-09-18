<script setup lang="ts">
const { data: site } = await useSite()

/** Only the fields whose visibility Max turned on are displayed. */
const links = computed(() => site.value?.contact.fields.filter((f) => f.visible) ?? [])
</script>

<template>
  <footer class="foot">
    <div class="wrap foot-in">
      <!--
        Les écarts se faisaient par un `margin-left` posé sur chaque lien.
        Sur un téléphone, où tout se replie et se centre, cette marge
        s'ajoutait à gauche du premier lien de chaque ligne : le bloc
        paraissait décalé d'un cran. Un `gap` n'a pas de côté.
      -->
      <span class="foot-line">
        <span>{{ site?.identity.name }} — {{ site?.identity.author }}. Sans publicité ni suivi.</span>
        <NuxtLink to="/privacy">Confidentialité</NuxtLink>
        <NuxtLink to="/legal">Mentions légales</NuxtLink>
        <NuxtLink to="/terms">Conditions</NuxtLink>
      </span>
      <span v-if="links.length" class="foot-line">
        <a v-for="link in links" :key="link.key" :href="link.href" target="_blank" rel="noopener">
          {{ link.label }}
        </a>
      </span>
    </div>
  </footer>
</template>
