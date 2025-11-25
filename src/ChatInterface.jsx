import { useState, useRef, useEffect } from 'react'
import { Sparkles } from 'lucide-react'

// Configuration de l'API N8N
const DEFAULT_N8N_WEBHOOK = 'https://clic-et-moi.app.n8n.cloud/webhook/soscyber2'
const N8N_WEBHOOK = import.meta.env.VITE_N8N_WEBHOOK || DEFAULT_N8N_WEBHOOK

// Message de bienvenue
const WELCOME_MESSAGE = 'Bonjour ! Je vais vous aider à vérifier si le message que vous avez reçu est fiable.\n\nCopiez votre message ici, ou téléchargez le pour que je l\'analyse pour vous.'

/**
 * Interface WYSIWYG de chatbot ultra-accessible dédiée aux seniors
 * et aux personnes en situation de fracture numérique
 * 
 * Fonctionnalités incluses :
 * - Barre d'outils unifiée avec tous les contrôles
 * - Mode texte simplifié et lecture vocale
 * - Accessibilité AA/AAA avec Tailwind CSS
 * - Design minimaliste et rassurant
 * - Interface inspirée des applications médicales
 * - Intégration avec l'API Ernest existante
 */
export default function ChatInterface() {
  // États pour la gestion des messages
  const [messages, setMessages] = useState([
    { 
      id: 'welcome', 
      from: 'bot', 
      text: WELCOME_MESSAGE,
      timestamp: new Date()
    }
  ])
  
  // États pour l'interface utilisateur
  const [currentMessage, setCurrentMessage] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState([])
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('Prêt')
  
  // États pour l'accessibilité
  const [fontSize, setFontSize] = useState('large') // small, medium, large, xlarge
  const [highContrast, setHighContrast] = useState(false)
  const [simplifiedMode, setSimplifiedMode] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  
  // États pour le formatage WYSIWYG
  const [textFormat, setTextFormat] = useState({
    bold: false,
    italic: false,
    underline: false,
    fontSize: 'medium'
  })
  
  // Références
  const messageInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)
  const speechSynthesis = useRef(null)
  const mrRef = useRef(null)
  const chunksRef = useRef([])

  const hasTextInput = currentMessage.trim().length > 0
  const hasAttachments = attachedFiles.length > 0
  const isVoiceActive = isRecording
  const interactionLocked = sending || isThinking
  // Le bouton micro est toujours visible (sauf si interaction verrouillée), pour permettre de passer au mode vocal même avec du texte
  const showVoiceButton = !interactionLocked || isVoiceActive
  const showAttachButton = !isVoiceActive && !interactionLocked && !hasTextInput
  const showVoicePlaybackButton = voiceMode && !isVoiceActive && !hasAttachments && !interactionLocked && !hasTextInput
  const showTextComposer = !isVoiceActive && !hasAttachments
  const showSendTextButton = !isVoiceActive && !hasAttachments
  
  // Session ID pour l'API
  const [sessionId] = useState(() => {
    const k = "ernest_session";
    let v = localStorage.getItem(k);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(k, v);
    }
    return v;
  });
  
  // Configuration des tailles de police pour l'accessibilité
  const fontSizeClasses = {
    small: 'text-sm',
    medium: 'text-base', 
    large: 'text-lg',
    xlarge: 'text-xl'
  }
  
  // Configuration des couleurs pour le mode haut contraste
  const colorScheme = highContrast ? {
    primary: 'bg-blue-900 text-white',
    secondary: 'bg-yellow-400 text-black',
    background: 'bg-white text-black',
    border: 'border-2 border-black'
  } : {
    primary: 'bg-blue-600 text-white',
    secondary: 'bg-gray-100 text-gray-900',
    background: 'bg-white text-gray-900',
    border: 'border border-gray-300'
  }

  // Auto-scroll vers le bas des messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialisation de la synthèse vocale
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis.current = window.speechSynthesis
    }
  }, [])

  /**
   * Fonction pour envoyer des données à l'API N8N
   */
  async function postToN8n(fd) {
    if (!N8N_WEBHOOK) {
      console.warn("VITE_N8N_WEBHOOK manquant dans .env");
      return { answer: "Webhook non configuré." };
    }
    const res = await fetch(N8N_WEBHOOK, { method: "POST", body: fd });
    const raw = await res.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { answer: raw };
    }
    if (!res.ok) {
      console.error("Webhook error", res.status, raw);
      throw new Error(`HTTP ${res.status}`);
    }
    return data;
  }

  /**
   * Fonction helper pour ajouter des messages (gère les tableaux)
   */
  function addBotMessages(answer) {
    // Si answer est une string qui ressemble à un tableau JSON, la parser
    if (typeof answer === 'string' && answer.trim().startsWith('[') && answer.trim().endsWith(']')) {
      try {
        const parsed = JSON.parse(answer);
        if (Array.isArray(parsed)) {
          answer = parsed;
        }
      } catch (e) {
        console.warn("Impossible de parser answer comme JSON:", e);
      }
    }
    if (Array.isArray(answer)) {
      answer.forEach((msg, index) => {
        const trimmedMsg = String(msg).trim();
        if (trimmedMsg) {
          setTimeout(() => {
            const botResponse = {
              id: (Date.now() + index).toString(),
              from: 'bot',
              text: trimmedMsg,
              timestamp: new Date()
            };
            setMessages(prev => [...prev, botResponse]);
            
            // Lecture vocale automatique si activée
            if (voiceMode) {
              speakText(trimmedMsg);
            }
          }, index * 2000); // Délai de 2 secondes entre chaque message
        }
      });
    } else {
      const answerText = String(answer);
      if (answerText) {
        const botResponse = {
          id: (Date.now() + 1).toString(),
          from: 'bot',
          text: answerText,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botResponse]);
        
        // Lecture vocale automatique si activée
        if (voiceMode) {
          speakText(answerText);
        }
      }
    }
  }

  /**
   * Fonction pour sélectionner le type MIME audio
   */
  function pickMime() {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ]
    for (const t of candidates) {
      if (window.MediaRecorder?.isTypeSupported?.(t)) return t
    }
    return 'audio/webm'
  }

  /**
   * Gestion de l'envoi de message
   */
  const handleSendMessage = async () => {
    if (!currentMessage.trim() || isThinking) return

    const userMessage = {
      id: Date.now().toString(),
      from: 'user',
      text: currentMessage,
      timestamp: new Date(),
      format: { ...textFormat }
    }

    setMessages(prev => [...prev, userMessage])
    setCurrentMessage('')
    setIsThinking(true)
    setSending(true)
    setStatus('Envoi...')

    try {
      const fd = new FormData();
      fd.append("text", currentMessage);
      fd.append("sessionId", sessionId);
      
      const data = await postToN8n(fd);
      
      if (data?.answer) {
        addBotMessages(data.answer);
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi:', error)
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        from: 'bot',
        text: 'Désolé, une erreur s\'est produite. Veuillez réessayer.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsThinking(false)
      setSending(false)
      setStatus('Prêt')
    }
  }

  /**
   * Gestion de l'enregistrement vocal
   */
  const handleVoiceRecording = async () => {
    if (isRecording) {
      // Arrêter l'enregistrement
      setStatus('Arrêt de l\'enregistrement…')
      stopRec()
      setIsRecording(false)
      setStatus('Prêt')
    } else {
      // Démarrer l'enregistrement
      // Si du texte ou des fichiers sont présents, on les efface pour passer en mode vocal
      if (hasTextInput || hasAttachments) {
        setCurrentMessage('')
        setAttachedFiles([])
      }
      try {
        await startRec()
        setIsRecording(true)
      } catch (error) {
        console.error('Erreur d\'accès au microphone:', error)
        // Le message d'erreur est déjà défini dans startRec()
        setIsRecording(false)
      }
    }
  }

  /**
   * Démarrer l'enregistrement audio
   */
  async function startRec() {
    try {
      // Vérifier si l'API est disponible
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Votre navigateur ne supporte pas l\'enregistrement audio. Veuillez utiliser un navigateur moderne.');
      }

      // Demander l'accès au microphone avec gestion d'erreurs améliorée
      // Essayons d'abord avec les paramètres optimisés, puis sans si erreur
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
      } catch (e) {
        // Si les paramètres audio ne sont pas supportés, réessayons sans contraintes
        if (e.name === 'OverconstrainedError') {
          stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true
          });
        } else {
          throw e;
        }
      }
      
      const mimeType = pickMime();
      chunksRef.current = [];

      const mr = new MediaRecorder(stream, { mimeType });
      mrRef.current = mr;
      setIsRecording(true);
      setStatus("Enregistrement…");

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          chunksRef.current = [];
          await sendAudio(blob);
        } catch (e) {
          console.error(e);
          setStatus("Erreur d\'envoi");
        } finally {
          stream.getTracks().forEach((t) => t.stop());
          setIsRecording(false);
        }
      };

      mr.start(250);
    } catch (error) {
      // Gestion améliorée des erreurs de permission
      let errorMessage = 'Erreur d\'accès au microphone';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Permission refusée. Veuillez autoriser l\'accès au microphone dans les paramètres de votre navigateur.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'Aucun microphone trouvé. Vérifiez que votre appareil possède un microphone.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Le microphone est déjà utilisé par une autre application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Les paramètres audio demandés ne sont pas supportés.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setStatus(errorMessage);
      setIsRecording(false);
      throw error;
    }
  }

  /**
   * Arrêter l'enregistrement audio
   */
  function stopRec() {
    const mr = mrRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
  }

  /**
   * Envoyer l'audio à l'API
   */
  async function sendAudio(blob) {
    if (!blob || sending) return
    try {
      setSending(true)
      setStatus('Envoi audio…')

      setMessages(prev => [...prev, { 
        id: crypto.randomUUID(), 
        from: 'user', 
        text: ' Message vocal envoyé',
        timestamp: new Date()
      }])
      setIsThinking(true)

      const fd = new FormData()
      const filename =
        blob.type.includes('ogg') ? 'voice.ogg' :
        blob.type.includes('mp4') ? 'voice.m4a' :
        'voice.webm'
      fd.append('audio', blob, filename)
      fd.append('sessionId', sessionId)

      const data = await postToN8n(fd);
      if (data?.answer) {
        addBotMessages(data.answer);
      }
      setStatus("Prêt");
    } catch (e) {
      console.error(e);
      setStatus("Erreur d\'envoi");
      setIsThinking(false);
    } finally {
      setSending(false);
    }
  }

  /**
   * Gestion de l'ajout de fichiers
   */
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files)
    setAttachedFiles(prev => [...prev, ...files])
  }

  /**
   * Suppression d'un fichier attaché
   */
  const removeFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  /**
   * Envoyer les fichiers à l'API
   */
  const sendFiles = async () => {
    if (!attachedFiles.length || sending) return
    try {
      setSending(true)
      setStatus('Envoi des fichiers…')
      const form = new FormData()
      form.append('sessionId', sessionId)
      attachedFiles.forEach((f) => form.append('files', f, f.name))
      const res = await fetch(N8N_WEBHOOK, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) throw new Error('Upload échoué')
      const data = await res.json().catch(() => ({}))
      setMessages(prev => [
        ...prev,
        { 
          id: crypto.randomUUID(), 
          from: 'user', 
          text: `📎 ${attachedFiles.length} fichier(s) envoyé(s)`,
          timestamp: new Date()
        },
      ])
      setIsThinking(true)
      if (data?.answer) {
        addBotMessages(data.answer);
      }
      setAttachedFiles([])
      setStatus('Prêt')
    } catch (e) {
      console.error(e)
      setStatus('Erreur d\'envoi')
      setIsThinking(false)
    } finally {
      setSending(false)
    }
  }

  /**
   * Lecture vocale du texte
   */
  const speakText = (text) => {
    if (speechSynthesis.current) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'fr-FR'
      utterance.rate = 0.8 // Vitesse réduite pour les seniors
      utterance.pitch = 1.0
      
      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      
      speechSynthesis.current.speak(utterance)
    }
  }

  /**
   * Arrêt de la lecture vocale
   */
  const stopSpeaking = () => {
    if (speechSynthesis.current) {
      speechSynthesis.current.cancel()
      setIsSpeaking(false)
    }
  }

  /**
   * Gestion du formatage du texte
   */
  const toggleTextFormat = (format) => {
    setTextFormat(prev => ({
      ...prev,
      [format]: !prev[format]
    }))
  }

  /**
   * Application du formatage au texte sélectionné
   */
  const applyFormatting = () => {
    const input = messageInputRef.current
    if (!input) return

    const start = input.selectionStart
    const end = input.selectionEnd
    const selectedText = currentMessage.substring(start, end)
    
    if (!selectedText) return

    let formattedText = selectedText
    
    if (textFormat.bold) formattedText = `**${formattedText}**`
    if (textFormat.italic) formattedText = `*${formattedText}*`
    if (textFormat.underline) formattedText = `__${formattedText}__`

    const newText = currentMessage.substring(0, start) + formattedText + currentMessage.substring(end)
    setCurrentMessage(newText)
  }

  /**
   * Effacer la conversation
   */
  const handleClear = () => {
    const newId = crypto.randomUUID();
    localStorage.setItem("ernest_session", newId);
    setMessages([
      { 
        id: crypto.randomUUID(), 
        from: "bot", 
        text: WELCOME_MESSAGE,
        timestamp: new Date()
      },
    ]);
    setStatus("Prêt");
  };

  return (
    <div className={`min-h-screen ${colorScheme.background} transition-all duration-300`}>
      {/* En-tête avec contrôles d'accessibilité */}
      <header className={`${colorScheme.primary} p-4 shadow-lg`}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Titre principal */}
            <div className="flex items-center gap-3">
              <h1 className={`flex items-center gap-2 text-2xl lg:text-3xl font-bold ${fontSizeClasses[fontSize]}`}>
                <Sparkles className="w-7 h-7 lg:w-8 lg:h-8" />
                Assistant Ernest
              </h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                isThinking ? 'bg-yellow-100 text-yellow-800' : 
                isRecording ? 'bg-red-100 text-red-800' :
                sending ? 'bg-amber-100 text-amber-800' :
                'bg-green-100 text-green-800'
              }`}>
                {isThinking ? 'Réfléchit...' : isRecording ? 'Enregistre...' : sending ? 'Envoi...' : status}
              </span>
            </div>

            {/* Contrôles d'accessibilité */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Sélecteur de taille de police */}
              <div className="flex items-center gap-2">
                <label htmlFor="fontSize" className="text-sm font-medium">Taille:</label>
                <select
                  id="fontSize"
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                  className="px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
                >
                  <option value="small">Petit</option>
                  <option value="medium">Moyen</option>
                  <option value="large">Grand</option>
                  <option value="xlarge">Très grand</option>
                </select>
              </div>

              {/* Bouton mode simplifié */}
              <button
                onClick={() => setSimplifiedMode(!simplifiedMode)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  simplifiedMode ? 'bg-yellow-500 text-white' : 'bg-gray-200 !text-gray-900'
                }`}
                aria-pressed={simplifiedMode}
              >
                {simplifiedMode ? '✓' : ''} Mode Simple
              </button>

              {/* Bouton mode vocal */}
              <button
                onClick={() => setVoiceMode(!voiceMode)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  voiceMode ? 'bg-green-500 text-white' : 'bg-gray-200 !text-gray-900'
                }`}
                aria-pressed={voiceMode}
              >
                {voiceMode ? '🔊' : '🔇'} Voix
              </button>

              {/* Bouton haut contraste */}
              <button
                onClick={() => setHighContrast(!highContrast)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  highContrast ? 'bg-black text-white' : 'bg-gray-200 !text-gray-900'
                }`}
                aria-pressed={highContrast}
              >
                {highContrast ? '✓' : ''} Contraste
              </button>

              {/* Bouton effacer conversation */}
              <button
                onClick={handleClear}
                className="px-4 py-2 rounded-lg font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                🗑️ Effacer
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Zone des messages */}
      <main className="flex-1 p-4 max-w-6xl mx-auto">
        <div className={`space-y-4 ${fontSizeClasses[fontSize]}`}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.from === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                  message.from === 'user'
                    ? `${colorScheme.primary} text-white`
                    : `bg-gray-800 text-white ${colorScheme.border}`
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed flex items-start gap-2">
                  {message.from === 'bot' && (
                    <Sparkles className="w-5 h-5 mt-0.5 flex-shrink-0 text-white" />
                  )}
                  <span>{message.text}</span>
                </div>
                <div className={`text-xs opacity-70 mt-2 ${
                  message.from === 'bot' ? 'text-gray-300' : ''
                }`}>
                  {message.timestamp.toLocaleTimeString('fr-FR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
                
                {/* Bouton de lecture vocale pour les messages du bot */}
                {message.from === 'bot' && voiceMode && (
                  <button
                    onClick={() => speakText(message.text)}
                    className="mt-2 px-3 py-1 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    disabled={isSpeaking}
                  >
                    {isSpeaking ? '⏸️' : '🔊'} Lire
                  </button>
                )}
              </div>
            </div>
          ))}
          
          {/* Indicateur de réflexion */}
          {isThinking && (
            <div className="flex justify-start">
              <div className={`p-4 rounded-2xl bg-gray-800 text-white ${colorScheme.border}`}>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 flex-shrink-0 text-white" />
                  <span>Ernest réfléchit</span>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce opacity-70"></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce opacity-70" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce opacity-70" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Barre d'outils WYSIWYG unifiée - Version Senior Friendly */}
      <footer className={`${colorScheme.background} ${colorScheme.border} border-t-2 p-4 md:p-6 shadow-lg`}>
        <div className="max-w-6xl mx-auto">
          {/* Zone de texte principale - Plus grande et visible */}
          {showTextComposer && (
            <div className="relative mb-4">
              <label htmlFor="message-input" className="block text-base md:text-lg font-semibold mb-2 !text-gray-900">
                Votre message :
              </label>
              <textarea
                id="message-input"
                ref={messageInputRef}
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                placeholder="Tapez votre message ici..."
                className={`w-full p-5 md:p-6 rounded-xl border-3 resize-none focus:outline-none focus:ring-4 focus:ring-blue-400 ${fontSizeClasses[fontSize] || 'text-lg'} ${
                  highContrast ? 'border-black' : 'border-gray-400'
                } min-h-[120px] md:min-h-[140px]`}
                rows={4}
                disabled={isThinking || sending}
              />
              
              {/* Compteur de caractères - Plus visible */}
              <div className={`absolute bottom-3 right-3 text-sm md:text-base font-medium ${
                currentMessage.length > 450 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {currentMessage.length}/500
              </div>
            </div>
          )}

          {/* Fichiers attachés - Plus visible */}
          {attachedFiles.length > 0 && (
            <div className="mb-4 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base md:text-lg font-semibold !text-gray-900">📎 Fichiers joints :</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {attachedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 px-4 py-3 bg-blue-100 text-blue-900 rounded-lg border border-blue-300"
                  >
                    <span className={`text-base md:text-lg font-medium ${fontSizeClasses[fontSize]}`}>📎 {file.name}</span>
                    <button
                      onClick={() => removeFile(index)}
                      className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-lg font-bold min-w-[44px] min-h-[44px] flex items-center justify-center"
                      aria-label={`Supprimer ${file.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              {attachedFiles.length > 0 && (
                <button
                  onClick={sendFiles}
                  disabled={!attachedFiles.length || sending}
                  className={`mt-4 w-full px-6 py-4 rounded-xl font-bold transition-all text-lg md:text-xl min-h-[60px] ${
                    attachedFiles.length && !sending
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  ⬆️ Envoyer les fichiers ({attachedFiles.length})
                </button>
              )}
            </div>
          )}

          {/* Barre d'outils de formatage - Plus accessible */}
          {!simplifiedMode && showTextComposer && (
            <div className="mb-4 p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`text-base md:text-lg font-semibold !text-gray-900 ${fontSizeClasses[fontSize]}`}>Formatage :</span>
                
                {/* Boutons de formatage - Plus grands */}
                <button
                  onClick={() => toggleTextFormat('bold')}
                  className={`px-5 py-3 rounded-xl font-bold transition-colors min-w-[56px] min-h-[56px] text-lg ${
                    textFormat.bold ? 'bg-blue-600 text-white' : 'bg-gray-300 !text-gray-900'
                  }`}
                  aria-pressed={textFormat.bold}
                >
                  B
                </button>
                
                <button
                  onClick={() => toggleTextFormat('italic')}
                  className={`px-5 py-3 rounded-xl italic transition-colors min-w-[56px] min-h-[56px] text-lg ${
                    textFormat.italic ? 'bg-blue-600 text-white' : 'bg-gray-300 !text-gray-900'
                  }`}
                  aria-pressed={textFormat.italic}
                >
                  I
                </button>
                
                <button
                  onClick={() => toggleTextFormat('underline')}
                  className={`px-5 py-3 rounded-xl underline transition-colors min-w-[56px] min-h-[56px] text-lg ${
                    textFormat.underline ? 'bg-blue-600 text-white' : 'bg-gray-300 !text-gray-900'
                  }`}
                  aria-pressed={textFormat.underline}
                >
                  U
                </button>

                <button
                  onClick={applyFormatting}
                  className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold text-base md:text-lg min-h-[56px]"
                >
                  Appliquer le formatage
                </button>
              </div>
            </div>
          )}

          {/* Boutons principaux - Disposition senior-friendly */}
          <div className="space-y-4">
            {/* Première ligne : Boutons principaux (Parler / Envoyer) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bouton microphone - Plus grand et visible */}
              {showVoiceButton && (
                <button
                  onClick={handleVoiceRecording}
                  className={`w-full px-8 py-5 md:py-6 rounded-xl font-bold transition-all text-xl md:text-2xl min-h-[70px] shadow-lg ${
                    isRecording 
                      ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  } ${fontSizeClasses[fontSize] || 'text-xl'}`}
                  disabled={isThinking || sending}
                >
                  {isRecording ? '⏹️ Arrêter l\'enregistrement' : '🎤 Parler au lieu d\'écrire'}
                </button>
              )}

              {/* Bouton d'envoi principal - Plus grand */}
              {showSendTextButton && (
                <button
                  onClick={handleSendMessage}
                  disabled={!currentMessage.trim() || isThinking || sending}
                  className={`w-full px-8 py-5 md:py-6 rounded-xl font-bold transition-all text-xl md:text-2xl min-h-[70px] shadow-lg ${
                    currentMessage.trim() && !isThinking && !sending
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  } ${fontSizeClasses[fontSize] || 'text-xl'}`}
                >
                  {isThinking || sending ? '⏳ Envoi en cours...' : '➤ Envoyer le message'}
                </button>
              )}
            </div>

            {/* Deuxième ligne : Boutons secondaires */}
            <div className="flex flex-wrap gap-4 justify-center">
              {/* Bouton ajout de fichiers */}
              {showAttachButton && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`px-6 md:px-8 py-4 md:py-5 rounded-xl font-semibold bg-gray-600 text-white hover:bg-gray-700 transition-all text-lg md:text-xl min-h-[60px] shadow-md ${fontSizeClasses[fontSize] || 'text-lg'}`}
                  disabled={isThinking || sending}
                >
                  📎 Joindre un fichier
                </button>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              />

              {/* Bouton lecture vocale */}
              {showVoicePlaybackButton && (
                <button
                  onClick={isSpeaking ? stopSpeaking : () => speakText(currentMessage)}
                  className={`px-6 md:px-8 py-4 md:py-5 rounded-xl font-semibold transition-all text-lg md:text-xl min-h-[60px] shadow-md ${
                    isSpeaking 
                      ? 'bg-orange-600 text-white hover:bg-orange-700' 
                      : 'bg-green-600 text-white hover:bg-green-700'
                  } ${fontSizeClasses[fontSize] || 'text-lg'}`}
                  disabled={!currentMessage.trim() || isThinking || sending}
                >
                  {isSpeaking ? '⏸️ Pause de la lecture' : '🔊 Lire le message à voix haute'}
                </button>
              )}
            </div>
          </div>

          {/* Instructions d'aide - Plus visible */}
          <div className={`mt-6 p-5 bg-blue-50 rounded-xl border-2 border-blue-200 ${fontSizeClasses[fontSize] || 'text-base'}`}>
            <strong className="text-lg md:text-xl !text-gray-900 font-bold block mb-3">💡 Conseils d'utilisation :</strong>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-xl">•</span>
                <span>Cliquez sur le bouton <strong>"Parler"</strong> pour parler au lieu d'écrire</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-xl">•</span>
                <span>Utilisez le bouton <strong>"Mode Simple"</strong> en haut pour une interface plus claire</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-xl">•</span>
                <span>Activez le bouton <strong>"Voix"</strong> pour entendre les réponses automatiquement</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-xl">•</span>
                <span>Ajustez la taille du texte avec le menu en haut selon vos besoins</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-xl">•</span>
                <span>Vous pouvez joindre des fichiers (photos, documents) si nécessaire</span>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  )
}
