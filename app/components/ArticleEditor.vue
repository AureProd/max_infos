<script setup lang="ts">
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Paragraph from '@tiptap/extension-paragraph'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { Editor, EditorContent } from '@tiptap/vue-3'

/**
 * Le paragraphe, plus UNE classe : celle des boutons Substack.
 *
 * Tiptap ne garde que ce que son schéma décrit — un `class` inséré tel quel
 * disparaissait à la sérialisation, et le bouton revenait en paragraphe
 * ordinaire. Une seule valeur est admise : un attribut de classe libre
 * laisserait le corps d'un article repeindre la page, et l'assainissement
 * du serveur applique exactement la même restriction.
 */
const CTA = 'article-cta'

const ParagraphWithCta = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: (el: HTMLElement) => (el.classList.contains(CTA) ? CTA : null),
        renderHTML: (attrs: Record<string, unknown>) => (attrs.class === CTA ? { class: CTA } : {}),
      },
    }
  },
})

/**
 * Écrire un article.
 *
 * Remplace un `<textarea>` de Markdown brut. Ce que Max tapait, il le
 * relisait balisé : des `**` autour des mots gras, des `[texte](adresse)`
 * au milieu des phrases. Il écrit désormais dans la mise en forme, et le
 * document est du HTML, qui est aussi ce que la base stocke.
 *
 * Ce qui vient AVEC l'éditeur, et qu'un textarea ne donnait pas : Ctrl+Z
 * sur une mise en forme et non sur des caractères, le collage d'une image
 * depuis le presse-papiers, et un collage de texte riche qui devient du
 * balisage propre au lieu d'être aplati.
 *
 * Le HTML produit ici n'est PAS de confiance : il est assaini côté serveur
 * à l'enregistrement, par la même fonction que l'import et l'aperçu.
 */
const model = defineModel<string>({ default: '' })
const props = withDefaults(defineProps<{ substackUrl?: string | null }>(), { substackUrl: null })

const { fail } = useNotify()

const editor = shallowRef<Editor | null>(null)

/**
 * Ce qui rend la barre d'outils réactive.
 *
 * `editor.isActive()` lit l'état de ProseMirror, qui vit HORS de Vue : rien
 * ne prévient le composant qu'il a changé. Les boutons ne se rallumaient
 * donc qu'au prochain rendu déclenché par autre chose — le gras s'appliquait
 * bien, mais le bouton restait éteint, de façon intermittente.
 *
 * Ce compteur est touché à chaque transaction et relu par `on()` : c'est la
 * dépendance qui manquait.
 */
const tick = ref(0)
const linkOpen = ref(false)
const linkHref = ref('')
const sending = ref(false)

/** Téléverse un fichier vers R2 et rend son adresse publique. */
async function upload(file: File): Promise<string | null> {
  sending.value = true
  try {
    const { media, uploadUrl } = await $fetch<{
      media: { id: number; url: string }
      uploadUrl: string
    }>('/api/admin/media/upload-url', {
      method: 'POST',
      body: { filename: file.name, contentType: file.type, bytes: file.size },
    })

    // Envoi direct à R2 : le fichier ne traverse pas Nitro. Le content-type
    // doit être EXACTEMENT celui signé, la signature le couvre.
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'content-type': file.type },
    }).catch(() => {
      // Un préflight refusé par le seau arrive en TypeError nu : pas de
      // statut, pas de message, rien dans nos journaux.
      throw new Error(
        "Le stockage a refusé la connexion : la règle CORS du seau n'autorise pas ce site (pnpm r2:cors).",
      )
    })
    if (!response.ok) throw new Error(`Le stockage a refusé le fichier (${response.status})`)

    return media.url
  } catch (e) {
    fail(e, 'Envoi de l’image impossible')
    return null
  } finally {
    sending.value = false
  }
}

async function insertImage(file: File | undefined | null): Promise<void> {
  if (!file?.type.startsWith('image/')) return
  const url = await upload(file)
  if (url) editor.value?.chain().focus().setImage({ src: url }).run()
}

onMounted(() => {
  editor.value = new Editor({
    content: model.value,
    extensions: [
      StarterKit.configure({
        // Un article n'a pas de titre de niveau 1 dans son corps : c'est le
        // titre de la page, et deux <h1> brouillent le plan pour un robot
        // comme pour un lecteur d'écran.
        heading: { levels: [2, 3] },
        link: false,
        paragraph: false,
      }),
      ParagraphWithCta,
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ['http', 'https', 'mailto'],
      }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder: 'Écris ici…' }),
    ],
    editorProps: {
      attributes: { class: 'a-prose' },
      /** Une image collée depuis le presse-papiers part sur R2. */
      handlePaste: (_view, event) => {
        const file = [...(event.clipboardData?.items ?? [])]
          .find((i) => i.type.startsWith('image/'))
          ?.getAsFile()
        if (!file) return false
        void insertImage(file)
        return true
      },
      handleDrop: (_view, event) => {
        const file = (event as DragEvent).dataTransfer?.files?.[0]
        if (!file?.type.startsWith('image/')) return false
        event.preventDefault()
        void insertImage(file)
        return true
      },
    },
    onUpdate: ({ editor: e }) => {
      model.value = e.getHTML()
    },
    // Toute transaction, y compris un simple déplacement du curseur : c'est
    // ce qui décide de l'état des boutons.
    onTransaction: () => {
      tick.value += 1
    },
  })
})

