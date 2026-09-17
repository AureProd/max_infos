<script setup lang="ts">
const route = useRoute()
const { data: site } = await useSite()

const failure = computed(() => route.query.signin === 'failed')

useSeoMeta({ title: 'Connexion', robots: 'noindex, nofollow' })
</script>

<template>
  <!--
    Un seul geste, et rien d'autre.

    L'écran expliquait auparavant qui a le droit d'entrer et comment
    demander un accès. C'était dire à un inconnu comment fonctionne la liste
    d'autorisation — et cela ne servait personne : soit on peut se
    connecter, soit on ne peut pas.
  -->
  <div class="wrap signin-wrap">
    <section class="signin">
      <span class="signin-mark" aria-hidden="true" />
      <h1>{{ site?.identity.name }}</h1>
      <p class="signin-sub">Rédaction</p>

      <a class="signin-google" href="/api/auth/google">
        <i class="pi pi-google" aria-hidden="true" />
        Continuer avec Google
      </a>

      <p v-if="failure" class="signin-failed" role="alert">
        <i class="pi pi-times-circle" aria-hidden="true" />
        La connexion a échoué.
      </p>
    </section>
  </div>
</template>
