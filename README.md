# Un Max d'info — maquette du site

Maquette interactive du site personnel de **Maximilien Huet**, qui rassemble au même
endroit les articles longs publiés en newsletter, les publications Instagram et les
versions courtes. Thème sombre, angles francs, accent sur le bleu du logo (`#2462E9`).

C'est une **maquette locale** : aucune base de données, aucune API. Le contenu vit dans
`frontend/src/data/` et `frontend/src/content/`.

---

## Démarrer / arrêter

```bash
cd frontend
npm install      # la première fois seulement
npm run dev      # démarre → http://localhost:5173/
```

Arrêter : **Ctrl + C** dans le terminal où tourne la commande.

S'il tourne en arrière-plan et que tu n'as plus le terminal :

```bash
pkill -f "vite"                  # arrête le serveur
lsof -i :5173                    # vérifier que le port est libéré
```

Autres commandes :

```bash
npm run build    # construit le site statique dans frontend/dist/
npm run preview  # sert le build de production pour vérification
```

---

## Où se trouve quoi

| Fichier | Contenu |
|---|---|
| `frontend/src/assets/base.css` | Toute la charte : couleurs, typographie, mises en page |
| `frontend/src/data/site.js` | Nom, accroche, liens, compétences |
| `frontend/src/data/articles.js` | Métadonnées des articles (titres, dates, couvertures, tags) |
| `frontend/src/content/*.md` | Le texte des articles, en Markdown |
| `frontend/src/data/instagram.js` | Publications Instagram et aperçu du format carrousel |

### Changer la palette

Tout est en haut de `base.css`, dans le bloc `:root`. Les neutres suivent le thème sombre
de Discord, teintés vers le bleu du logo ; l'ambre `--gold` est son complémentaire exact
et ne sert qu'aux chiffres clés et à la mention « À la une ».

### Ajouter un article

1. Déposer le texte dans `frontend/src/content/mon-article.md`
2. L'importer et ajouter son entrée dans `frontend/src/data/articles.js`

Les intertitres s'écrivent `## Mon intertitre`, les citations `> Ma citation`.

### Ajouter une publication Instagram

Copier l'adresse de la publication, puis reporter l'identifiant qui suit `/p/` ou `/reel/`
dans le champ `shortcode` de `frontend/src/data/instagram.js`. L'embed officiel se charge
directement depuis Instagram, sans jeton ni compte développeur.

Un banc d'essai est aussi intégré à la page d'accueil : coller une adresse dans le champ
prévu affiche l'embed immédiatement, sans toucher au code.

---

## À savoir

- **Les embeds Instagram sont servis en thème clair** par Instagram, et cela ne peut pas
  être changé. Trois options restent à trancher : les garder tels quels, utiliser
  `/embed/` sans légende, ou ne les afficher que sur la page d'une publication.
- **Aucune récupération automatique n'est possible** : l'API Basic Display d'Instagram a
  fermé fin 2024 et l'API profil exige une connexion. Les publications se renseignent donc
  à la main.
- **Les articles n'ont pas d'intertitres** dans leur source d'origine. Le rendu les prend
  en charge dès qu'ils sont ajoutés.

## Ensuite

La version de production est **en cours de construction**. L'état d'avancement, le plan complet
et les prochaines étapes sont dans [`REPRISE.md`](REPRISE.md) et [`docs/PLAN.md`](docs/PLAN.md).
