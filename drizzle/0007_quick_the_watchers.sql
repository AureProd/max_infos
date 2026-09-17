ALTER TABLE "article" ADD COLUMN "body_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Le texte brut des articles déjà en base.
--
-- `body_html` est rempli pour tous : il est rendu à chaque enregistrement
-- depuis toujours. Il n'y a donc RIEN à convertir — seulement à en extraire
-- le texte, ce que Postgres sait faire.
--
-- Les balises deviennent une ESPACE et non rien : collés, « Titre » et
-- « Un » formeraient « TitreUn », introuvable. Les entités que
-- `sanitize-html` produit sont remises en caractères, sans quoi une
-- recherche sur « & » ne trouverait rien.
--
-- Approximation assumée sur les entités les plus rares : la valeur exacte
-- est recalculée par le serveur au premier enregistrement de l'article.
UPDATE "article"
SET "body_text" = btrim(
  regexp_replace(
    replace(
      replace(
        replace(
          replace(regexp_replace("body_html", '<[^>]*>', ' ', 'g'), '&amp;', '&'),
          '&lt;', '<'
        ),
        '&gt;', '>'
      ),
      '&quot;', '"'
    ),
    '\s+', ' ', 'g'
  )
)
WHERE "body_html" <> '';
