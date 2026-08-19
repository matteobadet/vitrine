# mbadet.fr — site vitrine

Site vitrine Astro (SSR) présentant les projets personnels (RandoHost, CycloTrack,
SkillForge, ScrumMaster), une page à propos et un formulaire de contact envoyant
un email via [Resend](https://resend.com).

## Contenu à personnaliser avant mise en ligne

Tout le contenu est codé en dur dans le code source (pas de CMS). À éditer :

- [src/pages/index.astro](src/pages/index.astro) — descriptions, liens et statut (`live` / `dev`) des 4 projets (marqués `TODO`).
- [src/pages/a-propos.astro](src/pages/a-propos.astro) — bio, compétences, parcours (marqués `TODO`).
- [src/components/Footer.astro](src/components/Footer.astro) — adresse email affichée.
- [public/favicon.svg](public/favicon.svg) — favicon provisoire (initiale "M" en dégradé), à remplacer si besoin.

Le portrait (`src/assets/matteo.jpg`) est déjà en place sur l'accueil et la page
à propos, optimisé automatiquement par Astro (`astro:assets`) en WebP.

Après chaque modification, il faut rebuilder et redéployer (voir plus bas).

## Développement local

```bash
npm install
cp .env.example .env   # puis renseigner RESEND_API_KEY, CONTACT_EMAIL_TO, CONTACT_EMAIL_FROM
npm run dev
```

## Variables d'environnement

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Clé API Resend (resend.com/api-keys) |
| `CONTACT_EMAIL_TO` | Adresse qui reçoit les messages du formulaire |
| `CONTACT_EMAIL_FROM` | Adresse d'expédition — doit appartenir à un domaine vérifié dans Resend (voir plus bas) |
| `PORT` / `HOST` | Écoute du serveur Node (défaut `4321` / `0.0.0.0`) |

### Configurer Resend

1. Créer un compte sur [resend.com](https://resend.com) et générer une clé API.
2. Vérifier le domaine `mbadet.fr` dans Resend (ajout d'enregistrements DNS
   SPF/DKIM fournis par Resend chez votre registrar) — nécessaire pour pouvoir
   envoyer depuis `contact@mbadet.fr`. Sans domaine vérifié, Resend n'autorise
   l'envoi que depuis `onboarding@resend.dev`, à réserver aux tests.
3. Renseigner `RESEND_API_KEY`, `CONTACT_EMAIL_TO` et `CONTACT_EMAIL_FROM`.

## Déploiement (k3s + Traefik + cert-manager, même cluster que skillforge)

La prod ne passe **pas** par `docker-compose.yml` (celui-ci sert uniquement au
dev local, voir plus bas) mais par le cluster k3s existant, exactement comme
skillforge : image buildée et poussée sur un registre par CI, puis appliquée
au cluster via `kubectl`. Manifestes dans [k8s/](k8s), workflow dans
[.github/workflows/deploy.yml](.github/workflows/deploy.yml).

Traefik (l'ingress controller intégré à k3s) route par nom d'hôte vers les
Services internes, et cert-manager gère les certificats Let's Encrypt via le
`ClusterIssuer` `letsencrypt-prod` déjà en place pour skillforge — les
manifestes réutilisent donc directement ce même issuer.

skillforge tourne dans son propre namespace `skillforge` (pas `default`) ;
mbadet-vitrine a donc son propre namespace dédié `mbadet-vitrine`, à créer une
fois :

```bash
kubectl create namespace mbadet-vitrine
```

### 1. Secrets GitHub Actions

Dans les settings du repo GitHub (Settings → Secrets and variables → Actions) :

- `KUBE_CONFIG` — le kubeconfig du cluster k3s, encodé en base64
  (`sudo cat /etc/rancher/k3s/k3s.yaml | base64 -w0` sur le VPS — l'IP du
  cluster dans ce fichier doit rester joignable depuis les runners GitHub).
  `GITHUB_TOKEN` (pour pousser sur GHCR) est fourni automatiquement, rien à
  ajouter.

### 2. Créer le Secret Resend dans le cluster (une seule fois)

Ne jamais committer la clé API dans un fichier du dépôt — création directe
dans le cluster :

```bash
kubectl create secret generic mbadet-vitrine-resend \
  -n mbadet-vitrine \
  --from-literal=RESEND_API_KEY=<votre_clé_resend> \
  --from-literal=CONTACT_EMAIL_TO=contact@mbadet.fr \
  --from-literal=CONTACT_EMAIL_FROM='Contact mbadet.fr <contact@mbadet.fr>'
```

(La clé réelle vous a été communiquée en dehors de ce dépôt — la coller
uniquement dans cette commande exécutée localement contre le cluster, jamais
dans un fichier versionné. `k8s/secret-resend.example.yaml` ne documente que
la forme attendue, à ne pas remplir avec la vraie clé.)

Ce Secret doit exister **avant** le premier déploiement CI, sinon les pods
resteront bloqués en `CreateContainerConfigError` faute de variables
d'environnement.

### 3. DNS

Pointer `mbadet.fr` et `www.mbadet.fr` (enregistrements A/AAAA) vers la même
IP publique que `skillforge.mbadet.fr`, puisque Traefik route par nom d'hôte
sur ce même cluster.

### 4. Déploiement (premier et suivants)

Aucune commande `kubectl apply` manuelle n'est nécessaire : chaque push sur
`master` déclenche [.github/workflows/deploy.yml](.github/workflows/deploy.yml),
qui build l'image, la pousse sur GHCR, puis fait un `kubectl apply` des trois
manifestes (`deployment.yaml`, `service.yaml`, `ingress.yaml`) avec le tag
d'image du commit. `kubectl apply` étant idempotent, ce même step crée les
objets s'ils n'existent pas encore et les met à jour sinon — donc le tout
premier push (une fois le Secret Resend et `KUBE_CONFIG` en place) suffit à
la fois à créer le déploiement et à publier chaque mise à jour ultérieure.

## Dev local avec Docker (optionnel)

```bash
docker compose build
docker compose up -d   # http://localhost:4321
```
