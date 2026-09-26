# Registre Métrologie — SaaS de registre d'équipements, étalonnage et maintenance

Implémentation du cahier des charges : inventaire multi-organisation, QR codes et étiquettes,
scan mobile, historique d'interventions avec certificats, alertes e-mail quotidiennes et
facturation Stripe (plan gratuit limité à 15 équipements, plan Pro à 49 €/mois).

## Stack

| Composant | Choix |
| --- | --- |
| Frontend | Next.js 16 (App Router), Tailwind CSS 4, shadcn/ui, lucide-react |
| Backend | Route Handlers + Server Actions (TypeScript) |
| Base de données | PostgreSQL (Supabase / Neon) + Drizzle ORM (migrations dans `drizzle/`) |
| Stockage | S3 compatible (AWS S3, Cloudflare R2, Supabase Storage) via `@aws-sdk/client-s3` |
| Authentification | Auth.js / NextAuth v5 (identifiants e-mail + mot de passe, JWT) |
| Notifications | Resend + Vercel Cron (`vercel.json`, tous les jours à 06:00 UTC) |
| Paiements | Stripe Checkout + Billing Portal + webhooks |

## Démarrage

```bash
npm install
cp .env.example .env         # renseigner DATABASE_URL, AUTH_SECRET…
npm run db:migrate           # applique drizzle/*.sql
npm run dev
```

Sans `RESEND_API_KEY`, les e-mails sont écrits dans les logs. `STORAGE_DRIVER=local` stocke les
certificats dans `.uploads/` (développement uniquement). Sans clés Stripe, la page Abonnement
indique que le paiement n'est pas configuré.

### Tests

```bash
npm test                     # unitaires + intégration (PostgreSQL requis)
TEST_DATABASE_URL=postgres://… npm run test:integration
```

Les tests d'intégration (base `registre_test` par défaut) couvrent l'isolation multi-tenant
(DAL et Route Handlers : jeton A + ID de B → 404), la limite du plan gratuit (y compris en
créations concurrentes), le recalcul d'échéance, le moteur d'alertes (regroupement, destinataires,
reprises, idempotence, rattrapage) et la synchronisation Stripe.

## Architecture

```
src/
  auth.ts                  Auth.js (Credentials, JWT contenant uniquement l'id utilisateur)
  proxy.ts                 redirection optimiste vers /login (ex-middleware)
  db/schema.ts, enums.ts   schéma Drizzle (§2 du cahier des charges + ajouts ci-dessous)
  lib/                     logique pure : dates, calibration, alertes, plan, permissions, validation,
                           stockage S3, e-mail, QR, PDF d'étiquettes
  server/                  accès aux données, TOUJOURS filtré par ctx.orgId
  app/actions/             Server Actions des formulaires
  app/api/                 API REST, cron, webhook Stripe, certificats, étiquettes PDF
  app/(app)/               écrans authentifiés (inventaire, fiche, interventions, étiquettes, équipe, abonnement)
  app/scan/[token]/        page publique du QR code
```

### Isolation des données
- La session ne contient que l'id utilisateur ; `org_id` et le rôle sont relus en base à chaque requête
  (`src/lib/session.ts`).
- Toutes les fonctions de `src/server/` reçoivent le contexte de tenant et ajoutent
  `org_id = ctx.orgId` à chaque requête (jointure sur `equipments` pour les interventions).
- Une ressource d'une autre organisation — ou un identifiant malformé — lève `NotFoundError` → **404**,
  réponse identique à celle d'un identifiant inexistant.

### Rôles
| Rôle | Droits |
| --- | --- |
| `viewer` | consultation |
| `technician` | + création/modification d'équipements, ajout d'interventions |
| `admin` | + suppression, gestion de l'équipe, abonnement |

