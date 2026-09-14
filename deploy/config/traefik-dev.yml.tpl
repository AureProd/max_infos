# Gabarit de la configuration statique du Traefik de développement.
# ./setup en dérive deploy/config/traefik-dev.yml par envsubst — fichier
# généré, donc gitignoré.
#
# Ce Traefik est JETABLE et local. Celui de production existe déjà sur le
# VPS : le projet s'y raccorde sans jamais le modifier.

entryPoints:
  web:
    address: ":80"

providers:
  docker:
    exposedByDefault: false
    # Compose nomme le réseau d'après le projet, et Traefik n'applique pas
    # ce préfixe de lui-même.
    network: ${INSTANCE_NAME}_reverse_proxy
    # Ne découvrir que les conteneurs de CETTE instance.
    #
    # Traefik les énumère par la socket Docker, qui liste TOUS les
    # conteneurs de la machine quels que soient les réseaux. Chaque clone du
    # dépôt publie les mêmes règles Host(...). Sans cette contrainte, chaque
    # Traefik les enregistre toutes et la requête est servie par l'instance
    # qui a gagné la course. `com.docker.compose.project` est posé par
    # Compose : il n'y a aucun label à tenir à jour.
    constraints: "Label(`com.docker.compose.project`, `${INSTANCE_NAME}`)"

api:
  dashboard: true
  # Acceptable uniquement parce que le port n'est publié que sur
  # 127.0.0.1:${DASHBOARD_PORT}, jamais sur 0.0.0.0.
  insecure: true

log:
  level: "INFO"

# Sur la sortie standard (docker compose logs rp) plutôt que dans un
# fichier : évite un répertoire ./logs appartenant à root dans le dépôt.
accessLog:
  fields:
    names:
      StartUTC: drop
