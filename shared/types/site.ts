/** Les réglages de portée publique, tels que les renvoie `GET /api/site`. */

export interface Identity {
  name: string
  author: string
  byline: string
  tagline: string
  pitch: string
}

export interface ContactField {
  key: string
  label: string
  value: string
  href: string
  visible: boolean
}

export interface SitePublic {
  identity: Identity
  contact: { fields: ContactField[] }
  cv: { skills: { group: string; items: string[] }[] }
  seo: { title: string; description: string }
  home: { sections: string[] }
  instagram_public: { handle: string; url: string }
}
