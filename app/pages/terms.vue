<script setup lang="ts">
useSeoMeta({
  title: 'Conditions d’utilisation',
  description: 'Ce que vous pouvez faire de ce site, et ce qu’il ne promet pas.',
})
</script>

<template>
  <div class="wrap">
    <section class="about legal">
      <h1>Conditions d’utilisation</h1>

      <div class="prose">
        <p>
          Ce site est un espace de lecture. Il n’y a rien à acheter, aucun compte à ouvrir, et
          ces conditions tiennent en trois paragraphes.
        </p>

        <h2>Usage du site</h2>
        <p>
          La consultation est libre et gratuite. Vous pouvez lire, partager les liens et citer
          les articles. En revanche, l’extraction automatisée massive du contenu, la tentative
          d’accès à l’espace d’administration et tout ce qui vise à perturber le service ne sont
          pas autorisés.
        </p>

        <h2>Le contenu</h2>
        <p>
          Les articles et les visuels restent la propriété de leur auteur. Les publications
          Instagram affichées appartiennent à leur compte d’origine et sont montrées avec un lien
          vers la publication d’origine. Les liens sortants mènent à des sites sur lesquels
          l’éditeur n’a aucun contrôle et dont il ne répond pas.
        </p>

        <h2>Ce qui n’est pas promis</h2>
        <p>
          Le site est fourni tel quel, sans garantie de disponibilité continue : une panne, une
          maintenance ou une interruption du service d’un prestataire peuvent le rendre
          inaccessible. Les articles reflètent le travail de leur auteur à leur date de
          publication et ne constituent ni un conseil professionnel, ni une information
          officielle.
        </p>

        <p>
          Voir aussi la <NuxtLink to="/privacy">politique de confidentialité</NuxtLink> et les
          <NuxtLink to="/legal">mentions légales</NuxtLink>.
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
