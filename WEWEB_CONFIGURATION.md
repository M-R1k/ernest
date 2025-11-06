# Configuration WeWeb pour le Widget Ernest

## 📐 Dimensions recommandées

### Mobile (par défaut)
- **Largeur** : `100%` (ou largeur fixe `320px` minimum)
- **Hauteur** : `100vh` (hauteur complète de l'écran) ou hauteur fixe `600px` minimum

### Tablette (à partir de 768px)
- **Largeur** : `100%` (ou largeur fixe `768px` minimum)
- **Hauteur** : `700px` minimum (recommandé : `750px` à `800px`)

### Desktop (à partir de 1024px)
- **Largeur** : `100%` ou largeur max selon votre design
- **Hauteur** : `100vh` (hauteur complète de l'écran) ou hauteur fixe `800px` minimum

---

## 🔧 Configuration dans WeWeb

### Étape 1 : Ajouter l'élément Iframe

1. Dans votre page WeWeb, ajoutez un **élément Iframe** depuis la palette de composants
2. Positionnez-le où vous souhaitez afficher le widget Ernest

### Étape 2 : Paramètres de l'Iframe

#### URL de l'iframe
```
https://[votre-domaine]/[chemin-vers-le-widget]
```

**Exemple :**
- Si votre widget est déployé sur `https://widget.example.com` → `https://widget.example.com`
- Si en local pour test → `http://localhost:5173` (port Vite par défaut)

#### Attributs de l'iframe
```
frameborder: 0
scrolling: no
allow: microphone; camera (pour le mode voix)
```

### Étape 3 : Styles et Responsive

#### Style par défaut (Mobile First - style chatbot)
```css
width: 100%
height: 100vh  /* Hauteur complète de l'écran */
min-width: 320px
min-height: 600px
```

#### Style pour Tablette (breakpoint md: 768px)
Dans WeWeb, configurez un **breakpoint responsive** à `768px` :

```css
width: 100%
height: 750px
min-width: 768px
min-height: 700px
```

#### Style pour Desktop (breakpoint lg: 1024px)
Dans WeWeb, configurez un **breakpoint responsive** à `1024px` :

```css
width: 100%
height: 100vh  /* Hauteur complète de l'écran */
min-width: 1024px
min-height: 800px
```

#### Configuration WeWeb spécifique

1. **Dans le panneau de propriétés de l'iframe :**
   - **Largeur** : `100%` (ou utilisez les contraintes WeWeb)
   - **Hauteur** : `650px` (mobile) / `750px` (tablette)
   - **Alignement horizontal** : `Centré` (recommandé)
   - **Marges** : `0` ou selon votre design

2. **Responsive Design :**
   - WeWeb permet de définir des breakpoints
   - Configurez un breakpoint à **768px** (md de Tailwind)
   - Ajustez la hauteur à `750px` pour ce breakpoint

### Étape 4 : Options avancées (recommandé)

#### Permissions iframe
Activez les permissions suivantes pour permettre le mode voix :
- ✅ **Microphone** (pour la dictée et le mode voix)
- ✅ **Camera** (si nécessaire pour l'avenir)

Dans WeWeb, vous pouvez ajouter ces attributs dans les **paramètres avancés** de l'iframe.

#### Code HTML personnalisé (si disponible)
Si WeWeb permet d'ajouter des attributs HTML personnalisés :

```html
<iframe
  src="[votre-url]"
  frameborder="0"
  scrolling="no"
  allow="microphone; camera"
  style="width: 100%; height: 650px; border: none;"
></iframe>
```

---

## 🎨 Intégration dans votre design

### Conteneur parent recommandé

```css
.widget-container {
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding: 0;
  border-radius: 0; /* Le widget gère déjà ses bordures */
  overflow: hidden;
}
```

### Pour un design en carte (optionnel)

Si vous souhaitez mettre le widget dans une carte avec ombre :

```css
.widget-card {
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding: 0;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}
```

Dans ce cas, définissez la hauteur de la carte au lieu de l'iframe directement.

---

## 📱 Breakpoints responsive

Le widget utilise les breakpoints Tailwind suivants :

| Breakpoint | Largeur | Utilisation WeWeb |
|------------|---------|-------------------|
| **Mobile** | < 768px | Style par défaut |
| **Tablette (md:)** | ≥ 768px | Breakpoint WeWeb à 768px |

### Configuration WeWeb responsive

1. **Mode Mobile** (par défaut) :
   - Largeur : `100%`
   - Hauteur : `650px`

2. **Mode Tablette** (à partir de 768px) :
   - Créez un breakpoint à `768px` dans WeWeb
   - Largeur : `100%`
   - Hauteur : `750px`

---

## ✅ Checklist d'intégration

- [ ] Iframe ajouté à la page WeWeb
- [ ] URL du widget configurée
- [ ] Hauteur définie : `650px` (mobile) / `750px` (tablette)
- [ ] Largeur définie : `100%`
- [ ] `frameborder: 0` configuré
- [ ] `scrolling: no` configuré
- [ ] Permissions microphone activées
- [ ] Breakpoint responsive à 768px configuré
- [ ] Test sur mobile (largeur < 768px)
- [ ] Test sur tablette (largeur ≥ 768px)
- [ ] Mode voix testé (bouton micro et mode voix)

---

## 🔍 Dépannage

### Le widget ne s'affiche pas correctement
- Vérifiez que l'URL de l'iframe est correcte et accessible
- Vérifiez que la hauteur est définie (minimum 600px)
- Vérifiez la console du navigateur pour les erreurs

### Le widget déborde
- Assurez-vous que `overflow: hidden` est sur le conteneur parent
- Vérifiez que la hauteur de l'iframe est suffisante (650px minimum)

### Le mode voix ne fonctionne pas
- Vérifiez que les permissions microphone sont activées
- Testez dans un navigateur compatible (Chrome, Edge, Safari récents)
- Vérifiez que l'iframe a l'attribut `allow="microphone"`

### Responsive ne fonctionne pas
- Vérifiez que le breakpoint WeWeb est bien configuré à 768px
- Vérifiez que la hauteur est ajustée pour le breakpoint tablette
- Testez en redimensionnant la fenêtre du navigateur

---

## 📝 Notes importantes

1. **Hauteur flexible** : Le widget s'adapte à la hauteur de l'iframe. Si vous définissez `height: 100%`, assurez-vous que le conteneur parent a une hauteur définie.

2. **Largeur flexible** : Le widget s'adapte à 100% de la largeur de l'iframe, avec un maximum de contenu centré pour la lisibilité.

3. **Mode voix** : L'overlay du mode voix prend tout l'espace de l'iframe (`position: fixed` relatif à l'iframe).

4. **Performance** : Le widget est optimisé pour fonctionner dans un iframe sans impact significatif sur les performances.

---

## 🚀 Exemple de configuration complète

```html
<!-- Dans WeWeb, configurez l'iframe ainsi : -->
<iframe
  src="https://votre-domaine.com/ernest-widget"
  frameborder="0"
  scrolling="no"
  allow="microphone"
  style="width: 100%; height: 650px; border: none;"
  class="weweb-iframe-responsive"
></iframe>
```

**CSS responsive dans WeWeb :**
```css
/* Mobile (par défaut) */
.weweb-iframe-responsive {
  width: 100%;
  height: 650px;
  min-height: 600px;
}

/* Tablette (≥ 768px) */
@media (min-width: 768px) {
  .weweb-iframe-responsive {
    height: 750px;
    min-height: 700px;
  }
}
```

---

## 🔙 Navigation retour vers WeWeb

Le widget peut communiquer avec WeWeb pour rediriger vers une page spécifique (par exemple "SOS") lorsque l'utilisateur clique sur le bouton retour à l'écran d'accueil.

### Configuration dans WeWeb

Pour que le bouton retour fonctionne et redirige vers votre page "SOS", ajoutez ce code JavaScript dans votre page WeWeb (via un élément "Code HTML" ou dans les scripts de la page) :

```javascript
// Écouter les événements personnalisés du widget Ernest (si le widget n'est pas dans un iframe)
window.addEventListener('ernest:back', function(event) {
  console.log('Événement ernest:back reçu:', event.detail);
  if (event.detail && event.detail.target === 'SOS') {
    console.log('Redirection vers /SOS');
    // Rediriger vers la page SOS dans WeWeb
    window.location.href = '/SOS'; // Adaptez le chemin selon votre structure
  }
});

// Écouter aussi les messages postMessage (si le widget est dans un iframe)
window.addEventListener('message', function(event) {
  // Debug : Afficher tous les messages reçus
  console.log('Message reçu de l\'iframe:', event.data);
  
  // Vérifier que le message vient du widget Ernest
  if (event.data && event.data.type === 'ernest:back' && event.data.action === 'navigate') {
    console.log('Message Ernest détecté, redirection vers SOS...');
    
    // Rediriger vers la page SOS dans WeWeb
    if (event.data.target === 'SOS') {
      console.log('Redirection vers /SOS');
      window.location.href = '/SOS'; // Adaptez le chemin selon votre structure
    }
  }
});
```

### Configuration personnalisée

Si votre page SOS a un chemin différent, modifiez le code ainsi :

```javascript
window.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'ernest:back' && event.data.action === 'navigate') {
    if (event.data.target === 'SOS') {
      // Remplacez '/SOS' par le chemin réel de votre page dans WeWeb
      window.location.href = '/votre-chemin-vers-sos';
      // Ou utilisez window.location.pathname = '/votre-chemin-vers-sos';
    }
  }
});
```

### Comportement du bouton retour

- **Écran de chat/étapes** : Le bouton retour navigue dans les étapes de la conversation
- **Écran SOS** : Le bouton retour revient à l'écran d'accueil
- **Écran d'accueil** : Le bouton retour envoie un message à WeWeb pour rediriger vers la page "SOS"

### Alternative : Utiliser le router WeWeb

Si vous utilisez le router WeWeb pour la navigation, vous pouvez adapter le code ainsi :

```javascript
window.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'ernest:back' && event.data.action === 'navigate') {
    if (event.data.target === 'SOS') {
      // Utiliser le router WeWeb pour naviguer
      // Exemple avec Next.js (si WeWeb utilise Next.js) :
      // import { useRouter } from 'next/router';
      // const router = useRouter();
      // router.push('/SOS');
      
      // Ou utiliser la méthode de navigation WeWeb spécifique
      // Consultez la documentation WeWeb pour la méthode exacte
    }
  }
});
```

---

### 🔍 Dépannage : Le bouton retour ne fonctionne pas

Si le bouton retour ne fonctionne pas, suivez ces étapes :

#### 1. Vérifier que le code JavaScript est bien ajouté dans WeWeb

- Ouvrez votre page WeWeb dans l'éditeur
- Ajoutez un élément "Code HTML" ou "Script" 
- Collez le code JavaScript d'écoute des messages
- Sauvegardez et republiez si nécessaire

#### 2. Ouvrir la console du navigateur

1. Ouvrez votre page dans un navigateur
2. Appuyez sur `F12` ou `Cmd+Option+I` (Mac) pour ouvrir les outils développeur
3. Allez dans l'onglet "Console"
4. Cliquez sur le bouton retour dans le widget
5. Vous devriez voir dans la console :
   - `Envoi du message à WeWeb: {type: 'ernest:back', ...}`
   - `Message reçu de l'iframe: {type: 'ernest:back', ...}`

#### 3. Vérifier le chemin de la page SOS

Assurez-vous que le chemin `/SOS` correspond bien au chemin réel de votre page dans WeWeb. Si votre page s'appelle différemment, modifiez :

```javascript
window.location.href = '/votre-chemin-reel'; // Par exemple '/sos', '/page-sos', etc.
```

#### 4. Tester en local

Si le widget est hébergé sur un domaine différent, vous pourriez avoir des problèmes de sécurité (CORS). Dans ce cas, testez d'abord en local pour vérifier que la communication fonctionne.

#### 5. Vérifier que vous êtes dans un iframe

Le widget vérifie automatiquement s'il est dans un iframe. Si vous voyez le message `Pas dans un iframe` dans la console, cela signifie que le widget n'est pas dans un iframe et la communication avec WeWeb ne fonctionnera pas.

#### 6. Alternative : Utiliser un bouton WeWeb directement

Si la communication via `postMessage` ne fonctionne pas, vous pouvez ajouter un bouton directement dans WeWeb qui redirige vers la page SOS, et masquer le bouton retour du widget dans WeWeb.

---

Pour toute question ou problème, vérifiez la console du navigateur pour les erreurs JavaScript.

