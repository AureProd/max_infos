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

/** Ce que le web sait adresser par une simple URL. */
const targets = computed(() => [
  {
    key: 'x',
    label: 'X',
    icon: 'pi-twitter',
    to: `https://twitter.com/intent/tweet?url=${encoded.value}&text=${subject.value}`,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    icon: 'pi-linkedin',
    to: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded.value}`,
  },
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
  {
    key: 'telegram',
    label: 'Telegram',
    icon: 'pi-telegram',
    to: `https://t.me/share/url?url=${encoded.value}&text=${subject.value}`,
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
          <a :href="t.to" target="_blank" rel="noopener">
            <i :class="['pi', t.icon]" aria-hidden="true" />
            <span>{{ t.label }}</span>
          </a>
        </li>
      </ul>

      <!--
        Instagram et YouTube n'ont pas d'adresse de partage web : rien ne
        permet d'y pousser un lien depuis un navigateur. Copier l'adresse
        est ce qu'on peut vraiment faire, et le libellé le dit.
      -->
      <div class="share-copy">
        <input :value="href" readonly aria-label="Adresse de l'article" @focus="($event.target as HTMLInputElement).select()" />
        <button type="button" @click="copy">
          <i :class="['pi', copied ? 'pi-check' : 'pi-copy']" aria-hidden="true" />
          <span>{{ copied ? 'Copié' : 'Copier' }}</span>
        </button>
      </div>
      <p class="share-note">
        Pour Instagram, YouTube ou une story : copiez l'adresse, puis collez-la dans l'application.
      </p>
    </dialog>
  </div>
</template>
