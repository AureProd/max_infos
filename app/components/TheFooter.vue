<script setup lang="ts">
const { data: site } = await useSite()

/** Seuls les champs dont Max a activé la visibilité sont affichés. */
const liens = computed(() => site.value?.contact.fields.filter((f) => f.visible) ?? [])
</script>

<template>
  <footer class="foot">
    <div class="wrap foot-in">
      <span>
        {{ site?.identity.name }} — {{ site?.identity.author }}. Sans publicité ni suivi.
      </span>
      <span>
        <a
          v-for="lien in liens"
          :key="lien.key"
          :href="lien.href"
          target="_blank"
          rel="noopener"
          style="margin-left: 16px"
          >{{ lien.label }}</a
        >
      </span>
    </div>
  </footer>
</template>