/*
 * Le document ne se recharge QUE s'il a changé ailleurs.
 *
 * Sans la comparaison, chaque frappe repassait par `setContent`, qui
 * reconstruit le document : le curseur retombait au début et l'historique
 * — donc Ctrl+Z — repartait de zéro à chaque lettre.
 */
watch(model, (next) => {
  const e = editor.value
  if (e && next !== e.getHTML()) e.commands.setContent(next, { emitUpdate: false })
})

onBeforeUnmount(() => editor.value?.destroy())

/** Est-ce actif là où se trouve le curseur ? */
const on = (name: string, attrs?: Record<string, unknown>): boolean => {
  // Lu pour la dépendance : sans elle, Vue ne sait pas que l'état a changé.
  void tick.value
  return editor.value?.isActive(name, attrs) ?? false
}

function openLink(): void {
  linkHref.value = editor.value?.getAttributes('link').href ?? ''
  linkOpen.value = true
}

function applyLink(): void {
  const chain = editor.value?.chain().focus()
  const href = linkHref.value.trim()
  if (!href) chain?.unsetLink().run()
  else chain?.extendMarkRange('link').setLink({ href }).run()
  linkOpen.value = false
}

function pickImage(event: Event): void {
  void insertImage((event.target as HTMLInputElement).files?.[0])
}

/**
 * Les trois liens d'un article venu du Substack.
 *
 * Collés à la main, ils arrivaient en adresses nues au bas du texte — c'est
 * ce que montre chaque article rapatrié. Insérés ici, ils portent leur
 * libellé et leur icône, et l'adresse se déduit de celle de l'article.
 */
const substackLinks = computed(() => {
  const url = props.substackUrl
  if (!url) return []
  const root = url.replace(/\/p\/.*$/, '')
  return [
    { label: 'S’abonner à la newsletter', href: `${root}/subscribe`, icon: 'pi-envelope' },
    { label: 'Partager cet article', href: `${url}?utm_source=site`, icon: 'pi-share-alt' },
    { label: 'Laisser un commentaire', href: `${url}/comments`, icon: 'pi-comment' },
  ]
})

function insertCta(href: string, label: string): void {
  editor.value
    ?.chain()
    .focus()
    // Un paragraphe porteur d'une classe : la feuille du site l'habille en
    // bouton, et l'assainissement du serveur laisse passer `class` sur un
    // `<p>`, et sur lui seul.
    .insertContent(`<p class="article-cta"><a href="${href}">${label}</a></p>`)
    .run()
}
</script>