### Règles métier
- **Échéance** : une intervention au résultat `conform` fixe `last_calibration_date = performed_at`
  et `next_calibration_date = performed_at + calibration_frequency_months` (fin de mois gérée :
  31/01 + 1 mois = 28/02). Une intervention antérieure au dernier étalonnage ne fait pas reculer
  l'échéance. Les résultats `non_conform` et `adjusted` sont historisés sans modifier l'échéance.
- **Plan gratuit** : la création est refusée au-delà de 15 équipements (verrou `FOR UPDATE` sur
  l'organisation pour éviter tout contournement par requêtes simultanées) ; l'interface ouvre alors
  la modale d'upgrade Stripe Checkout.
- **QR code** : `https://<APP_URL>/scan/{qr_code_token}`. Étiquettes 50 × 30 mm (code, nom, échéance,
  QR vectoriel) : impression navigateur ou PDF (`/api/labels?ids=…&format=single|a4`), une étiquette
  par page ou planche A4 de 27.
- **Scan** : utilisateur connecté de la même organisation → fiche de l'équipement (bouton
  « Ajouter une intervention ») ; sinon vue publique limitée au statut (vert : conforme / rouge :
  échu), au code interne, à la prochaine échéance et au lien de connexion. Page rendue côté serveur
  sans police ni image externe (≈ 0,5 s mesuré en 4G émulée).

### Certificats
Clé d'objet `certificates/{org_id}/{uuid}.{ext}` (nom d'origine jamais utilisé), type vérifié par
signature binaire (PDF, JPEG, PNG, WebP, HEIC), 10 Mo maximum. Bucket privé : le fichier est servi
par `/api/certificates/{recordId}`, qui vérifie l'appartenance puis redirige vers une URL signée
valable 5 minutes. La colonne `certificate_file_url` contient la clé d'objet, pas une URL publique.

### Moteur d'alertes (`/api/cron/check-expirations`)
- Protégé par `Authorization: Bearer $CRON_SECRET` (envoyé automatiquement par Vercel Cron).
- Sélectionne les équipements à J-30, J-7, J-0 ou échus, les regroupe par organisation et envoie
  **un seul e-mail** aux `admin` et `technician` (badges orange à J-30, rouge à J-7 / J-0 / échu,
  lien vers chaque fiche).
- Chaque exécution est tracée dans `cron_runs` et dans les logs JSON (e-mails envoyés / en échec).
- Reprises : 3 nouvelles tentatives avec temporisation exponentielle pour les erreurs transitoires,
  clé d'idempotence Resend, table `alert_dispatches` (unique par organisation et par jour) :
  relancer le cron le même jour n'envoie pas de doublon et ne rejoue que les envois échoués.
- Rattrapage : si le cron n'a pas tourné un jour (ou si l'envoi d'une organisation a échoué), les
  seuils J-30 / J-7 franchis entre-temps sont signalés à l'exécution suivante (7 jours maximum).

### Stripe
1. Créer un produit « Pro » avec un prix récurrent 49 €/mois → `STRIPE_PRO_PRICE_ID`.
2. Webhook vers `https://<APP_URL>/api/stripe/webhook` pour `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   → `STRIPE_WEBHOOK_SECRET`.
3. Activer le Customer Portal (gestion de l'abonnement et des factures).

Chaque événement relit l'abonnement via l'API Stripe (robuste à l'ordre d'arrivée) ; `plan_tier`
vaut `pro` pour les statuts `active`, `trialing` et `past_due`.

## Écarts et ajouts par rapport au schéma §2
- `users.password_hash` : nécessaire à l'authentification e-mail / mot de passe.
- Index `org_id`, unicité `(org_id, internal_id)`.
- Tables `cron_runs` et `alert_dispatches` : journalisation et reprise des alertes.
- L'ajout de membres se fait par un administrateur avec un mot de passe provisoire (pas encore
  d'invitation par e-mail ni de réinitialisation de mot de passe).

## Déploiement (Vercel)
Renseigner les variables de `.env.example`, exécuter `npm run db:migrate` sur la base de production,
puis déployer : `vercel.json` déclare le cron quotidien.
