# Configuration DYNAMIQUE de Traefik : les certificats du développement.
#
# Séparée de la configuration statique parce que Traefik la RELIT à chaud,
# là où l'autre n'est lue qu'au démarrage. Générée par ./setup, gitignorée.
tls:
  stores:
    default:
      defaultCertificate:
        certFile: /certs/local.pem
        keyFile: /certs/local-key.pem
  certificates:
    - certFile: /certs/local.pem
      keyFile: /certs/local-key.pem
