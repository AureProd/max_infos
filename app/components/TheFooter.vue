<script setup lang="ts">
const { data: site } = await useSite()

/** Only the fields whose visibility Max turned on are displayed. */
const links = computed(() => site.value?.contact.fields.filter((f) => f.visible) ?? [])
</script>

<template>
  <footer class="foot">
    <div class="wrap foot-in">
      <span>
        {{ site?.identity.name }} — {{ site?.identity.author }}. Sans publicité ni suivi.
      </span>
      <span>
        <a
          v-for="link in links"
          :key="link.key"
          :href="link.href"
          target="_blank"
          rel="noopener"
          style="margin-left: 16px"
          >{{ link.label }}</a
        >
      </span>
    </div>
  </footer>
</template>
