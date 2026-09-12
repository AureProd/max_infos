<script setup>
import { ref, onMounted } from 'vue'
import InstagramEmbed from './InstagramEmbed.vue'
import { parseInstagramUrl } from '@/lib/igUrl'

/**
 * Banc d'essai de l'intégration : colle l'adresse d'une publication et
 * l'embed officiel Instagram s'affiche aussitôt. Les adresses saisies
 * sont conservées dans le navigateur, le temps de la maquette ; en
 * production elles vivront en base, saisies depuis le back-office.
 */
const KEY = 'unmaxdinfo.ig.embeds'

const url = ref('')
const error = ref('')
const items = ref([])

onMounted(() => {
  try {
    items.value = JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    items.value = []
  }
})

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.value))
  } catch {
    /* navigation privée */
  }
}

function add() {
  const parsed = parseInstagramUrl(url.value)
  if (!parsed) {
    error.value = 'Adresse non reconnue. Attendu : instagram.com/p/XXXX/ ou /reel/XXXX/'
    return
  }
  if (items.value.some((i) => i.shortcode === parsed.shortcode)) {
    error.value = 'Cette publication est déjà affichée.'
    return
  }
  error.value = ''
  items.value = [parsed, ...items.value]
  url.value = ''
  persist()
}

function remove(shortcode) {
  items.value = items.value.filter((i) => i.shortcode !== shortcode)
  persist()
}
</script>

<template>
  <div class="ig-connect">
    <form @submit.prevent="add">
      <label for="ig-url">Adresse d'une publication Instagram</label>
      <div class="row">
        <input
          id="ig-url"
          v-model="url"
          type="url"
          inputmode="url"
          placeholder="https://www.instagram.com/p/XXXXXXXXXXX/"
          @input="error = ''"
        />
        <button class="btn btn-primary" type="submit">Afficher</button>
      </div>
      <p v-if="error" class="err">{{ error }}</p>
      <p v-else class="hint">
        Ouvre une publication sur Instagram, copie l'adresse de la barre du navigateur et colle-la
        ici. L'embed officiel se charge directement depuis Instagram.
      </p>
    </form>

    <ul v-if="items.length" class="ig-live">
      <li v-for="item in items" :key="item.shortcode">
        <InstagramEmbed :shortcode="item.shortcode" :kind="item.kind" />
        <button class="btn" type="button" @click="remove(item.shortcode)">Retirer</button>
      </li>
    </ul>
  </div>
</template>
