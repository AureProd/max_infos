<script setup lang="ts">
/**
 * LCEN art. 6 III-2: a non-professional individual publisher may keep his
 * address out of the page, provided the host holds his identity. Hence a
 * name and an e-mail, and no home address in a PUBLIC repository.
 */
useSeoMeta({
  title: 'Mentions légales',
  description: 'Éditeur, directeur de publication et hébergeur du site « Un Max d’info ».',
})
</script>

<template>
  <div class="wrap">
    <section class="about legal">
      <h1>Mentions légales</h1>

      <div class="prose">
        <p>
          Les informations que la loi impose de publier pour un site édité depuis la France.
        </p>

        <h2>Éditeur</h2>
        <p>
          Maximilien Huet, éditeur du site « Un Max d’info », également directeur de la
          publication. Contact :
          <a href="mailto:maxhuetytb@gmail.com">maxhuetytb@gmail.com</a>.
        </p>
        <p>
          Le site est édité à titre personnel et non professionnel : conformément à
          l’article 6 III-2 de la loi pour la confiance dans l’économie numérique, l’adresse
          postale de l’éditeur n’est pas publiée, l’hébergeur en détenant l’identité complète.
        </p>

        <h2>Hébergeur</h2>
        <p>
          Hetzner Online GmbH — Industriestr. 25, 91710 Gunzenhausen, Allemagne.
          <br />
          Les images et documents sont diffusés par Cloudflare.
        </p>

        <h2>Propriété intellectuelle</h2>
        <p>
          Les textes, enquêtes, photographies et visuels publiés sur ce site en sont la propriété
          de leur auteur, sauf mention contraire. Toute reproduction intégrale suppose son
          accord ; la citation courte accompagnée du lien vers l’article, elle, est bienvenue.
        </p>

        <h2>Données personnelles</h2>
        <p>
          Ce que le site enregistre, et comment le faire supprimer, est détaillé dans la
          <NuxtLink to="/privacy">politique de confidentialité</NuxtLink>. Les conditions
          d’utilisation sont sur une
          <NuxtLink to="/terms">page dédiée</NuxtLink>.
        </p>

        <p class="updated">Dernière mise à jour : 17 septembre 2026.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.legal {
  max-width: var(--read);
  margin-inline: auto;
}
.updated {
  margin-top: 2.5em;
  font-size: 0.95rem;
  color: var(--muted);
}
</style>
