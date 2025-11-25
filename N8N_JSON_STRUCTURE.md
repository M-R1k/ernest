# Structure JSON pour N8N - Ernest SOS Cyber

## 📤 Requête envoyée à N8N (POST)

### Structure complète

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "chatInput": "J'ai reçu un email suspect",
  "meta": {
    "intent": "CHECK_SCAM",
    "subIntent": "email_suspect",
    "step": 1
  },
  "timestamp": 1704067200000,
  "locale": "fr-FR",
  "userAgent": "Mozilla/5.0...",
  "conversationHistory": [
    {
      "role": "user",
      "text": "Bonjour",
      "timestamp": 1704067100000
    },
    {
      "role": "assistant",
      "text": "Bonjour, comment puis-je vous aider ?",
      "timestamp": 1704067110000
    }
  ]
}
```

### Champs disponibles dans N8N

- `$json.sessionId` - Identifiant unique de la session
- `$json.chatInput` - Texte saisi par l'utilisateur
- `$json.meta.intent` - Intent détecté (HOME, CHECK_SCAM, SOS, etc.)
- `$json.meta.subIntent` - Sous-intent (email_suspect, password_create, etc.)
- `$json.meta.step` - Étape dans le flux (1, 2, 3...)
- `$json.timestamp` - Timestamp Unix de la requête
- `$json.locale` - Langue du navigateur (fr-FR, en-US, etc.)
- `$json.userAgent` - User agent du navigateur
- `$json.conversationHistory` - Tableau des 5 derniers messages (optionnel)

## 📥 Réponse attendue de N8N

### Structure de base (minimum requis)

```json
{
  "answer": "Voici ma réponse",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Structure complète (recommandée)

```json
{
  "transcript": "Message vocal transcrit (si applicable)",
  "answer": [
    "Premier message de réponse",
    "Deuxième message de réponse"
  ],
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "suggestions": [
    "Suggestion 1",
    "Suggestion 2",
    "Suggestion 3"
  ],
  "metadata": {
    "intent": "CHECK_SCAM",
    "subIntent": "email_suspect",
    "confidence": 0.95,
    "processingTime": 250
  }
}
```

### Structure avec erreur

```json
{
  "answer": "Une erreur s'est produite",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "error": {
    "code": "PROCESSING_ERROR",
    "message": "Détails de l'erreur"
  }
}
```

## 📝 Exemples pour N8N

### Exemple 1 : Réponse simple

```json
{
  "transcript": "{{ $('Set chatInput & sessionId').item.json.chatInput }}",
  "answer": "{{ $json.message1 }}",
  "sessionId": "{{ $('Set chatInput & sessionId').item.json.sessionId }}"
}
```

### Exemple 2 : Réponse multiple (recommandé)

```json
{
  "transcript": "{{ $('Set chatInput & sessionId').item.json.chatInput }}",
  "answer": [
    "{{ $json.message1 }}",
    "{{ $json.message2 }}"
  ],
  "sessionId": "{{ $('Set chatInput & sessionId').item.json.sessionId }}",
  "suggestions": [
    "{{ $json.suggestion1 }}",
    "{{ $json.suggestion2 }}"
  ],
  "metadata": {
    "intent": "{{ $('Set chatInput & sessionId').item.json.meta.intent }}",
    "subIntent": "{{ $('Set chatInput & sessionId').item.json.meta.subIntent }}",
    "confidence": 0.9,
    "processingTime": 200
  }
}
```

### Exemple 3 : Utilisation du contexte conversationnel

Dans N8N, vous pouvez accéder à l'historique :
- `{{ $json.conversationHistory[0].text }}` - Dernier message utilisateur
- `{{ $json.conversationHistory[1].text }}` - Avant-dernier message
- `{{ $json.conversationHistory.length }}` - Nombre de messages dans l'historique

## 🎯 Bonnes pratiques

1. **Toujours renvoyer `sessionId`** - Important pour la continuité de la conversation
2. **Utiliser des tableaux pour `answer`** - Permet d'afficher plusieurs messages séparément
3. **Inclure `transcript` si disponible** - Utile pour le mode vocal
4. **Ajouter des suggestions** - Améliore l'expérience utilisateur
5. **Utiliser les métadonnées** - Facilite le débogage et l'analyse

## ⚠️ Notes importantes

- `answer` peut être une **string** ou un **tableau de strings**
- Si `answer` est un tableau, chaque élément sera affiché comme un message séparé avec un délai de 300ms
- `sessionId` doit être renvoyé pour maintenir la session
- Les champs `suggestions` et `metadata` sont optionnels mais recommandés

