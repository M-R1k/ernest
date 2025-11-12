# Ernest - SOS Cyber

Application React + Vite pour l'assistant virtuel Ernest, spécialisé dans l'aide aux seniors et aux personnes en situation de fracture numérique.

## 🚀 Déploiement sur Vercel

Le projet est déjà configuré pour être déployé sur Vercel. Voici deux méthodes pour déployer :

### Méthode 1 : Via l'interface web de Vercel (Recommandé)

1. **Connectez-vous à Vercel**
   - Allez sur [vercel.com](https://vercel.com)
   - Créez un compte ou connectez-vous

2. **Importez votre projet**
   - Cliquez sur "Add New Project"
   - Connectez votre repository GitHub/GitLab/Bitbucket
   - Sélectionnez ce projet

3. **Configurez les variables d'environnement**
   - Dans les paramètres du projet, allez dans "Environment Variables"
   - Ajoutez les variables suivantes si nécessaire :
     - `VITE_ERNEST_WEBHOOK_URL` (optionnel) - URL du webhook Ernest
     - `VITE_N8N_WEBHOOK` (optionnel) - URL du webhook N8N

4. **Déployez**
   - Vercel détectera automatiquement la configuration dans `vercel.json`
   - Cliquez sur "Deploy"
   - Votre site sera disponible à l'URL fournie par Vercel

### Méthode 2 : Via la CLI Vercel (sans installation globale)

**Solution recommandée :** Utilisez `npx` pour éviter les problèmes de permissions.

1. **Déployez depuis votre terminal (sans installation)**
   ```bash
   npx vercel
   ```
   
   Suivez les instructions pour vous connecter et configurer le projet.

2. **Pour les déploiements de production**
   ```bash
   npx vercel --prod
   ```

3. **Configurez les variables d'environnement**
   ```bash
   npx vercel env add VITE_ERNEST_WEBHOOK_URL
   npx vercel env add VITE_N8N_WEBHOOK
   ```

**Alternative :** Si vous préférez installer la CLI globalement, vous pouvez utiliser :
```bash
sudo npm i -g vercel
```
Mais l'utilisation de `npx` est préférée car elle évite les problèmes de permissions.

### Configuration

Le fichier `vercel.json` configure automatiquement :
- ✅ Framework Vite détecté
- ✅ Build command : `npm run build`
- ✅ Output directory : `dist`
- ✅ Routing SPA avec rewrites vers `index.html`
- ✅ Cache optimisé pour les assets statiques

## 🛠️ Développement local

```bash
# Installation des dépendances
npm install

# Démarrage du serveur de développement
npm run dev

# Build de production
npm run build

# Prévisualisation du build
npm run preview
```

## 📝 Variables d'environnement

Créez un fichier `.env.local` pour les variables d'environnement locales :

```env
VITE_ERNEST_WEBHOOK_URL=https://votre-webhook.com/ernest/voice
VITE_N8N_WEBHOOK=https://clic-et-moi.app.n8n.cloud/webhook/ernest/voice
```

**Note** : Les variables doivent commencer par `VITE_` pour être accessibles dans le code client.
