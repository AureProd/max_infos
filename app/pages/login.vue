<script setup lang="ts">
const route = useRoute()
const { data: site } = await useSite()

const failure = computed(() => route.query.connection === 'echec')

useSeoMeta({ title: 'Connexion', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="wrap">
    <section class="about" style="max-width: 560px">
      <h1>Connexion</h1>
      <p class="lede">
        L'accès à la rédaction de {{ site?.identity.name }} est réservé aux comptes autorisés.
      </p>

      <p v-if="failure" class="err">
        La connexion a échoué. Si cette adresse devrait avoir accès, demande à JB de l'ajouter.
      </p>

      <p style="margin-top: 24px">
        <a class="btn btn-primary" href="/api/auth/google">Se connecter avec Google</a>
      </p>

      <p class="hint" style="margin-top: 16px">
        Aucun compte ne se crée tout seul : les adresses autorisées sont inscrites à l'avance.
      </p>
    </section>
  </div>
</template>
