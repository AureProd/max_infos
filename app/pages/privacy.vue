<script setup lang="ts">
/**
 * Written in the template rather than in a setting: a legal text must not
 * change because Max moved a switch. The Meta console holds this page's
 * address AND the `data-deletion` anchor below — a test guards both.
 */
useSeoMeta({
  title: 'Politique de confidentialité',
  description:
    'Ce que ce site collecte, ce qu’il n’a jamais collecté, et comment en demander la suppression.',
})
</script>

<template>
  <div class="wrap">
    <section class="about legal">
      <h1>Politique de confidentialité</h1>

      <div class="prose">
        <p>
          Ce site n’a pas de régie publicitaire, pas de mesure d’audience tierce, et rien à
          revendre. Cette page dit précisément ce qu’il enregistre, pourquoi, et à qui écrire
          pour le faire effacer.
        </p>

        <h2>Qui est responsable</h2>
        <p>
          Maximilien Huet, éditeur du site « Un Max d’info », est responsable du traitement.
          Contact : <a href="mailto:maxhuetytb@gmail.com">maxhuetytb@gmail.com</a>.
        </p>

        <h2>Si vous êtes simple lecteur</h2>
        <p>
          Aucun cookie n’est déposé sur votre navigateur, aucun traceur publicitaire n’est
          chargé, et aucun profil n’est constitué. Le site compte les lectures d’un article
          sous la forme d’un total quotidien par article — un nombre, sans adresse IP, sans
          identifiant, sans rien qui permette de vous y rattacher.
        </p>
        <p>
          Restent les journaux techniques, que tout serveur tient : l’hébergeur et le réseau de
          diffusion des images conservent temporairement des adresses IP pour assurer la
          sécurité du service et repousser les abus. C’est un intérêt légitime au sens du
          RGPD, et ces journaux ne servent à rien d’autre.
        </p>

        <h2>Les publications Instagram</h2>
        <p>
          Le site lit les publications publiques du compte Instagram de Maximilien Huet pour les
          afficher ici : nom du compte, biographie, photo de profil, légendes, miniatures, liens
          et dates. L’autorisation demandée à Meta est en <strong>lecture seule</strong> — le
          site <strong>ne publie jamais</strong> sur les réseaux, ne commente pas, n’envoie pas
          de message.
        </p>
        <p>
          Aucune donnée d’un autre utilisateur Instagram n’est collectée : ni vos abonnements,
          ni vos mentions « j’aime », ni votre compte si vous en avez un. Le jeton d’accès remis
          par Meta est chiffré avant d’être stocké et n’est jamais exposé par le site.
        </p>

        <h2>Le back-office</h2>
        <p>
          L’administration du site est réservée à deux personnes, qui s’y connectent par leur
          compte Google. Seules l’adresse e-mail et l’identifiant de compte sont enregistrés,
          avec un cookie de session strictement nécessaire à la connexion. Les autorisations
          demandées à Google se limitent à l’identité : le site ne lit ni la messagerie, ni
          l’agenda, ni les fichiers.
        </p>

        <h2>À qui les données sont confiées</h2>
        <ul>
          <li>
            <strong>Hetzner Online GmbH</strong> (Allemagne) — hébergement du serveur et de la
            base de données.
          </li>
          <li>
            <strong>Cloudflare</strong> — noms de domaine, protection du site et stockage des
            images et documents.
          </li>
          <li><strong>Meta</strong> — source des publications Instagram affichées.</li>
          <li><strong>Google</strong> — authentification des deux comptes du back-office.</li>
        </ul>
        <p>
          Aucune donnée n’est vendue, louée ni transmise à un tiers en dehors de ces
          prestataires.
        </p>

        <h2>Combien de temps</h2>
        <p>
          Les publications importées et les articles restent tant qu’ils sont affichés sur le
          site. Les compteurs de lecture sont conservés sans limite, puisqu’ils ne désignent
          personne. Les journaux techniques des prestataires suivent leurs propres durées, de
          l’ordre de quelques semaines.
        </p>

        <h2 id="data-deletion">Suppression des données</h2>
        <p>Deux chemins, selon ce que vous voulez faire disparaître.</p>
        <ul>
          <li>
            <strong>Couper l’accès Instagram.</strong> Depuis le compte Instagram concerné :
            Paramètres → Applications et sites web → retirer l’accès de l’application
            « Un Max d’info ». La synchronisation s’arrête immédiatement.
          </li>
          <li>
            <strong>Demander l’effacement.</strong> Écrivez à
            <a href="mailto:maxhuetytb@gmail.com">maxhuetytb@gmail.com</a> : les publications
            enregistrées, le jeton d’accès chiffré et les données de compte associées sont
            supprimés du serveur et de la base sous trente jours, et la demande reçoit une
            réponse écrite.
          </li>
        </ul>

        <h2>Vos droits</h2>
        <p>
          Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation et
          d’opposition. Une seule adresse pour tout :
          <a href="mailto:maxhuetytb@gmail.com">maxhuetytb@gmail.com</a>. Si la réponse ne vous
          satisfait pas, vous pouvez saisir la CNIL.
        </p>

        <h2>Modifications</h2>
        <p>
          Toute évolution de cette page est publiée ici même, avec sa date. Voir aussi les
          <NuxtLink to="/legal">mentions légales</NuxtLink> et les
          <NuxtLink to="/terms">conditions d’utilisation</NuxtLink>.
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
