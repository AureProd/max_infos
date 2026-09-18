<script setup lang="ts">
/**
 * Partager un article.
 *
 * Two behaviours, one button. On a phone, `navigator.share` opens the
 * system sheet — the one that already knows which apps are installed, which
 * is the only honest way to offer Instagram or a messaging app the web
 * cannot address. Everywhere else, the dialog below.
 *
 * A native `<dialog>` rather than a component from the library: it brings
 * the modal behaviour, the backdrop, the focus trap and Escape for free,
 * and the public site deliberately loads nothing of PrimeVue — it must not
 * look like a dashboard.
 */
const props = defineProps<{ title: string; url?: string }>()

const dialog = ref<HTMLDialogElement | null>(null)
const copied = ref(false)

/**
 * The address to share.
 *
 * Read in the browser and not from the route: `useRequestURL()` during
 * server rendering gives the address of the container, and a shared link
 * would point at `localhost`.
 */
const href = ref(props.url ?? '')
onMounted(() => {
  if (!props.url) href.value = window.location.href
})

const encoded = computed(() => encodeURIComponent(href.value))
const subject = computed(() => encodeURIComponent(props.title))

/**
 * Les cibles du partage.
 *
 * `copyFirst` désigne celles que le web ne sait pas adresser : le lien est
 * copié avant l'ouverture, faute de pouvoir le leur passer.
 */
const targets = computed<
  { key: string; label: string; icon: string; to: string; copyFirst?: boolean }[]
>(() => [
  /*
   * `x.com/intent/post`, et non plus `twitter.com/intent/tweet`.
   *
   * L'ancienne adresse redirige vers la nouvelle, et la redirection perd
   * les paramètres : le rédacteur s'ouvrait vide. C'est le seul des trois
   * réseaux qui accepte encore un texte préparé.
   */
  {
    key: 'x',
    label: 'X',
    icon: 'pi-twitter',
    to: `https://x.com/intent/post?url=${encoded.value}&text=${subject.value}`,
  },
  /*
   * Le rédacteur de LinkedIn, et non son ancien point de partage.
   *
   * `sharing/share-offsite` ouvre une fenêtre qui ne montre que ce que
   * LinkedIn arrive à lire de la page. `shareActive=true&shareUrl=` ouvre
   * le rédacteur avec le lien déjà attaché, ce qui est ce qu'on veut.
   */
  {
    key: 'linkedin',
    label: 'LinkedIn',
    icon: 'pi-linkedin',
    to: `https://www.linkedin.com/feed/?shareActive=true&shareUrl=${encoded.value}`,
  },
  /*
   * Facebook ne prend QUE l'adresse.
   *
   * Le paramètre `quote` a été retiré de `sharer.php` : aucun texte
   * préparé n'est possible, et l'aperçu vient des balises OpenGraph que
   * Facebook va lire à cette adresse. En développement il n'y a donc rien
   * à voir — `localhost` n'est lisible que depuis cette machine.
   */
  {
    key: 'facebook',
    label: 'Facebook',
    icon: 'pi-facebook',
    to: `https://www.facebook.com/sharer/sharer.php?u=${encoded.value}`,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: 'pi-whatsapp',
    to: `https://wa.me/?text=${subject.value}%20${encoded.value}`,
  },
  /*
   * Instagram n'a PAS d'adresse de partage web.
   *
   * Aucune URL ne lui passe un lien, contrairement à X ou Facebook : ni
   * story, ni message, ni publication. La tuile fait donc les DEUX gestes
   * qui, ensemble, valent un partage — elle copie l'adresse, puis ouvre
   * Instagram. Il ne reste qu'à coller.
   *
   * Ouvrir sans copier enverrait sur Instagram sans le lien ; copier sans
   * ouvrir demanderait d'y aller soi-même. C'est le réseau de Max, il a sa
   * place avant un Telegram que personne n'utilise ici.
   */
  {
    key: 'instagram',
    label: 'Instagram',
    icon: 'pi-instagram',
    // Le rédacteur de story plutôt que le fil : on arrive là où on voulait
    // aller, l'adresse dans le presse-papiers, prête à coller.
    to: 'https://www.instagram.com/create/story/',
    copyFirst: true,
  },
  {
    key: 'email',
    label: 'E-mail',
    icon: 'pi-envelope',
    to: `mailto:?subject=${subject.value}&body=${encoded.value}`,
  },
])

/** Vrai quand le navigateur sait ouvrir la feuille de partage du système. */
const hasSystemSheet = ref(false)
onMounted(() => {
  hasSystemSheet.value = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
})

async function share(): Promise<void> {
  if (hasSystemSheet.value) {
    try {
      await navigator.share({ title: props.title, url: href.value })
      return
    } catch {
      // Annulé, ou refusé par le navigateur : on retombe sur la fenêtre.
    }
  }
  dialog.value?.showModal()
}

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(href.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // Le presse-papiers est refusé hors contexte sécurisé. Le champ à côté
    // reste sélectionnable : l'adresse est lisible de toute façon.
  }
}
</script>

<template>
  <div class="share">
    <button type="button" class="share-open" @click="share">
      <i class="pi pi-share-alt" aria-hidden="true" />
      <span>Partager</span>
    </button>

    <dialog ref="dialog" class="share-box" @click.self="dialog?.close()">
      <div class="share-head">
        <h2>Partager l'article</h2>
        <button type="button" class="share-close" aria-label="Fermer" @click="dialog?.close()">
          <i class="pi pi-times" aria-hidden="true" />
        </button>
      </div>

      <ul class="share-grid">
        <li v-for="t in targets" :key="t.key">
          <!--
            Le lien reste un lien, même quand il faut copier d'abord :
            clic milieu, « ouvrir dans un onglet » et le menu contextuel
            marchent, ce qu'un `<button>` ne sait pas faire.
          -->
          <a
            :href="t.to"
            target="_blank"
            rel="noopener"
            :title="t.copyFirst ? `Copie l'adresse, puis ouvre ${t.label}` : undefined"
            @click="t.copyFirst && copy()"
          >
            <i :class="['pi', t.icon]" aria-hidden="true" />
            <span>{{ t.label }}</span>
          </a>
        </li>
      </ul>

      <!--
        Le champ reste : l'adresse doit être LISIBLE, et sélectionnable là
        où le presse-papiers est refusé — hors contexte sécurisé, il l'est.
      -->
      <div class="share-copy">
        <input :value="href" readonly aria-label="Adresse de l'article" @focus="($event.target as HTMLInputElement).select()" />
        <button type="button" @click="copy">
          <i :class="['pi', copied ? 'pi-check' : 'pi-copy']" aria-hidden="true" />
          <span>{{ copied ? 'Copié' : 'Copier' }}</span>
        </button>
      </div>
      <p class="share-note">
        Instagram ne reçoit pas de lien depuis un navigateur : la tuile copie l'adresse et
        ouvre le rédacteur de story, il ne reste qu'à coller. Facebook et LinkedIn n'acceptent
        pas de texte préparé — ils lisent la page elle-même.
      </p>
    </dialog>
  </div>
</template>
