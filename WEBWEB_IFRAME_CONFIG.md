# Configuration de l'iframe dans WeWeb pour le mode voix

## Problème
Sur mobile (et parfois desktop), l'accès au microphone est bloqué dans les iframes pour des raisons de sécurité. Il faut configurer les permissions de l'iframe correctement.

## Solution : Configuration de l'iframe dans WeWeb

### 1. Ajouter l'attribut `allow` à l'iframe

Dans WeWeb, lorsque vous configurez votre iframe, vous devez ajouter l'attribut `allow` avec les permissions suivantes :

```html
<iframe 
  src="VOTRE_URL" 
  allow="microphone; camera"
  allowfullscreen
  style="width: 100%; height: 100vh; border: none;"
></iframe>
```

### 2. Configuration dans l'éditeur WeWeb

#### Option A : Via le composant HTML personnalisé

1. Ajoutez un composant **HTML personnalisé** dans WeWeb
2. Dans le code HTML, ajoutez :

```html
<iframe 
  src="VOTRE_URL_ERNEST" 
  allow="microphone"
  allowfullscreen
  style="width: 100%; height: 100vh; border: none;"
  title="Ernest Widget"
></iframe>
```

#### Option B : Via les paramètres de l'iframe WeWeb

Si WeWeb a un composant iframe dédié :

1. **URL de l'iframe** : Votre URL de l'application Ernest
2. **Attributs personnalisés** : Ajoutez `allow="microphone"`
3. **Permissions** : Activez "Microphone" dans les permissions

### 3. Configuration HTTPS

⚠️ **IMPORTANT** : Les permissions du microphone ne fonctionnent **QUE sur HTTPS** (ou localhost pour le développement).

- Assurez-vous que votre application Ernest est servie en HTTPS
- Assurez-vous que votre site WeWeb est aussi en HTTPS

### 4. Permissions Policy (Feature Policy)

Si vous avez accès aux en-têtes HTTP de votre application Ernest, vous pouvez aussi configurer la Permissions Policy :

```
Permissions-Policy: microphone=(self "https://votre-domaine-weweb.com")
```

### 5. Test sur mobile

Pour tester sur mobile :

1. Ouvrez votre site WeWeb sur un appareil mobile
2. Cliquez sur le bouton du mode voix
3. Le navigateur devrait demander l'autorisation d'accès au microphone
4. Acceptez l'autorisation
5. Le mode voix devrait fonctionner

### 6. Dépannage

Si ça ne fonctionne toujours pas :

1. **Vérifiez la console du navigateur** pour voir les erreurs
2. **Vérifiez les paramètres du navigateur** :
   - Chrome/Edge : `chrome://settings/content/microphone`
   - Firefox : `about:preferences#privacy`
   - Safari : Réglages > Safari > Microphone
3. **Vérifiez que l'iframe a bien l'attribut `allow="microphone"`** dans le code source
4. **Testez d'abord sur desktop** pour isoler le problème mobile

### 7. Code de vérification

Le composant détecte maintenant automatiquement si vous êtes dans une iframe et affiche un message d'erreur plus clair si les permissions ne sont pas configurées.

## Exemple de configuration complète

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ernest Widget</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    iframe {
      width: 100%;
      height: 100vh;
      border: none;
      display: block;
    }
  </style>
</head>
<body>
  <iframe 
    src="https://votre-domaine.com/ernest-widget" 
    allow="microphone"
    allowfullscreen
    title="Ernest Widget"
  ></iframe>
</body>
</html>
```

## Notes importantes

- L'attribut `allow="microphone"` est **obligatoire** pour que le microphone fonctionne dans une iframe
- Sur mobile, les restrictions sont encore plus strictes
- Certains navigateurs peuvent nécessiter une interaction utilisateur (clic) avant d'autoriser l'accès au microphone
- Le mode voix ne fonctionnera pas si l'utilisateur a bloqué les permissions au niveau du navigateur