<template>
  <div class="a-writer">
    <!--
      La barre ne prend PAS le focus.

      Un `<button>` cliqué le vole à l'éditeur, et la sélection se perd avant
      que la commande ne s'exécute : le gras s'appliquait au mot, ou à rien,
      selon l'ordre dans lequel le navigateur avait traité les évènements.
      `mousedown.prevent` laisse la sélection où elle est — c'est le geste
      standard d'une barre d'outils de traitement de texte.
    -->
    <div class="a-writer-bar" role="toolbar" aria-label="Mise en forme">
      <div class="a-writer-group">
        <button
          v-tooltip.bottom="'Gras (Ctrl+B)'"
          type="button"
          @mousedown.prevent
          :class="['a-tool', on('bold') && 'is-on']"
          aria-label="Gras"
          @click="editor?.chain().focus().toggleBold().run()"
        >
          <i class="pi pi-bold" aria-hidden="true" />
        </button>
        <button
          v-tooltip.bottom="'Italique (Ctrl+I)'"
          type="button"
          @mousedown.prevent
          :class="['a-tool', on('italic') && 'is-on']"
          aria-label="Italique"
          @click="editor?.chain().focus().toggleItalic().run()"
        >
          <i class="pi pi-italic" aria-hidden="true" />
        </button>
        <button
          v-tooltip.bottom="'Barré'"
          type="button"
          @mousedown.prevent
          :class="['a-tool', on('strike') && 'is-on']"
          aria-label="Barré"
          @click="editor?.chain().focus().toggleStrike().run()"
        >
          <i class="pi pi-minus" aria-hidden="true" />
        </button>
      </div>

      <div class="a-writer-group">
        <button
          v-tooltip.bottom="'Intertitre'"
          type="button"
          @mousedown.prevent
          :class="['a-tool', on('heading', { level: 2 }) && 'is-on']"
          aria-label="Intertitre"
          @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          H2
        </button>
        <button
          v-tooltip.bottom="'Sous-intertitre'"
          type="button"
          @mousedown.prevent
          :class="['a-tool', on('heading', { level: 3 }) && 'is-on']"
          aria-label="Sous-intertitre"
          @click="editor?.chain().focus().toggleHeading({ level: 3 }).run()"
        >
          H3
        </button>
      </div>

      <div class="a-writer-group">
        <button
          v-tooltip.bottom="'Liste à puces'"
          type="button"
          @mousedown.prevent
          :class="['a-tool', on('bulletList') && 'is-on']"
          aria-label="Liste à puces"
          @click="editor?.chain().focus().toggleBulletList().run()"
        >
          <i class="pi pi-list" aria-hidden="true" />
        </button>
        <button
          v-tooltip.bottom="'Liste numérotée'"
          type="button"
          @mousedown.prevent
          :class="['a-tool', on('orderedList') && 'is-on']"
          aria-label="Liste numérotée"
          @click="editor?.chain().focus().toggleOrderedList().run()"
        >
          <i class="pi pi-sort-numeric-down" aria-hidden="true" />
        </button>
        <button
          v-tooltip.bottom="'Citation'"
          type="button"
          @mousedown.prevent
          :class="['a-tool', on('blockquote') && 'is-on']"
          aria-label="Citation"
          @click="editor?.chain().focus().toggleBlockquote().run()"
        >
          <i class="pi pi-comment" aria-hidden="true" />
        </button>
        <button
          v-tooltip.bottom="'Séparateur'"
          type="button"
          @mousedown.prevent
          class="a-tool"
          aria-label="Séparateur"
          @click="editor?.chain().focus().setHorizontalRule().run()"
        >
          <i class="pi pi-minus-circle" aria-hidden="true" />
        </button>
      </div>

      <div class="a-writer-group">
        <button
          v-tooltip.bottom="'Lien'"
          type="button"
          @mousedown.prevent
          :class="['a-tool', on('link') && 'is-on']"
          aria-label="Lien"
          @click="openLink"
        >
          <i class="pi pi-link" aria-hidden="true" />
        </button>
        <label v-tooltip.bottom="'Image'" class="a-tool" aria-label="Insérer une image">
          <i :class="['pi', sending ? 'pi-spin pi-spinner' : 'pi-image']" aria-hidden="true" />
          <input type="file" accept="image/*" hidden :disabled="sending" @change="pickImage" />
        </label>
      </div>

      <div v-if="substackLinks.length" class="a-writer-group">
        <button
          v-for="l in substackLinks"
          :key="l.href"
          v-tooltip.bottom="l.label"
          type="button"
          @mousedown.prevent
          class="a-tool"
          :aria-label="l.label"
          @click="insertCta(l.href, l.label)"
        >
          <i :class="['pi', l.icon]" aria-hidden="true" />
        </button>
      </div>

      <div class="a-writer-group a-writer-undo">
        <button
          v-tooltip.bottom="'Annuler (Ctrl+Z)'"
          type="button"
          @mousedown.prevent
          class="a-tool"
          aria-label="Annuler"
          :disabled="!(tick >= 0 && editor?.can().undo())"
          @click="editor?.chain().focus().undo().run()"
        >
          <i class="pi pi-undo" aria-hidden="true" />
        </button>
        <button
          v-tooltip.bottom="'Rétablir (Ctrl+Maj+Z)'"
          type="button"
          @mousedown.prevent
          class="a-tool"
          aria-label="Rétablir"
          :disabled="!(tick >= 0 && editor?.can().redo())"
          @click="editor?.chain().focus().redo().run()"
        >
          <i class="pi pi-refresh" aria-hidden="true" />
        </button>
      </div>
    </div>

    <EditorContent v-if="editor" :editor="editor" class="a-writer-page" />

    <Dialog
      v-model:visible="linkOpen"
      modal
      header="Adresse du lien"
      :style="{ width: '28rem', maxWidth: 'calc(100vw - 2rem)' }"
      :pt="{ root: { class: 'admin-ui' } }"
    >
      <InputText
        v-model="linkHref"
        placeholder="https://…"
        fluid
        autofocus
        @keydown.enter.prevent="applyLink"
      />
      <p class="hint">Laisser vide retire le lien.</p>
      <template #footer>
        <Button severity="secondary" outlined label="Annuler" @click="linkOpen = false" />
        <Button label="Appliquer" @click="applyLink" />
      </template>
    </Dialog>
  </div>
</template>
