# Planning Couple — PWA

Application planning partagé pour couple. Stack : React/Vite + Supabase + Vercel.

## ✨ Fonctionnalités

- 🔐 **Authentification** email/mot de passe via Supabase Auth
- 📅 **Calendrier** avec 4 vues (Mois / Semaine / Jour / Liste), épuré
- 🤝 **Partage sélectif** — événement par événement, note par note
- 📝 **Notes** texte ou liste à cocher (todo / liste de courses)
- 🎨 **Couleurs** personnalisables sur événements et notes
- ⏰ **Rappels** configurables (5 min à 1 semaine avant)
- 🔔 **Notifications push** quand le partenaire ajoute/modifie quelque chose
- 📥 **Import .ics** (Google/Samsung/Apple Calendar)
- 🌍 **Fuseau horaire** Asia/Qatar par défaut, configurable
- ⚙️ **Paramètres** : début de semaine (dim/lun), vue par défaut, couleurs par défaut
- 👨‍💼 **Panneau admin** : reset MDP, gestion des utilisateurs, suppression de données
- 📱 **PWA installable** sur Android (bouton "Installer" intégré)
- 🔄 **Synchronisation temps réel** entre les 2 téléphones (Supabase Realtime)

## 🚀 Déploiement — Étape par étape

### 1️⃣ Créer le projet Supabase

1. Va sur https://supabase.com → New project
2. Note bien le **mot de passe DB** quelque part
3. Une fois créé, va dans **SQL Editor** → nouveau query
4. Copie/colle tout le contenu de `supabase/schema.sql`
5. Clique **Run** — tu dois voir "Success"
6. Va dans **Authentication → Settings → Email** :
   - Décoche "Confirm email" si tu veux pouvoir te connecter immédiatement sans valider (plus rapide pour le test)
   - Sinon laisse coché et confirme via email
7. Va dans **Settings → API** et note :
   - `Project URL` (ex: `https://xxxxx.supabase.co`)
   - `anon public` key

### 2️⃣ Pousser sur GitHub

1. Crée un nouveau repo GitHub (privé recommandé)
2. Upload tous les fichiers via l'interface web GitHub (ton workflow habituel) :
   - Tout sauf `node_modules/` et `dist/`

### 3️⃣ Déployer sur Vercel

1. https://vercel.com → New Project
2. Importe ton repo GitHub
3. Framework : **Vite** (auto-détecté)
4. **Environment Variables** — ajoute :
   - `VITE_SUPABASE_URL` = ton Project URL
   - `VITE_SUPABASE_ANON_KEY` = ton anon key
5. Deploy

### 4️⃣ Premiers comptes

1. Va sur ton URL Vercel
2. Crée TON compte (Inscription)
3. Crée le compte de ta femme (sur son téléphone, ou depuis le même appareil après déconnexion)
4. **IMPORTANT** : pour devenir admin, retourne dans Supabase → SQL Editor :
   ```sql
   UPDATE profiles SET is_admin = TRUE WHERE email = 'ton-email@example.com';
   ```
5. Connecte-vous chacun, puis va dans **Paramètres → Lier le partenaire** et entre son email
6. Le lien est bidirectionnel — fait par l'un, ça marche pour les deux

### 5️⃣ Installer la PWA sur Android

1. Ouvre l'URL Vercel dans Chrome
2. Une banderole "Installer l'app" apparaît dans **Paramètres** au sein de l'app, ou Chrome propose directement
3. Tape sur "Installer" → l'icône apparaît sur ton écran d'accueil
4. À partir de là, ça se comporte comme une vraie app

### 6️⃣ Activer les notifications

1. Première connexion : le navigateur demande l'autorisation
2. Si raté, va dans **Paramètres → Notifications** et tape sur la cloche
3. Les notifs marchent **app fermée** sur Android Chrome (Service Worker + Web Push)

### 7️⃣ Importer ton fichier .ics

1. Calendrier → bouton import en bas à gauche
2. Sélectionne ton fichier `.ics` exporté de Samsung/Google
3. Choisis la couleur par défaut et si tu veux que tout soit partagé
4. Confirme — l'import se fait par lots de 100, avec une barre de progression

## 📁 Structure du projet

```
planning-app/
├── public/              # Icônes PWA + favicon
├── src/
│   ├── components/      # Modals + composants partagés
│   ├── hooks/           # useAuth
│   ├── lib/             # supabase client, parseur ICS, notifs, utils dates
│   ├── pages/           # Login, Signup, Calendar, Notes, Settings, Admin
│   ├── styles/          # CSS global
│   ├── App.jsx          # Routing + nav principale
│   └── main.jsx
├── supabase/
│   └── schema.sql       # ⚠️ À exécuter dans Supabase SQL Editor
├── index.html
├── package.json
├── vite.config.js       # Inclut config PWA
└── README.md
```

## 🔧 Customisation rapide

- **Couleurs disponibles** : `src/lib/dateUtils.js` (constantes `COLORS` et `NOTE_COLORS`)
- **Options de rappel** : `src/lib/dateUtils.js` (`REMINDER_OPTIONS`)
- **Plage de dates** : pas de limite — le calendrier accepte n'importe quelle année. Date-fns gère bien au-delà de 2030.
- **Fuseau horaire** : modifiable via Paramètres, par défaut Asia/Qatar

## 🛠 Dev local (optionnel)

```bash
npm install
# Crée un fichier .env.local :
# VITE_SUPABASE_URL=https://xxxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJxxx...
npm run dev
```

## 🔒 Sécurité

- **Row Level Security (RLS)** activée sur toutes les tables
- Les événements et notes **non partagés** sont strictement privés (le partenaire ne les voit jamais, même via l'API)
- Les événements/notes **partagés** sont visibles uniquement par le partenaire lié
- Le partenaire peut **cocher/décocher** les items d'une liste todo partagée (utile pour les courses) mais ne peut ni modifier ni supprimer
- L'admin peut reset les mots de passe (Supabase envoie un email) mais ne voit PAS les contenus des autres utilisateurs

## ⚠️ Limites connues

- Les notifications push iOS nécessitent iOS 16.4+ et la PWA installée (ce n'est pas votre cas, vous êtes sur Android, donc OK)
- Les rappels d'événements (réveils avant l'événement) utilisent `setTimeout` côté client : ils marchent tant que la PWA est ouverte/active. Pour des rappels 100% fiables même app fermée pendant plusieurs jours, il faudrait ajouter un cron Supabase Edge Function (pas inclus pour rester simple — on peut l'ajouter en V2)

## 📞 Support

Si quelque chose ne marche pas :
1. Vérifie que les variables d'env Vercel sont bien définies (et redeploy après)
2. Vérifie que le schéma SQL a bien été exécuté (Tables : profiles, events, notes, note_items, notifications, push_subscriptions doivent exister)
3. Console navigateur (F12) → onglet Console pour voir les erreurs
