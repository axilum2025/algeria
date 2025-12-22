# 🎤 Guide: Fonctionnalités Vocales de AI Text Pro

## 📋 Vue d'ensemble

L'agent AI Text Pro a été enrichi avec des fonctionnalités vocales avancées :
- **Speech-to-Text** (STT) : Reconnaissance vocale pour dicter du texte
- **Text-to-Speech** (TTS) : Synthèse vocale pour écouter les réponses

## 🎤 Speech-to-Text (Reconnaissance Vocale)

### Fonctionnement

1. **Cliquez sur le bouton micro** (🎤) dans la zone de saisie
2. **Autorisez l'accès au microphone** si demandé par le navigateur
3. **Parlez clairement** - le bouton devient rouge pendant l'enregistrement (⏹️)
4. **Cliquez à nouveau** pour arrêter l'enregistrement
5. **Le texte apparaît automatiquement** dans la zone de saisie

### Deux méthodes de reconnaissance

#### Méthode 1: Web Speech API (par défaut)
- Reconnaissance vocale native du navigateur
- Rapide et efficace
- Fonctionne hors ligne (selon le navigateur)
- Langues supportées: Français (fr-FR) par défaut

#### Méthode 2: Transcription via API (fallback)
- Utilise MediaRecorder + API externe (Whisper)
- Activé si Web Speech API n'est pas disponible
- Requiert une connexion internet
- Plus précis pour les textes longs

### Compatibilité

- ✅ **Chrome/Edge**: Web Speech API natif
- ✅ **Safari**: Web Speech API natif (iOS 14.5+)
- ⚠️ **Firefox**: Utilise le fallback MediaRecorder
- ⚠️ **Opera**: Utilise le fallback MediaRecorder

### Permissions requises

```javascript
// Permission automatiquement demandée
navigator.mediaDevices.getUserMedia({ audio: true })
```

## 🔊 Text-to-Speech (Synthèse Vocale)

### Fonctionnement

1. **Chaque réponse de l'assistant** affiche un bouton haut-parleur (🔊)
2. **Cliquez sur le bouton** pour écouter le message
3. **Le bouton pulse** pendant la lecture
4. **Cliquez à nouveau** pour arrêter la lecture

### Paramètres de la voix

```javascript
currentUtterance.lang = 'fr-FR';    // Langue française
currentUtterance.rate = 1.0;        // Vitesse normale
currentUtterance.pitch = 1.0;       // Tonalité normale
currentUtterance.volume = 1.0;      // Volume maximal
```

### Personnalisation

Pour modifier les paramètres de la voix, éditez la fonction `speakTextProMessage` :

```javascript
window.speakTextProMessage = function(text, button) {
    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.lang = 'fr-FR';
    currentUtterance.rate = 1.2;     // Plus rapide
    currentUtterance.pitch = 1.1;    // Voix plus aiguë
    currentUtterance.volume = 0.8;   // Volume réduit
    // ...
}
```

### Compatibilité

- ✅ **Tous les navigateurs modernes** supportent Speech Synthesis API
- ✅ **Voix natives** disponibles sur tous les systèmes
- ✅ **Fonctionne hors ligne**

## 🎨 Interface Utilisateur

### Nouveau design

```
┌─────────────────────────────────────┐
│  [Textarea pour le texte]          │
│                                     │
└─────────────────────────────────────┘
┌────┐ ┌────┐
│ 🎤 │ │ 📤 │  ← Boutons verticaux
└────┘ └────┘
```

### États visuels

#### Bouton Microphone
- **Normal**: 🎤 violet (`rgba(139, 92, 246, 0.2)`)
- **Enregistrement**: ⏹️ rouge avec animation pulse
- **Hover**: Effet de surélévation

#### Bouton Haut-parleur
- **Normal**: 🔊 vert-violet (`#a78bfa`)
- **Lecture en cours**: Animation pulse continue
- **Hover**: Agrandissement (scale 1.1)

## 🔧 Code ajouté

### Variables globales

```javascript
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let recognition = null;
let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;
```

### Fonctions principales

1. **`toggleTextProRecording()`** : Gère le démarrage/arrêt de l'enregistrement
2. **`stopRecording()`** : Arrête proprement l'enregistrement
3. **`transcribeAudio(audioBlob)`** : Transcrit l'audio via API externe
4. **`speakTextProMessage(text, button)`** : Lit le texte à voix haute

## 📊 Flux de données

### Speech-to-Text

```
Utilisateur clique sur 🎤
    ↓
Demande permission microphone
    ↓
Démarre Web Speech API ou MediaRecorder
    ↓
Enregistre l'audio
    ↓
Transcrit en texte
    ↓
Affiche dans textarea
```

### Text-to-Speech

```
Utilisateur clique sur 🔊
    ↓
Arrête toute lecture en cours
    ↓
Crée SpeechSynthesisUtterance
    ↓
Lance speechSynthesis.speak()
    ↓
Anime le bouton
    ↓
Fin de lecture
```

## 🚀 Améliorations futures possibles

### Speech-to-Text
- [ ] Sélection de la langue (FR, EN, AR, etc.)
- [ ] Reconnaissance continue avec pause automatique
- [ ] Correction automatique des erreurs
- [ ] Support de commandes vocales ("Envoyer", "Effacer", etc.)

### Text-to-Speech
- [ ] Choix de la voix (masculine/féminine)
- [ ] Contrôle de la vitesse (curseur)
- [ ] Pause/Reprise de la lecture
- [ ] Surlignage du texte pendant la lecture
- [ ] Export audio (MP3)

## 🐛 Dépannage

### Le microphone ne fonctionne pas

1. **Vérifiez les permissions du navigateur**
   - Chrome: `chrome://settings/content/microphone`
   - Firefox: `about:preferences#privacy`

2. **Vérifiez la console** pour les erreurs
   ```javascript
   console.log('🎤 Enregistrement vocal démarré');
   ```

3. **Testez avec un autre navigateur**

### La synthèse vocale ne fonctionne pas

1. **Vérifiez que le son n'est pas coupé**
2. **Vérifiez les voix disponibles**
   ```javascript
   speechSynthesis.getVoices()
   ```

3. **Rechargez la page** (parfois nécessaire)

## 📝 Notes techniques

### API de transcription externe

Si vous utilisez le fallback MediaRecorder, créez l'endpoint `/api/transcribe` :

```javascript
// api/transcribe/index.js
module.exports = async function (context, req) {
    const { audio } = req.body;
    
    // Appeler Whisper API ou autre service
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'multipart/form-data'
        },
        body: audio
    });
    
    const data = await response.json();
    
    context.res = {
        status: 200,
        body: { text: data.text }
    };
};
```

### Sécurité

- Les enregistrements audio ne sont **jamais sauvegardés**
- La transcription se fait en temps réel
- Aucune donnée audio n'est stockée sur le serveur

## ✅ Checklist de test

- [ ] Le bouton micro s'affiche correctement
- [ ] L'enregistrement démarre au clic
- [ ] Le bouton devient rouge pendant l'enregistrement
- [ ] La transcription apparaît dans le textarea
- [ ] Le bouton haut-parleur s'affiche sur les réponses
- [ ] La lecture audio démarre au clic
- [ ] L'animation pulse fonctionne
- [ ] La lecture s'arrête proprement

## 🎉 Résultat

Votre agent AI Text Pro dispose maintenant de fonctionnalités vocales complètes, offrant une expérience utilisateur moderne et accessible !
