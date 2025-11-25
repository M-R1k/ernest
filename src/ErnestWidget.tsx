import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useErnest from "./hooks/useErnest";
import type { ErnestWidgetProps, Intent, SubIntent, SendActionArgs, ChatMessage, SosSubIntent } from "./types";
import { ariaButtonProps, onActivate, focusFirstInteractive } from "./utils/accessibility";
import ReactMarkdown from 'react-markdown';

// Composant VoiceModeOverlay - Mode voix amélioré avec visualisation et transcription
type VoiceModeOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  recording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSendTranscription: () => void;
  voiceStatus: string;
  transcription: string;
  finalTranscription: string;
  meterLevel: number;
  locale: string;
};

function VoiceModeOverlay({
  isOpen,
  onClose,
  recording,
  onStartRecording,
  onStopRecording,
  onSendTranscription,
  voiceStatus,
  transcription,
  finalTranscription,
  meterLevel,
  locale,
}: VoiceModeOverlayProps) {
  // Référence pour l'analyseur audio (sera initialisé par le parent)
  const [audioLevels, setAudioLevels] = useState<number[]>([]);
  const audioLevelsRef = useRef<number[]>([]);
  const [displayedText, setDisplayedText] = useState("");
  const displayedTextRef = useRef("");
  const transcriptionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Effet machine à écrire pour la transcription
  useEffect(() => {
    const textToDisplay = finalTranscription || transcription.replace(/\s*\[.*\]$/, "");
    
    if (!textToDisplay) {
      setDisplayedText("");
      displayedTextRef.current = "";
      return;
    }

    // Si le texte change, réinitialiser l'affichage progressif
    if (textToDisplay !== displayedTextRef.current) {
      // Nettoyer le timeout précédent
      if (transcriptionTimeoutRef.current) {
        clearTimeout(transcriptionTimeoutRef.current);
      }

      // Si c'est une nouvelle transcription (plus longue), afficher progressivement
      if (textToDisplay.length > displayedTextRef.current.length) {
        const newChars = textToDisplay.slice(displayedTextRef.current.length);
        let charIndex = 0;
        
        const typeNextChar = () => {
          if (charIndex < newChars.length) {
            setDisplayedText(textToDisplay.slice(0, displayedTextRef.current.length + charIndex + 1));
            displayedTextRef.current = textToDisplay.slice(0, displayedTextRef.current.length + charIndex + 1);
            charIndex++;
            transcriptionTimeoutRef.current = setTimeout(typeNextChar, 20); // 20ms par caractère pour fluidité
          } else {
            setDisplayedText(textToDisplay);
            displayedTextRef.current = textToDisplay;
          }
        };
        
        typeNextChar();
      } else {
        // Si le texte est plus court (correction), afficher directement avec fade
        setDisplayedText(textToDisplay);
        displayedTextRef.current = textToDisplay;
      }
    }
  }, [transcription, finalTranscription]);

  // Générer des barres de visualisation animées réactives à la voix
  useEffect(() => {
    if (!isOpen) {
      setAudioLevels([]);
      audioLevelsRef.current = [];
      return;
    }

    // Initialiser 20 barres avec des niveaux bas
    const initialBars = Array.from({ length: 20 }, () => 0.1);
    audioLevelsRef.current = initialBars;
    setAudioLevels([...initialBars]);

    let animationFrameId: number;
    const startTime = Date.now();

    // Animation continue des barres réactives à la voix - Version améliorée
    const animateBars = () => {
      if (!isOpen) {
        cancelAnimationFrame(animationFrameId);
        return;
      }

      const now = Date.now();
      const elapsed = (now - startTime) / 1000; // Temps en secondes
      
      // Mise à jour des niveaux : utilisation du meterLevel réel avec effet de cascade amélioré
      const newLevels = audioLevelsRef.current.map((currentLevel, index) => {
        if (recording && meterLevel > 0.02) {
          // Calculer la distance depuis le centre (index 10)
          const centerIndex = 10;
          const distance = Math.abs(index - centerIndex);
          
          // Créer un effet de cascade/onde qui se propage depuis le centre
          // Utiliser différentes fréquences pour chaque barre pour un effet plus naturel
          const frequency = 0.8 + (distance * 0.25); // Fréquences différentes selon la distance
          const wavePhase = elapsed * frequency;
          
          // Influence du meterLevel : plus fort au centre, diminue vers les bords
          const influence = Math.max(0, 1 - (distance / 12)); // Influence jusqu'à ~12 barres du centre
          const baseLevel = meterLevel * influence * 1.8; // Amplifier pour plus de visibilité
          
          // Ajouter une onde sinusoïdale pour créer l'effet de cascade avec variation horizontale
          const waveOffset = Math.sin(wavePhase + (index * 0.4)) * 0.2;
          
          // Ajouter une variation aléatoire subtile pour plus de réalisme
          const randomVariation = (Math.random() - 0.5) * 0.08;
          
          // Effet de vague horizontale supplémentaire
          const horizontalWave = Math.sin((elapsed * 2) + (index * 0.3)) * 0.1;
          
          // Combiner tous les effets
          const finalLevel = baseLevel + waveOffset + randomVariation + horizontalWave;
          
          // Appliquer un lissage plus doux avec le niveau précédent pour des transitions fluides
          const smoothedLevel = currentLevel * 0.25 + finalLevel * 0.75;
          
          return Math.max(0.15, Math.min(1, smoothedLevel));
        } else {
          // Animation subtile quand pas d'enregistrement ou pas de voix
          const decay = currentLevel * 0.88; // Décroissance progressive plus lente
          return Math.max(0.1, decay);
        }
      });
      
      audioLevelsRef.current = newLevels;
      setAudioLevels([...newLevels]);
      
      animationFrameId = requestAnimationFrame(animateBars);
    };

    animationFrameId = requestAnimationFrame(animateBars);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (transcriptionTimeoutRef.current) {
        clearTimeout(transcriptionTimeoutRef.current);
      }
    };
  }, [isOpen, recording, meterLevel]);

  // Animation variants pour framer-motion
  const overlayVariants = {
    hidden: {
      y: "100%",
      opacity: 0,
    },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring" as const,
        damping: 30,
        stiffness: 300,
        mass: 0.8,
      },
    },
    exit: {
      y: "100%",
      opacity: 0,
      transition: {
        duration: 0.25,
        ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
      },
    },
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.1,
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
      },
    },
  };

  const transcriptionVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.2,
        ease: "easeOut" as const,
      },
    },
  };

  // Calcul de la couleur dynamique selon meterLevel pour le halo
  const getHaloColor = () => {
    if (!recording || meterLevel < 0.02) return "rgba(59, 130, 246, 0.3)"; // bleu clair par défaut
    
    const intensity = Math.min(1, meterLevel * 2);
    if (intensity > 0.7) {
      // Bleu foncé pour forte intensité
      return `rgba(37, 99, 235, ${0.4 + intensity * 0.3})`;
    } else if (intensity > 0.4) {
      // Bleu moyen
      return `rgba(59, 130, 246, ${0.3 + intensity * 0.3})`;
    } else {
      // Bleu clair
      return `rgba(147, 197, 253, ${0.2 + intensity * 0.3})`;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-white border-t border-gray-200 shadow-2xl h-[50vh] max-h-[50vh]"
          role="dialog"
          aria-label="Mode Voix"
          aria-modal="true"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* En-tête compact */}
          <motion.div
            className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-200"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
          >
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 md:h-10 md:w-10 place-items-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all duration-[120ms] ease-in-out focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
              aria-label="Fermer le mode voix"
            >
              <span className="text-lg md:text-xl">✕</span>
            </button>
            <div className="text-center">
              <div className="text-[16px] md:text-[18px] font-semibold text-gray-900">Mode Voix</div>
              <div className="text-[12px] md:text-[14px] text-gray-600">{voiceStatus}</div>
            </div>
            <div className="w-9 md:w-10" /> {/* Spacer pour centrer le titre */}
          </motion.div>

          {/* Zone de contenu principale */}
          <motion.div
            className="flex-1 flex flex-col items-center justify-center px-4 md:px-6 py-4 md:py-6 overflow-hidden"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Message d'aide pour erreur iframe */}
            {voiceStatus.includes("Iframe non autorisée") && (
              <motion.div
                className="w-full max-w-md mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-amber-900 text-[14px] md:text-[15px]">
                  <p className="font-semibold mb-2">🔧 Configuration requise dans WeWeb :</p>
                  <ol className="list-decimal list-inside space-y-1 text-[13px] md:text-[14px]">
                    <li>Sélectionnez votre composant iframe</li>
                    <li>Ajoutez l'attribut : <code className="bg-amber-100 px-1 rounded">allow="microphone"</code></li>
                    <li>Rechargez la page</li>
                  </ol>
                </div>
              </motion.div>
            )}
            {/* Visualisation audio animée - Barres réactives avec cascades améliorées */}
            <div className="w-full max-w-md mb-6 md:mb-8">
              <div className="flex items-end justify-center gap-1 md:gap-1.5 h-24 md:h-32">
                {audioLevels.map((level, index) => {
                  // Calcul de la hauteur basée sur le niveau audio
                  const heightPercent = Math.max(10, Math.min(100, level * 100));
                  const opacity = Math.max(0.5, Math.min(1, level * 1.2));
                  
                  // Couleur dynamique selon l'intensité avec transitions fluides
                  const intensity = level;
                  const bgColor = intensity > 0.6 
                    ? 'bg-blue-600' 
                    : intensity > 0.3 
                      ? 'bg-blue-500' 
                      : 'bg-blue-400';
                  
                  return (
                    <motion.div
                      key={index}
                      className={`w-2 md:w-2.5 rounded-full ${bgColor}`}
                      style={{
                        height: `${heightPercent}%`,
                        opacity: opacity,
                        minHeight: '8px',
                      }}
                      animate={{
                        scaleY: 1 + (level * 0.12),
                        height: `${heightPercent}%`,
                        opacity: opacity,
                      }}
                      transition={{
                        duration: 0.12,
                        ease: "easeOut",
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Transcription en temps réel ou finale avec effet machine à écrire */}
            <motion.div
              className="w-full max-w-md mb-6 md:mb-8"
              variants={transcriptionVariants}
              initial="hidden"
              animate="visible"
              key={displayedText}
            >
              <div className="rounded-xl bg-gray-50 px-4 md:px-5 py-3 md:py-4 min-h-[60px] md:min-h-[80px] flex items-center justify-center border border-gray-200">
                {finalTranscription ? (
                  <motion.p
                    className="text-[16px] md:text-[18px] text-gray-900 text-center leading-relaxed"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    {displayedText}
                  </motion.p>
                ) : transcription ? (
                  <motion.p
                    className="text-[16px] md:text-[18px] text-gray-900 text-center leading-relaxed"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  >
                    {displayedText}
                    {displayedText && !displayedText.endsWith(" ") && (
                      <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                        className="inline-block w-0.5 h-4 md:h-5 bg-gray-900 ml-0.5 align-middle"
                      />
                    )}
                  </motion.p>
                ) : (
                  <p className="text-[14px] md:text-[16px] text-gray-500 text-center italic">
                    {recording ? "Parlez maintenant..." : "Appuyez sur le bouton pour commencer"}
                  </p>
                )}
              </div>
            </motion.div>

            {/* Bouton Envoyer si transcription disponible */}
            <AnimatePresence>
              {finalTranscription && (
                <motion.div
                  className="w-full max-w-md mb-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <button
                    type="button"
                    onClick={onSendTranscription}
                    className="w-full rounded-xl bg-blue-600 px-6 py-3 md:py-4 text-white text-[16px] md:text-[18px] font-semibold shadow-md hover:bg-blue-700 transition-all duration-[120ms] ease-in-out focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
                    aria-label="Envoyer la transcription"
                  >
                    Envoyer
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Boutons d'action */}
            <div className="flex items-center justify-center gap-4 md:gap-6 w-full max-w-md">
              {/* Bouton Annuler (X rouge) */}
              <motion.button
                type="button"
                onClick={onClose}
                className="grid h-14 w-14 md:h-16 md:w-16 place-items-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-all duration-[120ms] ease-in-out focus:outline-none focus-visible:ring-4 focus-visible:ring-red-300 shadow-md"
                aria-label="Annuler"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-xl md:text-2xl font-bold">✕</span>
              </motion.button>

              {/* Bouton principal d'enregistrement avec halo pulsant */}
              <div className="relative">
                {/* Halo pulsant autour du bouton quand recording est actif */}
                <AnimatePresence>
                  {recording && (
                    <>
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: getHaloColor(),
                          filter: "blur(12px)",
                          zIndex: -1,
                        }}
                        initial={{ scale: 1, opacity: 0.6 }}
                        animate={{
                          scale: [1, 1.4, 1.2, 1.3],
                          opacity: [0.6, 0.3, 0.5, 0.4],
                        }}
                        exit={{ scale: 1, opacity: 0 }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: getHaloColor(),
                          filter: "blur(8px)",
                          zIndex: -1,
                        }}
                        initial={{ scale: 1, opacity: 0.4 }}
                        animate={{
                          scale: [1, 1.3, 1.1, 1.25],
                          opacity: [0.4, 0.2, 0.3, 0.25],
                        }}
                        exit={{ scale: 1, opacity: 0 }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: 0.3,
                        }}
                      />
                    </>
                  )}
                </AnimatePresence>
                
                <motion.button
                  type="button"
                  onClick={recording ? onStopRecording : onStartRecording}
                  className={`relative grid h-20 w-20 md:h-24 md:w-24 place-items-center rounded-full text-white shadow-lg transition-all duration-[120ms] ease-in-out focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 ${
                    recording
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  aria-label={recording ? "Arrêter l'enregistrement" : "Commencer l'enregistrement"}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  animate={{
                    scale: recording ? [1, 1.02, 1] : 1,
                  }}
                  transition={{
                    scale: {
                      duration: 1.5,
                      repeat: recording ? Infinity : 0,
                      ease: "easeInOut",
                    },
                  }}
                >
                  {recording ? (
                    <svg className="h-8 w-8 md:h-10 md:w-10" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg className="h-8 w-8 md:h-10 md:w-10" fill="currentColor" viewBox="0 0 24 24">
                      {/* Flèche vers le haut - style simple et moderne */}
                      <path d="M12 2l8 8h-5v10H9V10H4l8-8z" />
                    </svg>
                  )}
                </motion.button>
              </div>

              {/* Bouton Clavier (Gris) - Retour au clavier */}
              <motion.button
                type="button"
                onClick={onClose}
                className="grid h-14 w-14 md:h-16 md:w-16 place-items-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all duration-[120ms] ease-in-out focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-300 shadow-md"
                aria-label="Retour au clavier"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="h-6 w-6 md:h-7 md:w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  {/* Icône de clavier moderne */}
                  <rect x="2" y="4" width="20" height="14" rx="2" />
                  {/* Rangée supérieure de touches */}
                  <circle cx="5" cy="9" r="1" fill="currentColor" />
                  <circle cx="9" cy="9" r="1" fill="currentColor" />
                  <circle cx="13" cy="9" r="1" fill="currentColor" />
                  <circle cx="17" cy="9" r="1" fill="currentColor" />
                  {/* Rangée inférieure de touches */}
                  <rect x="4" y="12" width="3" height="2" rx="0.5" fill="currentColor" />
                  <rect x="9" y="12" width="6" height="2" rx="0.5" fill="currentColor" />
                  <rect x="17" y="12" width="3" height="2" rx="0.5" fill="currentColor" />
                </svg>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type Screen = "home" | "sos" | "chat";

const ALL_INTENTS: Array<{ key: Intent; label: string; icon: string }> = [
  { key: "SECURE_ACCOUNTS", label: "Je sécurise mes comptes en ligne", icon: "🔐" },
  { key: "CHECK_SCAM", label: "Je vérifie si c’est une arnaque", icon: "🕵️" },
  { key: "SECURE_DEVICE", label: "Je sécurise mes appareils", icon: "📱" },
  { key: "AWARENESS", label: "Je me sensibilise au cyberharcèlement", icon: "💡" },
  { key: "SAFE_BROWSING", label: "Je veux naviguer en sécurité", icon: "🌐" },
  { key: "SOS", label: "J’ai besoin d’aide", icon: "🆘" },
];

const SOS_OPTIONS: Array<{ key: SosSubIntent; label: string }> = [
  { key: "ACCOUNT_TAKEOVER", label: "Mon compte a été piraté" },
  { key: "LOST_MONEY", label: "J’ai perdu de l’argent" },
  { key: "PHONE_STOLEN", label: "Mon téléphone est volé" },
  { key: "DATA_LEAK", label: "Mes données ont fuité" },
];

type Choice = { value: string; label: string };
type StepDef = { question: string; choices: Choice[] };

// Minimal flow definitions (can be extended)
type ActionableIntent = Exclude<Intent, "SOS" | "HOME" | "fallback">;
const NON_SOS_FLOWS: Record<ActionableIntent, StepDef[]> = {
  SECURE_ACCOUNTS: [
    {
      question: "Que souhaitez-vous faire ?",
      choices: [
        { value: "password_create", label: "Créer un mot de passe sûr" },
        { value: "2fa", label: "Activer la double sécurité (2FA)" },
        { value: "account_blocked", label: "Mon compte est bloqué/piraté" },
        { value: "password_check", label: "Je veux vérifier mes mots de passe" },
      ],
    },
  ],
  CHECK_SCAM: [
    {
      question: "De quel message s’agit-il ?",
      choices: [
        { value: "email_suspect", label: "J’ai reçu un mail suspect" },
        { value: "sms_call", label: "Un SMS ou appel étrange" },
        { value: "payment_code", label: "On m’a demandé un paiement ou un code" },
        { value: "site_doubt", label: "Je doute d’un site internet" },
      ],
    },
  ],
  SECURE_DEVICE: [
    {
      question: "Quel est le sujet ?",
      choices: [
        { value: "phone_tablet", label: "Mon téléphone/tablette" },
        { value: "computer", label: "Mon ordinateur" },
        { value: "device_slow", label: "Mon appareil est lent ou bizarre" },
        { value: "device_lost", label: "J’ai perdu mon appareil" },
      ],
    },
  ],
  AWARENESS: [
    {
      question: "Que voulez-vous apprendre ?",
      choices: [
        { value: "report_content", label: "Signaler ou supprimer un contenu" },
        { value: "help_victim", label: "Aider une personne harcelée" },
        { value: "recognize_harassment", label: "Reconnaître le cyberharcèlement" },
        { value: "how_to_react", label: "Savoir comment réagir" },
      ],
    },
  ],
  SAFE_BROWSING: [
    {
      question: "Quel besoin ?",
      choices: [
        { value: "verify_site", label: "Je veux vérifier un site" },
        { value: "public_wifi", label: "J’utilise un Wi‑Fi public" },
        { value: "download_program", label: "Je télécharge un programme" },
        { value: "browse_safer", label: "J’aimerais naviguer plus sereinement" },
      ],
    },
  ],
};

const SOS_FLOWS: Record<SosSubIntent, StepDef[]> = {
  ACCOUNT_TAKEOVER: [
    {
      question: "Avez-vous encore accès à votre compte ?",
      choices: [
        { value: "oui", label: "Oui" },
        { value: "non", label: "Non" },
      ],
    },
    {
      question: "Souhaitez-vous lancer la procédure de récupération ?",
      choices: [
        { value: "lancer", label: "Lancer" },
        { value: "bloque", label: "Je n’y arrive pas" },
      ],
    },
    {
      question: "Avez-vous activé la double authentification ?",
      choices: [
        { value: "oui", label: "Oui" },
        { value: "non", label: "Non" },
      ],
    },
  ],
  LOST_MONEY: [
    {
      question: "S’agit-il d’un paiement par carte ?",
      choices: [
        { value: "oui", label: "Oui" },
        { value: "non", label: "Non" },
      ],
    },
    {
      question: "Avez-vous contacté votre banque ?",
      choices: [
        { value: "oui", label: "Oui" },
        { value: "non", label: "Non" },
      ],
    },
    {
      question: "Souhaitez-vous déposer plainte ?",
      choices: [
        { value: "oui", label: "Oui" },
        { value: "non", label: "Non" },
      ],
    },
  ],
  PHONE_STOLEN: [
    {
      question: "Votre téléphone est-il encore localisable ?",
      choices: [
        { value: "oui", label: "Oui" },
        { value: "non", label: "Non" },
      ],
    },
    {
      question: "Souhaitez-vous verrouiller/effacer à distance ?",
      choices: [
        { value: "oui", label: "Oui" },
        { value: "non", label: "Non" },
      ],
    },
    {
      question: "Avez-vous changé vos mots de passe ?",
      choices: [
        { value: "oui", label: "Oui" },
        { value: "non", label: "Non" },
      ],
    },
  ],
  DATA_LEAK: [
    {
      question: "Vos mots de passe sont-ils impactés ?",
      choices: [
        { value: "oui", label: "Oui" },
        { value: "non", label: "Non" },
      ],
    },
    {
      question: "Souhaitez-vous les changer maintenant ?",
      choices: [
        { value: "oui", label: "Oui" },
        { value: "non", label: "Non" },
      ],
    },
    {
      question: "Avez-vous alerté vos contacts ?",
      choices: [
        { value: "oui", label: "Oui" },
        { value: "non", label: "Non" },
      ],
    },
  ],
};

function emitTelemetry(detail: { type: string; intent?: Intent; subIntent?: Exclude<SubIntent, null>; step?: number }) {
  try {
    window.dispatchEvent(new CustomEvent("soscyber:event", { detail }));
  } catch {}
}

function keywordBannerUrlFor(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes("impôt") || t.includes("impots") || t.includes("impôts")) return "https://www.impots.gouv.fr";
  if (t.includes("santé") || t.includes("sante")) return "https://www.ameli.fr";
  if (t.includes("banque")) return "https://www.service-public.fr";
  return null;
}

function LargeButton({ icon, label, onClick, ariaLabel }: { icon: string; label: string; onClick: () => void; ariaLabel: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-gray-300 bg-white p-5 text-center text-[18px] md:text-[20px] font-semibold shadow-sm transition hover:border-blue-500 hover:shadow focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 min-h-[88px] md:min-h-[100px]"
      aria-label={ariaLabel}
    >
      <span className="text-3xl md:text-4xl" aria-hidden>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

type FilePreview = {
  name: string;
  size: number;
  type: string;
  previewUrl: string | null;
};

// Composant Avatar pour l'utilisateur
function UserAvatar({ 
  profileImage, 
  name = "U" 
}: { 
  profileImage?: string; 
  name?: string;
}) {
  const initial = name.charAt(0).toUpperCase();
  
  return (
    <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm md:text-base shadow-md ring-2 ring-white">
      {profileImage ? (
        <img 
          src={profileImage} 
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Si l'image ne charge pas, on affiche l'initiale
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent) {
              parent.innerHTML = `<span class="text-white font-semibold text-sm md:text-base">${initial}</span>`;
            }
          }}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

// Composant Avatar pour le chatbot (Ernest)
function BotAvatar() {
  return (
    <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-300 flex items-center justify-center shadow-md ring-2 ring-white relative">
      <svg 
        className="w-5 h-5 md:w-6 md:h-6" 
        viewBox="0 0 24 24"
        fill="none"
        aria-label="Ernest"
      >
        {/* Grande étoile centrale (4 pointes) */}
        <path 
          d="M12 3L13.5 9.5L20 11L13.5 12.5L12 19L10.5 12.5L4 11L10.5 9.5L12 3Z" 
          fill="white" 
        />
        {/* Petite étoile en haut à droite */}
        <path 
          d="M17 5L17.3 6.5L18.5 7L17.3 7.5L17 9L16.7 7.5L15.5 7L16.7 6.5L17 5Z" 
          fill="white" 
          opacity="0.6"
        />
        {/* Petite étoile en bas à gauche */}
        <path 
          d="M7 17L7.3 18.5L8.5 19L7.3 19.5L7 21L6.7 19.5L5.5 19L6.7 18.5L7 17Z" 
          fill="white" 
          opacity="0.6"
        />
      </svg>
    </div>
  );
}

function Bubble({
  role,
  children,
  attachedFiles,
  showAvatar = false,
  profileImage,
  userName,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
  attachedFiles?: FilePreview[];
  showAvatar?: boolean;
  profileImage?: string;
  userName?: string;
}) {
  const isUser = role === "user";

  const bubbleContent = (
    <div
      className={`max-w-[85%] md:max-w-[75%] whitespace-pre-wrap rounded-2xl px-3 md:px-5 py-2 md:py-4 ${
        isUser
          ? "bg-white text-gray-900 shadow-lg"
          : "bg-gray-100 text-gray-900 ring-1 ring-inset ring-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
      }`}
      aria-live={isUser ? undefined : "polite"}
    >
      {isUser ? (
        // 🧍 Les messages de l'utilisateur avec aperçus de fichiers
        <div className="flex flex-col gap-2 md:gap-3">
          {/* Aperçus des fichiers joints */}
          {attachedFiles && attachedFiles.length > 0 && (
            <>
              {console.log('Bubble: Affichage de', attachedFiles.length, 'fichiers pour le message utilisateur', attachedFiles)}
              <div className="flex flex-wrap gap-2 md:gap-3 mb-1">
                {attachedFiles.map((filePreview, index) => {
                  const isImage = filePreview.type.startsWith('image/');
                  console.log(`Fichier ${index}:`, filePreview.name, 'type:', filePreview.type, 'previewUrl:', filePreview.previewUrl ? 'présent' : 'absent');
                  return (
                    <div
                      key={index}
                      className={`relative rounded-lg overflow-hidden ${
                        isImage 
                          ? "shadow-md" 
                          : "border border-gray-200 bg-gray-50"
                      }`}
                    >
                      {isImage && filePreview.previewUrl ? (
                        <div className="relative">
                          <img
                            src={filePreview.previewUrl}
                            alt={filePreview.name}
                            className="w-32 h-32 md:w-40 md:h-40 object-cover block"
                            style={{ backgroundColor: 'transparent' }}
                            onError={(e) => {
                              console.error('Erreur de chargement de l\'image:', filePreview.name, filePreview.previewUrl);
                            }}
                            onLoad={() => {
                              console.log('Image chargée avec succès:', filePreview.name);
                            }}
                          />
                          {/* Overlay avec info du fichier */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                            <p className="text-white text-[11px] font-medium truncate">{filePreview.name}</p>
                            <p className="text-white/90 text-[10px]">{formatFileSize(filePreview.size)}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="px-3 md:px-4 py-2 md:py-3 flex items-center gap-2 bg-gray-50">
                          <span className="text-xl md:text-2xl">{getFileIcon(filePreview.name)}</span>
                          <div className="flex flex-col min-w-0 max-w-[150px] md:max-w-[200px]">
                            <span className="text-[12px] md:text-[13px] font-medium text-gray-900 truncate" title={filePreview.name}>
                              {filePreview.name}
                            </span>
                            <span className="text-[11px] text-gray-600">
                              {formatFileSize(filePreview.size)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {/* Texte du message */}
          {children && String(children).trim() && (
            <div className="text-gray-900">
              {String(children)}
            </div>
          )}
        </div>
      ) : (
        // 🤖 Les messages d'Ernest sont rendus avec Markdown
        <div className="prose prose-sm prose-gray dark:prose-invert max-w-none">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              ul: ({ children }) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
              li: ({ children }) => <li className="mb-1">{children}</li>,
            }}
          >
            {String(children)}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );

  // Si c'est un message utilisateur et qu'on doit afficher l'avatar, on l'enveloppe
  if (isUser && showAvatar) {
    return (
      <div className="flex items-end gap-2 md:gap-3 ml-auto max-w-[85%] md:max-w-[75%]">
        {bubbleContent}
        <UserAvatar profileImage={profileImage} name={userName} />
      </div>
    );
  }

  // Si c'est un message assistant, on affiche l'avatar du bot
  if (!isUser) {
    return (
      <div className="flex items-end gap-2 md:gap-3 mr-auto max-w-[85%] md:max-w-[75%]">
        <BotAvatar />
        {bubbleContent}
      </div>
    );
  }

  // Sinon, on retourne juste la bulle avec le bon alignement
  return (
    <div className={isUser ? "ml-auto" : "mr-auto"}>
      {bubbleContent}
    </div>
  );
}

function ChoiceGroup({ step, choices, onSelect }: { step: number; choices: Choice[]; onSelect: (value: string) => void }) {
  return (
    <div role="group" aria-label={`Choix étape ${step}`} className="flex flex-wrap gap-3 md:gap-4">
      {choices.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onSelect(c.value)}
          className="inline-flex min-h-[48px] md:min-h-[52px] items-center justify-center rounded-xl bg-white px-4 md:px-5 py-3 md:py-3.5 text-[18px] md:text-[19px] font-medium ring-1 ring-inset ring-gray-300 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
          aria-label={c.label}
        >
          {c.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onSelect("fallback")}
        className="inline-flex min-h-[48px] md:min-h-[52px] items-center justify-center rounded-xl bg-white px-4 md:px-5 py-3 md:py-3.5 text-[18px] md:text-[19px] font-medium ring-1 ring-inset ring-gray-300 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
        aria-label="Je n'y arrive pas"
      >
        Je n'y arrive pas
      </button>
    </div>
  );
}

function TopBar({ onBack, onMenu, onReset }: { onBack: () => void; onMenu: () => void; onReset: () => void }) {
  return (
    <header className="relative flex items-center justify-between px-3 md:px-6 py-2.5 md:py-4">
      <button
        type="button"
        onClick={onBack}
        className="grid h-9 w-9 md:h-12 md:w-12 place-items-center rounded-full bg-gray-100 text-gray-700 shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
        aria-label="Retour"
      >
        <span aria-hidden className="text-base md:text-xl">←</span>
      </button>
      <div className="absolute left-1/2 -translate-x-1/2 text-[20px] md:text-[22px] font-semibold text-gray-900">Ernest</div>
      <div className="flex items-center gap-2 md:gap-3">
        <button
          type="button"
          onClick={onReset}
          className="grid h-9 w-9 md:h-12 md:w-12 place-items-center rounded-full bg-gray-100 text-gray-700 shadow-sm transition hover:bg-gray-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
          aria-label="Effacer la conversation"
          title="Effacer la conversation"
        >
          <TrashIcon className="h-4 w-4 md:h-5 md:w-5" />
        </button>
        <button
          type="button"
          onClick={onMenu}
          className="grid h-9 w-9 md:h-12 md:w-12 place-items-center rounded-full bg-gray-100 text-gray-700 shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
          aria-label="Menu"
        >
          <span aria-hidden className="text-base md:text-xl">≡</span>
        </button>
      </div>
    </header>
  );
}

function StickyBar({ onBack, onHome, onContact, onReminder }: { onBack: () => void; onHome: () => void; onContact: () => void; onReminder: () => void }) {
  return (
    <div className="sticky bottom-0 z-10 w-full border-t border-gray-200 bg-white/95 px-4 md:px-6 py-3 md:py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
      <div className="mx-auto flex max-w-screen-lg items-center justify-between gap-2 md:gap-3">
        <div className="flex items-center gap-2 md:gap-3">
          <button type="button" onClick={onBack} className="min-h-[48px] md:min-h-[52px] rounded-xl bg-gray-100 px-4 md:px-5 py-3 md:py-3.5 text-[18px] md:text-[19px] font-semibold shadow-sm transition hover:bg-gray-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300">
            ↩️ Retour
          </button>
          <button type="button" onClick={onHome} className="min-h-[48px] md:min-h-[52px] rounded-xl bg-gray-100 px-4 md:px-5 py-3 md:py-3.5 text-[18px] md:text-[19px] font-semibold shadow-sm transition hover:bg-gray-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300">
            🏠 Menu
          </button>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <a href="tel:3018" onClick={onContact} className="min-h-[48px] md:min-h-[52px] rounded-xl bg-green-600 px-4 md:px-5 py-3 md:py-3.5 text-[18px] md:text-[19px] font-semibold text-white shadow-sm transition hover:bg-green-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-300">
            📞 Contact
          </a>
          <button type="button" onClick={onReminder} className="min-h-[48px] md:min-h-[52px] rounded-xl bg-amber-100 px-4 md:px-5 py-3 md:py-3.5 text-[18px] md:text-[19px] font-semibold shadow-sm transition hover:bg-amber-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300">
            🔔 Rappel
          </button>
        </div>
      </div>
    </div>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} role="img" aria-label="Effacer">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Micro">
      <path fill="currentColor" d="M12 14a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v4a4 4 0 0 0 4 4Zm6-4a6 6 0 0 1-12 0H4a8 8 0 0 0 16 0h-2Zm-6 9a1 1 0 0 0 1-1v-1h-2v1a1 1 0 0 0 1 1Z"/>
    </svg>
  );
}

function SendWavesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Envoyer">
      {/* Icône en barres de hauteur/intensité différentes */}
      <g fill="currentColor">
        <rect x="3" y="9" width="2" height="6" rx="1" opacity=".5" />
        <rect x="7" y="7" width="2" height="10" rx="1" opacity=".7" />
        <rect x="11" y="5" width="2" height="14" rx="1" />
        <rect x="15" y="7" width="2" height="10" rx="1" opacity=".7" />
        <rect x="19" y="9" width="2" height="6" rx="1" opacity=".5" />
      </g>
    </svg>
  );
}

type ComposerProps = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onVoice: () => void;
  onFileAttach: (files: File[]) => void;
  attachedFiles: File[];
  onRemoveFile: (index: number) => void;
  onFocus?: () => void;
};

// Fonction utilitaire pour obtenir l'icône selon le type de fichier
function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return '🖼️';
  if (['pdf'].includes(ext || '')) return '📄';
  if (['doc', 'docx'].includes(ext || '')) return '📝';
  if (['txt'].includes(ext || '')) return '📃';
  return '📎';
}

// Fonction pour formater la taille de fichier
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Composant pour afficher un fichier joint
function AttachedFileItem({ file, index, onRemove }: { file: File; index: number; onRemove: (index: number) => void }) {
  const isImage = file.type.startsWith('image/');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Générer une prévisualisation pour les images
  useEffect(() => {
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPreviewUrl(result);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
    return () => {
      // Le cleanup se fait automatiquement avec data URLs, pas besoin de revokeObjectURL
    };
  }, [file, isImage]);

  return (
    <div className="group relative inline-flex flex-col rounded-lg bg-blue-50 border border-blue-200 shadow-sm overflow-hidden hover:shadow-md transition">
      {/* Prévisualisation pour les images */}
      {isImage && previewUrl ? (
        <div className="relative w-32 h-32 md:w-40 md:h-40 bg-gray-100">
          <img
            src={previewUrl}
            alt={file.name}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-red-500 text-white hover:bg-red-600 transition shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 z-10"
            aria-label={`Retirer ${file.name}`}
          >
            <span className="text-sm font-bold">×</span>
          </button>
          {/* Info du fichier en overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
            <p className="text-white text-[11px] font-medium truncate">{file.name}</p>
            <p className="text-white/90 text-[10px]">{formatFileSize(file.size)}</p>
          </div>
        </div>
      ) : (
        <div className="relative px-3 md:px-4 py-2 md:py-2.5 flex items-center gap-2">
          <span className="text-xl md:text-2xl flex-shrink-0" aria-hidden>{getFileIcon(file.name)}</span>
          <div className="flex flex-col min-w-0 max-w-[200px] md:max-w-[250px]">
            <span className="text-[12px] md:text-[13px] font-medium text-blue-900 truncate" title={file.name}>
              {file.name}
            </span>
            <span className="text-[11px] text-blue-600">
              {formatFileSize(file.size)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="flex-shrink-0 ml-1 grid h-6 w-6 place-items-center rounded-full bg-blue-200 text-blue-700 hover:bg-blue-300 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label={`Retirer ${file.name}`}
          >
            <span className="text-sm font-bold">×</span>
          </button>
        </div>
      )}
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSend,
  onVoice,
  onFileAttach,
  attachedFiles,
  onRemoveFile,
  onFocus,
}: ComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="w-full px-3 md:px-6 py-2.5 md:py-4">
      {/* Affichage des fichiers joints */}
      {attachedFiles.length > 0 && (
        <div className="mx-auto mb-2 w-full max-w-screen-sm md:max-w-screen-md">
          <div className="flex flex-wrap gap-2 md:gap-3">
            {attachedFiles.map((file, index) => (
              <AttachedFileItem
                key={`${file.name}-${index}`}
                file={file}
                index={index}
                onRemove={onRemoveFile}
              />
            ))}
          </div>
        </div>
      )}

      {/* Zone de saisie et boutons */}
      <div className="mx-auto flex w-full max-w-screen-sm md:max-w-screen-md items-center gap-2.5 md:gap-4 rounded-full bg-gray-100 px-3 md:px-5 py-2 md:py-3.5 text-gray-700">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) onSend();
          }}
          placeholder="Posez votre question"
          aria-label="Posez votre question"
          className="flex-1 bg-transparent text-[15px] md:text-[18px] outline-none placeholder:text-gray-500"
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              const filesArray = Array.from(e.target.files);
              onFileAttach(filesArray);
              // Réinitialiser l'input pour permettre de sélectionner le même fichier à nouveau
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`relative grid h-10 w-10 md:h-12 md:w-12 flex-shrink-0 place-items-center rounded-full bg-gray-600 text-white shadow-md transition hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 ${
            attachedFiles.length > 0 ? 'ring-2 ring-blue-300' : ''
          }`}
          aria-label="Joindre des fichiers"
          title={attachedFiles.length > 0 ? `${attachedFiles.length} fichier(s) joint(s)` : "Joindre des fichiers"}
        >
          <svg className="h-6 w-6 md:h-7 md:w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {attachedFiles.length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 md:h-6 md:w-6 rounded-full bg-blue-700 text-white text-[10px] md:text-[11px] font-bold flex items-center justify-center shadow-md ring-2 ring-white">
              {attachedFiles.length > 9 ? '9+' : attachedFiles.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onVoice}
          className="grid h-10 w-10 md:h-14 md:w-14 flex-shrink-0 place-items-center rounded-full bg-blue-600 text-white shadow-md transition hover:bg-blue-700 disabled:opacity-50"
          aria-label="Mode Voix"
        >
          <SendWavesIcon className="h-6 w-6 md:h-9 md:w-9" />
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={!value.trim() && attachedFiles.length === 0}
          className="grid h-10 w-10 md:h-14 md:w-14 flex-shrink-0 place-items-center rounded-full bg-green-600 text-white shadow-md transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Envoyer"
        >
          <svg className="h-6 w-6 md:h-9 md:w-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function ErnestWidget({ onReminder, webhookUrl, locale = "fr-FR" }: ErnestWidgetProps) {
  const { sessionId, messages, progress, sendAction, loading, error, clearError, addProgress, reset, appendAssistant, appendUser } = useErnest(webhookUrl);
  const [screen, setScreen] = useState<Screen>("home");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [subIntent, setSubIntent] = useState<Exclude<SubIntent, null> | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [showBannerUrl, setShowBannerUrl] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>("Prêt");
  const [composerText, setComposerText] = useState("");
  const [meterLevel, setMeterLevel] = useState(0);
  const [voiceTranscription, setVoiceTranscription] = useState(""); // Transcription en temps réel pour le mode voix
  const [finalTranscription, setFinalTranscription] = useState(""); // Transcription finale après arrêt de l'enregistrement
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]); // Fichiers joints dans le composer
  const [messageFiles, setMessageFiles] = useState<Record<number, FilePreview[]>>({}); // Fichiers associés aux messages (par timestamp)
  const pendingFilesRef = useRef<FilePreview[] | null>(null); // Fichiers en attente d'association avec le prochain message
  const voiceRecognitionRef = useRef<any>(null); // Référence séparée pour la transcription du mode voix
  const recordingRef = useRef(false); // Ref pour accéder à la valeur actuelle de recording dans les callbacks
  const voiceModeRef = useRef(false); // Ref pour accéder à la valeur actuelle de voiceMode dans les callbacks
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Timer pour détecter le silence
  const lastVoiceTimeRef = useRef<number>(0); // Timestamp du dernier moment où de la voix a été détectée
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const meterStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<any>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Float32Array | null>(null);
  const intentRef = useRef<Intent | null>(null);
  const subIntentRef = useRef<Exclude<SubIntent, null> | null>(null);
  const stepIndexRef = useRef<number>(0);
  const permissionGrantedRef = useRef<boolean>(false); // Indicateur que WeWeb a déjà accordé la permission

  // Mapping texte libre → intent/subIntent (heuristique simple)
  function mapTextToMeta(text: string): { intent: Intent; subIntent?: Exclude<SubIntent, null> } | null {
    const t = text.toLowerCase();
    // SECURE_ACCOUNTS
    if ((t.includes("mot de passe") || t.includes("password")) && (t.includes("créer") || t.includes("generer") || t.includes("générer") || t.includes("nouveau"))) {
      return { intent: "SECURE_ACCOUNTS", subIntent: "password_create" };
    }
    if (t.includes("2fa") || (t.includes("double") && (t.includes("auth") || t.includes("sécurité") || t.includes("authent")))) {
      return { intent: "SECURE_ACCOUNTS", subIntent: "2fa" };
    }
    // SAFE_BROWSING
    if ((t.includes("verifier un site") || t.includes("vérifier un site") || (t.includes("site") && (t.includes("verifier") || t.includes("vérifier") || t.includes("fiable"))))) {
      return { intent: "SAFE_BROWSING", subIntent: "verify_site" };
    }
    if (t.includes("wifi public") || t.includes("wi-fi public")) {
      return { intent: "SAFE_BROWSING", subIntent: "public_wifi" };
    }
    // CHECK_SCAM
    if (t.includes("mail suspect") || (t.includes("email") && (t.includes("suspect") || t.includes("phishing") || t.includes("hameçonnage")))) {
      return { intent: "CHECK_SCAM", subIntent: "email_suspect" };
    }
    if ((t.includes("sms") || t.includes("appel")) && (t.includes("suspect") || t.includes("etrange") || t.includes("étrange"))) {
      return { intent: "CHECK_SCAM", subIntent: "sms_call" };
    }
    return null;
  }

  useEffect(() => {
    if (containerRef.current) focusFirstInteractive(containerRef.current);
  }, [screen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, stepIndex, screen]);

  useEffect(() => {
    if (composerText.length > 0) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [composerText]);

  // Écouter les messages depuis WeWeb pour ouvrir le mode voix (Option B)
  useEffect(() => {
    function handleVoiceMessage(event: MessageEvent) {
      // Message pour ouvrir le mode voix (après que WeWeb ait demandé l'autorisation micro)
      if (event.data?.type === "open_voice_mode") {
        console.log("✅ Ouverture du mode voix depuis WeWeb - permission accordée");
        
        // Marquer que la permission a été accordée par WeWeb
        permissionGrantedRef.current = true;
        
        // Ouvrir l'overlay mode voix
        setVoiceMode(true);
        setVoiceStatus("Prêt - Cliquez sur le bouton pour commencer");
        
        // Ne pas démarrer automatiquement - laisser l'utilisateur cliquer sur le bouton
        // La permission micro a déjà été accordée par WeWeb, donc startRec() devrait fonctionner
        
        // Utiliser les valeurs actuelles depuis les refs (évite les problèmes de dépendances)
        try {
          emitTelemetry({ 
            type: "voice_open_from_weweb", 
            intent: intentRef.current || undefined, 
            subIntent: subIntentRef.current || undefined, 
            step: stepIndexRef.current 
          });
        } catch (e) {
          console.warn("Erreur telemetry:", e);
        }
      }
    }

    // Ajouter l'écouteur d'événements
    window.addEventListener("message", handleVoiceMessage);

    // Nettoyer l'écouteur à la destruction du composant
    return () => {
      window.removeEventListener("message", handleVoiceMessage);
    };
  }, []); // Pas de dépendances - utilise les refs pour les valeurs actuelles

  // Pas de message d'intro par défaut

  // Mettre à jour les refs quand les valeurs changent
  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  // Mettre à jour les refs pour intent, subIntent et stepIndex
  useEffect(() => {
    intentRef.current = intent;
  }, [intent]);

  useEffect(() => {
    subIntentRef.current = subIntent;
  }, [subIntent]);

  useEffect(() => {
    stepIndexRef.current = stepIndex;
  }, [stepIndex]);

  // Ref pour stocker la transcription actuelle (pour accès dans les callbacks)
  const voiceTranscriptionRef = useRef("");
  useEffect(() => {
    voiceTranscriptionRef.current = voiceTranscription;
  }, [voiceTranscription]);

  // Fonction pour arrêter l'enregistrement et afficher le texte transcrit (sans envoyer)
  const stopTranscription = useCallback(async () => {
    if (!recordingRef.current) return;

    // Arrêter l'enregistrement audio
    const mr = mrRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    }

    // Arrêter la transcription
    const voiceRec = voiceRecognitionRef.current;
    if (voiceRec) {
      try {
        voiceRec.stop();
      } catch {}
    }

    // Nettoyer le timer de silence
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Attendre un peu pour que la transcription finale soit capturée
    await new Promise(resolve => setTimeout(resolve, 800));

    // Récupérer le texte transcrit final (sans les [interim]) depuis la ref
    const finalText = voiceTranscriptionRef.current.replace(/\s*\[.*\]$/, "").trim();

    if (finalText && finalText.length > 0) {
      setFinalTranscription(finalText);
      setVoiceStatus("Transcription prête");
    } else {
      setFinalTranscription("");
      setVoiceStatus("Aucune transcription détectée");
    }

    // Arrêter l'enregistrement mais garder le mode voix ouvert pour afficher le texte
    setRecording(false);
    stopMeter();

    // Arrêter tous les streams audio
    try {
      if (meterStreamRef.current) {
        meterStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const mrStream = mrRef.current;
      if (mrStream && mrStream.stream) {
        mrStream.stream.getTracks().forEach((t) => t.stop());
      }
    } catch {}
  }, []);

  // Fonction pour envoyer le texte transcrit
  const sendTranscription = useCallback(async () => {
    const textToSend = finalTranscription || voiceTranscriptionRef.current.replace(/\s*\[.*\]$/, "").trim();
    
    if (!textToSend || textToSend.length === 0) {
      setVoiceStatus("Aucun texte à envoyer");
      return;
    }

    setVoiceStatus("Envoi du texte...");
    
    // Mapping texte → intent/subIntent
    const mapped = mapTextToMeta(textToSend);
    const effectiveIntent: Intent = mapped?.intent || ("fallback" as Intent);
    const effectiveSub: Exclude<SubIntent, null> | undefined = mapped?.subIntent || undefined;
    const effectiveStep = stepIndex > 0 ? stepIndex : 1;

    // Envoyer le texte via sendAction (workflow n8n)
    emitTelemetry({ type: "voice_text_sent", intent: effectiveIntent || undefined, subIntent: effectiveSub || undefined, step: stepIndex });
    await sendAction({ intent: effectiveIntent, subIntent: effectiveSub, step: effectiveStep, text: textToSend });

    // Nettoyer après l'envoi
    setVoiceMode(false);
    setVoiceTranscription("");
    setFinalTranscription("");
    setVoiceStatus("Prêt");
  }, [finalTranscription, stepIndex, sendAction]);

  // Détection de silence : arrêter automatiquement après 3 secondes sans voix
  useEffect(() => {
    if (!recording || !voiceMode) {
      // Nettoyer le timer si on n'est plus en enregistrement
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      lastVoiceTimeRef.current = 0;
      return;
    }

    // Seuil de détection de voix (ajustable)
    const VOICE_THRESHOLD = 0.05; // Niveau minimum pour considérer qu'il y a de la voix
    const SILENCE_DURATION = 2000; // 2 secondes de silence

    // Si on détecte de la voix (meterLevel > seuil)
    if (meterLevel > VOICE_THRESHOLD) {
      lastVoiceTimeRef.current = Date.now();
      
      // Annuler le timer de silence s'il existe
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    } else {
      // Pas de voix détectée
      const now = Date.now();
      const timeSinceLastVoice = lastVoiceTimeRef.current > 0 ? now - lastVoiceTimeRef.current : 0;

      // Si on a déjà détecté de la voix avant (lastVoiceTime > 0) et qu'on est en silence depuis 2 secondes
      if (lastVoiceTimeRef.current > 0 && timeSinceLastVoice >= SILENCE_DURATION) {
        // Arrêter l'enregistrement (une seule fois)
        if (!silenceTimerRef.current) {
          console.log("Silence détecté pendant 2 secondes, arrêt automatique...");
          silenceTimerRef.current = setTimeout(() => {
            stopTranscription();
          }, 100);
        }
      } else if (lastVoiceTimeRef.current === 0) {
        // Si on vient juste de démarrer, initialiser le timestamp après un délai
        // pour éviter de déclencher immédiatement si l'utilisateur ne parle pas tout de suite
        setTimeout(() => {
          if (recordingRef.current && voiceModeRef.current && lastVoiceTimeRef.current === 0) {
            lastVoiceTimeRef.current = Date.now();
          }
        }, 500);
      }
    }
  }, [meterLevel, recording, voiceMode, stopTranscription]);

  // Transcription vocale pour le mode voix (séparée de la dictée normale)
  useEffect(() => {
    if (!voiceMode) {
      // Nettoyer la transcription quand on ferme le mode voix
      setVoiceTranscription("");
      // Arrêter et nettoyer la transcription si elle existe
      const voiceRec = voiceRecognitionRef.current;
      if (voiceRec) {
        try {
          voiceRec.abort();
        } catch {}
        voiceRecognitionRef.current = null;
      }
      return;
    }

    const anyWindow = window as any;
    const SpeechRecognition = anyWindow.SpeechRecognition || anyWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition non disponible pour le mode voix");
      return;
    }

    // Créer une nouvelle instance de SpeechRecognition pour le mode voix
    const voiceRec: any = new SpeechRecognition();
    voiceRec.lang = locale;
    voiceRec.interimResults = true; // Retours en temps réel
    voiceRec.continuous = true; // Continue jusqu'à stop
    voiceRec.maxAlternatives = 1;

    voiceRec.onresult = (e: any) => {
      let interim = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalText += transcript + " ";
        } else {
          interim = transcript;
        }
      }
      
      // Mise à jour de la transcription pour le mode voix
      setVoiceTranscription((prev) => {
        const base = prev.replace(/\s*\[.*\]$/, "");
        if (finalText) {
          return (base + finalText).trim();
        }
        if (interim) {
          return `${base} [${interim}]`;
        }
        return base;
      });
    };

    voiceRec.onerror = (e: any) => {
      console.error("Erreur transcription mode voix:", e.error);
      // Ne pas arrêter l'enregistrement audio si la transcription échoue
      // Si l'erreur est "no-speech", on peut continuer
      if (e.error === "no-speech") {
        // Redémarrer silencieusement si pas de parole détectée
        if (voiceModeRef.current && recordingRef.current) {
          setTimeout(() => {
            try {
              const currentRec = voiceRecognitionRef.current;
              if (currentRec && voiceModeRef.current && recordingRef.current) {
                currentRec.start();
              }
            } catch {}
          }, 100);
        }
      }
    };

    voiceRec.onend = () => {
      // Si on est toujours en mode voix et en train d'enregistrer, redémarrer
      if (voiceModeRef.current && recordingRef.current) {
        setTimeout(() => {
          try {
            const currentRec = voiceRecognitionRef.current;
            if (currentRec && voiceModeRef.current && recordingRef.current) {
              currentRec.start();
            }
          } catch (err) {
            // Ignorer les erreurs de redémarrage (peut être déjà démarré)
          }
        }, 100);
      }
    };

    voiceRec.onstart = () => {
      console.log("Transcription vocale démarrée");
    };

    // Stocker la référence
    voiceRecognitionRef.current = voiceRec;

    return () => {
      // Nettoyer à la fermeture du mode voix
      try {
        voiceRec.abort();
      } catch {}
      voiceRecognitionRef.current = null;
    };
  }, [voiceMode, locale]); // Ne pas dépendre de recording pour éviter les recréations


  function startMeter() {
    if (meterRafRef.current) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return;
    }
    navigator.mediaDevices.getUserMedia({ 
      audio: { 
        noiseSuppression: true, 
        echoCancellation: true, 
        autoGainControl: true 
      } 
    }).then((stream) => {
      meterStreamRef.current = stream;
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;
      const buf = new Float32Array(analyser.fftSize);
      dataArrayRef.current = buf;

      const tick = () => {
        const a = analyserRef.current;
        const dataLocal = dataArrayRef.current;
        if (!a || !dataLocal) return;
        const d = dataLocal as unknown as Float32Array;
        (a as unknown as { getFloatTimeDomainData: (arr: Float32Array) => void }).getFloatTimeDomainData(d);
        let sum = 0;
        for (const sample of d as unknown as Float32Array) {
          const v = typeof sample === 'number' ? sample : 0;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / d.length);
        const level = Math.max(0, Math.min(1, rms * 2));
        setMeterLevel(level);
        meterRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    }).catch((err) => {
      // Ignorer silencieusement si l'utilisateur a refusé ou si c'est une erreur de permission
      // Le meter ne s'affichera simplement pas
      console.warn("Impossible d'accéder au microphone pour le meter:", err);
    });
  }

  function stopMeter() {
    if (meterRafRef.current) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    try {
      meterStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    meterStreamRef.current = null;
    try {
      audioCtxRef.current?.close?.();
    } catch {}
    audioCtxRef.current = null;
    analyserRef.current = null;
    dataArrayRef.current = null;
    setMeterLevel(0);
  }

  const currentSteps = useMemo<StepDef[] | null>(() => {
    if (!intent) return null;
    if (intent === "SOS") {
      if (!subIntent) return null;
      return SOS_FLOWS[subIntent as SosSubIntent];
    }
    if (intent === "HOME" || intent === "fallback") return null;
    return NON_SOS_FLOWS[intent as ActionableIntent] || null;
  }, [intent, subIntent]);

  function handleSelectIntent(i: Intent) {
    emitTelemetry({ type: "intent", intent: i });
    if (i === "SOS") {
      setIntent("SOS");
      setScreen("sos");
    } else {
      setIntent(i);
      setSubIntent(null);
      setStepIndex(0);
      setScreen("chat");
    }
  }

  function handleSelectSubIntent(s: Exclude<SubIntent, null>) {
    emitTelemetry({ type: "subIntent", intent: "SOS", subIntent: s });
    setSubIntent(s);
    setStepIndex(0);
    setScreen("chat");
  }

  async function handleChoiceSelect(value: string) {
    const stepDef = currentSteps?.[stepIndex];
    if (!intent || !stepDef) return;
    const step = stepIndex + 1;
    const choice = stepDef.choices.find((c) => c.value === value);
    const chatInput = choice?.label || value;
    let outIntent: Intent = intent;
    let outSub: Exclude<SubIntent, null> | undefined = subIntent || undefined;
    if (value === "fallback") {
      outIntent = "fallback" as Intent;
      outSub = undefined;
      addProgress("Besoin d’assistance supplémentaire");
    } else if (intent !== "SOS") {
      // Dans les parcours non-SOS, la valeur choisie est le subIntent métier
      outSub = value as Exclude<SubIntent, null>;
    }
    emitTelemetry({ type: "action", intent: outIntent, subIntent: outSub, step });
    await sendAction({ intent: outIntent, subIntent: outSub, step, text: chatInput });

    // Keyword safety banner
    const maybeUrl = keywordBannerUrlFor(chatInput);
    setShowBannerUrl(maybeUrl);

    // Advance step or finalize
    const next = stepIndex + 1;
    const total = currentSteps?.length ?? 0;
    if (next < total) {
      setStepIndex(next);
    } else {
      // After final step, we stay in chat, allow more actions
      setStepIndex(next);
    }
  }

  function handleBack() {
    if (screen === "chat" && stepIndex > 0) {
      setStepIndex((s) => Math.max(0, s - 1));
      return;
    }
    if (screen === "chat" && intent === "SOS" && !subIntent) {
      setScreen("sos");
      return;
    }
    if (screen === "sos") {
      setScreen("home");
      return;
    }
    // Si on est déjà à l'écran home, on essaie de revenir à WeWeb
    if (screen === "home") {
      // Préparer le message pour WeWeb
      const message = { 
        type: 'ernest:back', 
        action: 'navigate',
        target: 'SOS'
      };
      
      console.log('Tentative de navigation vers SOS depuis WeWeb');
      
      // Essayer toutes les méthodes de communication possibles
      try {
        // Méthode 1 : postMessage vers window.parent (iframe standard)
        if (window.parent && window.parent !== window) {
          try {
            window.parent.postMessage(message, '*');
            console.log('Message postMessage envoyé à window.parent');
          } catch (e) {
            console.log('postMessage vers window.parent a échoué:', e);
          }
        }
        
        // Méthode 2 : postMessage vers window.top (iframe imbriqué)
        if (window.top && window.top !== window && window.top !== window.parent) {
          try {
            window.top.postMessage(message, '*');
            console.log('Message postMessage envoyé à window.top');
          } catch (e) {
            console.log('postMessage vers window.top a échoué:', e);
          }
        }
        
        // Méthode 3 : Événement personnalisé sur window (pour WeWeb qui écoute directement)
        try {
          const event = new CustomEvent('ernest:back', { 
            detail: { target: 'SOS' },
            bubbles: true,
            cancelable: true
          });
          window.dispatchEvent(event);
          console.log('Événement ernest:back déclenché sur window');
        } catch (e) {
          console.log('dispatchEvent sur window a échoué:', e);
        }
        
        // Méthode 4 : Événement personnalisé sur window.parent (si accessible)
        if (window.parent && window.parent !== window) {
          try {
            window.parent.dispatchEvent(new CustomEvent('ernest:back', { 
              detail: { target: 'SOS' },
              bubbles: true,
              cancelable: true
            }));
            console.log('Événement ernest:back déclenché sur window.parent');
          } catch (e) {
            console.log('dispatchEvent sur window.parent a échoué:', e);
          }
        }
        
        // Méthode 5 : Vérifier si on peut accéder à window.parent.location (pour navigation directe)
        // Note: Cela peut ne pas fonctionner à cause de la politique de même origine
        try {
          if (window.parent && window.parent !== window && window.parent.location) {
            // Ne pas essayer de modifier directement, juste vérifier l'accès
            console.log('window.parent.location accessible');
          }
        } catch (e) {
          console.log('Accès à window.parent.location bloqué (normal pour cross-origin)');
        }
        
      } catch (e) {
        console.error('Erreur lors de la communication avec WeWeb:', e);
      }
      return;
    }
    setScreen("home");
    setIntent(null);
    setSubIntent(null);
    setStepIndex(0);
  }

  function handleHome() {
    setScreen("home");
    setIntent(null);
    setSubIntent(null);
    setStepIndex(0);
  }

  const conversation: ChatMessage[] = useMemo(() => {
    return messages;
  }, [messages]);

  // Associer les fichiers en attente au dernier message utilisateur
  useEffect(() => {
    if (pendingFilesRef.current && messages.length > 0) {
      // Trouver le dernier message utilisateur qui n'a pas encore de fichiers associés
      const userMessages = messages.filter(m => m.role === "user");
      const lastUserMessage = userMessages[userMessages.length - 1];
      
      if (lastUserMessage && pendingFilesRef.current) {
        console.log('Association des fichiers au message:', lastUserMessage.ts, 'texte:', lastUserMessage.text);
        console.log('Fichiers à associer:', pendingFilesRef.current.length, 'fichiers');
        
        // Sauvegarder les fichiers avant de les ajouter (copie profonde)
        const filesToAdd = pendingFilesRef.current.map(f => ({ ...f }));
        
        setMessageFiles((prev) => {
          console.log('setMessageFiles callback - prev:', prev);
          // Vérifier si le message a déjà des fichiers dans le state actuel
          if (prev[lastUserMessage.ts]) {
            console.log('Le message a déjà des fichiers, nettoyage du ref');
            pendingFilesRef.current = null;
            return prev;
          }
          
          // Créer un nouvel objet avec les fichiers (nouvelle référence obligatoire)
          const newObj = { ...prev };
          newObj[lastUserMessage.ts] = filesToAdd;
          console.log('✅ Fichiers associés avec succès! Nouvel objet:', newObj);
          console.log('Vérification: newObj[lastUserMessage.ts] =', newObj[lastUserMessage.ts]);
          console.log('Nombre de clés dans newObj:', Object.keys(newObj).length);
          pendingFilesRef.current = null;
          return newObj;
        });
      }
    }
  }, [messages]);

  function pickMime(): string {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4",
    ];
    for (const t of candidates) {
      const anyWindow = window as unknown as { MediaRecorder?: { isTypeSupported?: (type: string) => boolean } };
      if (anyWindow.MediaRecorder?.isTypeSupported?.(t)) return t;
    }
    return "audio/webm";
  }

  async function startRec() {
    try {
      // Vérifier si on est dans une iframe (WeWeb)
      const isInIframe = window.self !== window.top;
      
      // Si on est dans une iframe, on NE DOIT PAS utiliser getUserMedia ici
      // La permission doit être gérée par le parent (WeWeb)
      if (isInIframe) {
        console.log("⚠️ Détection iframe : on ne peut pas utiliser getUserMedia dans l'iframe");
        console.log("ℹ️ La permission micro doit être gérée par WeWeb (parent)");
        setVoiceStatus("⚠️ Mode voix dans iframe : la permission micro doit être gérée par WeWeb");
        setRecording(false);
        return;
      }
      
      // Si on n'est PAS dans une iframe (app standalone), on peut utiliser getUserMedia normalement
      console.log("✅ Mode standalone : utilisation normale de getUserMedia");
      
      // Détecter Safari
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || 
                       (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome'));
      
      // Vérifier si getUserMedia est disponible
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setVoiceStatus("Votre navigateur ne supporte pas l'enregistrement audio. Veuillez utiliser un navigateur moderne.");
        setRecording(false);
        return;
      }

      // Réinitialiser la transcription
      setVoiceTranscription("");
      
      // Vérifier d'abord si la permission est déjà accordée (via l'API Permissions)
      // Note: On ne bloque PAS si l'API dit "denied" car getUserMedia peut quand même fonctionner
      let permissionStatus: PermissionState | null = null;
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          permissionStatus = result.state;
          console.log("🔍 État de la permission micro (API Permissions):", permissionStatus);
          
          if (permissionStatus === "denied") {
            console.warn("⚠️ API Permissions indique 'denied', mais on essaie quand même getUserMedia");
          }
        }
      } catch (e) {
        console.log("ℹ️ API Permissions non disponible, on continue avec getUserMedia...");
      }
      
      // Demander l'accès au microphone (seulement en mode standalone)
      let stream: MediaStream;
      
      try {
        console.log("🎤 Demande d'accès au microphone (mode standalone)...");
        
        // Essayer d'abord avec les contraintes optimisées
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            } 
          });
          console.log("✅ Stream audio obtenu avec contraintes optimisées");
        } catch (constraintError: any) {
          // Si les contraintes ne sont pas supportées, essayer sans contraintes
          if (constraintError.name === "OverconstrainedError" || constraintError.name === "ConstraintNotSatisfiedError") {
            console.log("⚠️ Contraintes audio non supportées, essai sans contraintes...");
            stream = await navigator.mediaDevices.getUserMedia({ 
              audio: true
            });
            console.log("✅ Stream audio obtenu sans contraintes");
          } else {
            throw constraintError;
          }
        }
        
        console.log("✅ Stream audio obtenu avec succès");
        console.log("📊 Stream tracks:", stream.getTracks().length);
      } catch (e: any) {
        console.error("❌ Erreur lors de l'obtention du stream:", e);
        console.error("📋 Détails de l'erreur:", {
          name: e.name,
          message: e.message,
          constraint: e.constraint,
          stack: e.stack
        });
        
        // Gérer les différents types d'erreurs avec des messages plus clairs
        if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
          // Message plus détaillé pour aider l'utilisateur
          const isInIframe = window.self !== window.top;
          const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || 
                           (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome'));
          
          console.error("🚫 Permission refusée - isInIframe:", isInIframe, "isSafari:", isSafari);
          
          // Vérifier si c'est une erreur de Permissions Policy
          const isPermissionsPolicyError = e.message?.includes("Permissions policy") || 
                                          e.message?.includes("not allowed in this document") ||
                                          e.message?.includes("Feature Policy");
          
          if (isPermissionsPolicyError || (isInIframe && e.message?.includes("Permission denied"))) {
            // Erreur de Permissions Policy - l'attribut allow="microphone" n'est pas correctement configuré
            let policyMessage = "⚠️ Permissions Policy bloque l'accès au microphone.\n\n";
            policyMessage += "Dans WeWeb, vérifiez que l'iframe a bien :\n";
            policyMessage += "• allow='microphone'\n";
            policyMessage += "• Ou allow='microphone *'\n";
            policyMessage += "• Dans les attributs HTML de l'iframe\n\n";
            policyMessage += "Si c'est déjà configuré, rechargez la page.";
            
            setVoiceStatus(policyMessage);
            setRecording(false);
            return;
          }
          
          // Message spécifique pour Safari dans une iframe
          if (isSafari && isInIframe) {
            let safariMessage = "⚠️ Safari bloque l'accès au microphone dans les iframes.\n\n";
            safariMessage += "Solutions :\n";
            safariMessage += "1. Utilisez Chrome ou Firefox\n";
            safariMessage += "2. Ou ouvrez l'application directement (sans iframe)\n";
            safariMessage += "3. Ou autorisez le microphone dans Réglages > Safari > Microphone";
            
            setVoiceStatus(safariMessage);
            setRecording(false);
            return;
          }
          
          // Message générique pour les autres navigateurs
          let helpMessage = "⚠️ Permission micro refusée dans l'iframe.\n\n";
          helpMessage += "Pour résoudre ce problème :\n";
          helpMessage += "1. Cliquez sur l'icône 🔒 dans la barre d'adresse\n";
          helpMessage += "2. Trouvez 'Microphone' et changez à 'Autoriser'\n";
          helpMessage += "3. Rechargez la page (F5)\n";
          helpMessage += "4. Réessayez";
          
          setVoiceStatus(helpMessage);
          setRecording(false);
          return;
        } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
          setVoiceStatus("Aucun microphone détecté sur votre appareil");
          setRecording(false);
          return;
        } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
          setVoiceStatus("Microphone déjà utilisé par une autre application. Fermez les autres applications qui utilisent le micro.");
          setRecording(false);
          return;
        } else {
          // Autre erreur
          setVoiceStatus(`Erreur d'accès au microphone: ${e.message || e.name}`);
          setRecording(false);
          return;
        }
      }
      const mimeType = pickMime();
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType });
      mrRef.current = mr;
      setRecording(true);
      setVoiceStatus("Enregistrement…");
      
      // Démarrer aussi l'analyseur audio pour le meterLevel
      startMeter();
      
      // Démarrer la transcription vocale si disponible
      // Attendre un peu pour s'assurer que le stream audio est prêt
      setTimeout(() => {
        const voiceRec = voiceRecognitionRef.current;
        if (voiceRec && voiceMode) {
          try {
            voiceRec.start();
            console.log("Transcription démarrée depuis startRec");
          } catch (err: any) {
            // Si déjà démarrée, c'est OK
            if (err.name === "InvalidStateError" || err.message?.includes("already started")) {
              console.log("Transcription déjà démarrée");
            } else {
              console.warn("Impossible de démarrer la transcription:", err);
            }
          }
        }
      }, 100);
      
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        try {
          // Ne rien faire ici - l'envoi sera géré par stopAndSendTranscription
          // On garde juste le cleanup
        } catch (e) {
          setVoiceStatus("Erreur d'envoi");
        } finally {
          // Le cleanup sera fait dans stopAndSendTranscription
        }
      };
      mr.start(250);
    } catch (e: any) {
      console.error("Erreur accès microphone:", e);
      setRecording(false);
      stopMeter();
      
      // Messages d'erreur plus précis selon le type d'erreur
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        const isInIframe = window.self !== window.top;
        if (isInIframe) {
          setVoiceStatus("⚠️ Iframe non autorisée - Ajoutez allow='microphone'");
        } else {
          setVoiceStatus("Autorisation microphone refusée - Vérifiez les paramètres du navigateur");
        }
      } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
        setVoiceStatus("Aucun microphone détecté");
      } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
        setVoiceStatus("Microphone déjà utilisé par une autre application");
      } else if (e.name === "OverconstrainedError" || e.name === "ConstraintNotSatisfiedError") {
        setVoiceStatus("Paramètres microphone non supportés");
      } else {
        setVoiceStatus("Erreur d'accès au microphone");
      }
    }
  }

  async function stopRec() {
    // Arrêter l'enregistrement et afficher le texte transcrit (sans envoyer)
    await stopTranscription();
  }

  async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 12000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  }

  async function sendAudio(blob: Blob) {
    if (!blob || !webhookUrl) {
      setVoiceStatus("Audio capturé");
      return;
    }
    try {
      const fd = new FormData();
      const fileName = blob.type.includes("ogg") ? "voice.ogg" : blob.type.includes("mp4") ? "voice.m4a" : "voice.webm";
      fd.append("audio", blob, fileName);
      fd.append("sessionId", sessionId);
      // Ajout d'un meta minimal côté audio (avant transcription serveur)
      const audioMeta = {
        intent: intent || ("fallback" as Intent),
        subIntent: (subIntent ?? null) as SubIntent,
        step: stepIndex > 0 ? stepIndex : 1,
      };
      fd.append("chatInput", "🎤 Message vocal");
      fd.append("meta", JSON.stringify(audioMeta));

      const res = await fetchWithTimeout(webhookUrl, { method: "POST", body: fd });
      const raw = await res.text();
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        data = { answer: raw };
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      emitTelemetry({ type: "voice_sent", intent: intent || undefined, subIntent: subIntent || undefined, step: stepIndex });
      
      // Utiliser la transcription locale si disponible, sinon celle du serveur
      const localTranscript = voiceTranscription.replace(/\s*\[.*\]$/, "").trim();
      const serverTranscript = data?.transcript ? String(data.transcript) : null;
      const finalTranscript = localTranscript || serverTranscript || "🎤 Message vocal envoyé";
      
      // Ajout du message utilisateur avec la transcription
      const userText = finalTranscript;
      
      // Essai de mapping manuel côté client si transcript présent
      if (finalTranscript && finalTranscript !== "🎤 Message vocal envoyé") {
        const mapped = mapTextToMeta(finalTranscript);
        if (mapped) {
          // On envoie explicitement l'intent/subIntent si identifiable
          const effStep = stepIndex > 0 ? stepIndex : 1;
          await sendAction({ intent: mapped.intent, subIntent: mapped.subIntent, step: effStep, text: finalTranscript });
        }
      }
      
      appendUser(userText);
      // Ajouter la réponse assistant (gestion des tableaux)
      if (data?.answer) {
        let answer = data.answer;
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
                appendAssistant(trimmedMsg);
              }, index * 2000); // Délai de 2 secondes entre chaque message
            }
          });
        } else {
          appendAssistant(String(answer));
        }
      }
      
      // Fermer le mode voix et réinitialiser
      setVoiceMode(false);
      setVoiceTranscription("");
      setVoiceStatus("Prêt");
    } catch (e) {
      setVoiceStatus("Service indisponible");
    }
  }

  return (
    <section ref={containerRef} className="flex h-screen w-full flex-col bg-white text-[16px] md:text-[19px] overflow-hidden">
      <TopBar
        onBack={handleBack}
        onMenu={() => { /* menu plus tard */ }}
        onReset={() => {
          reset();
          setIntent(null);
          setSubIntent(null);
          setStepIndex(0);
          setShowBannerUrl(null);
          setAttachedFiles([]);
          setComposerText("");
          emitTelemetry({ type: "reset" });
        }}
      />

      {/* Home screen top section supprimée pour placer les boutons en bas */}
      {false && screen === "home" && <div />}

      {/* SOS submenu top section supprimée pour placer les boutons en bas */}
      {false && screen === "sos" && <div />}

      {/* Conversation area - toujours visible */}
      <div className="flex flex-1 flex-col gap-3 md:gap-5 px-3 md:px-6 py-4 md:py-3 overflow-y-auto min-h-0 pb-8 md:pb-4">
          {/* Message central d'accueil */}
          {conversation.length === 0 && (
            <div className="flex w-full flex-1 items-center justify-center pt-8 md:pt-12">
              <p className="w-full max-w-screen-sm md:max-w-screen-md text-center text-gray-900 text-[15px] md:text-[18px] font-normal">
                Sélectionnez un sujet et commençons.
              </p>
            </div>
          )}
          {/* Safety banner */}
          {showBannerUrl && (
            <div className="mx-auto w-full max-w-screen-sm md:max-w-screen-md rounded-xl bg-amber-50 p-4 md:p-5 text-amber-900 ring-1 ring-inset ring-amber-200">
              <div className="mb-2 md:mb-3 font-semibold text-[16px] md:text-[18px]">Pour votre sécurité, utilisez les canaux officiels.</div>
              <a
                href={showBannerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] md:min-h-[48px] items-center justify-center rounded-lg bg-amber-600 px-4 md:px-5 py-2 md:py-2.5 text-[16px] md:text-[18px] text-white hover:bg-amber-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
              >
                Ouvrir le site officiel
              </a>
            </div>
          )}

          {(currentSteps?.[stepIndex]) && (
            <div className="mx-auto flex w-full max-w-screen-sm md:max-w-screen-md flex-col gap-3 md:gap-4">
              <Bubble role="assistant">{currentSteps![stepIndex]!.question}</Bubble>
              <ChoiceGroup step={stepIndex + 1} choices={currentSteps![stepIndex]!.choices} onSelect={handleChoiceSelect} />
            </div>
          )}

          <div className="mx-auto flex w-full max-w-screen-sm md:max-w-screen-md flex-col gap-2.5 md:gap-4" role="log" aria-live="polite" aria-relevant="additions">
            {(() => {
              console.log('Rendu de la conversation - messageFiles state:', messageFiles);
              return null;
            })()}
            {conversation.map((m, idx) => {
              const filesForMessage = m.role === "user" ? messageFiles[m.ts] : undefined;
              if (m.role === "user") {
                console.log('Message utilisateur:', m.ts, 'texte:', m.text, 'fichiers trouvés:', filesForMessage ? filesForMessage.length : 0);
                if (filesForMessage && filesForMessage.length > 0) {
                  console.log('✅ Fichiers pour ce message:', filesForMessage);
                } else {
                  console.log('❌ Aucun fichier trouvé pour ce message. Objet complet:', messageFiles);
                }
              }
              // Récupérer l'image de profil depuis localStorage si disponible
              const profileImage = typeof window !== 'undefined' ? localStorage.getItem('user_profile_image') : undefined;
              const userName = typeof window !== 'undefined' ? localStorage.getItem('user_name') || 'U' : 'U';
              
              return (
                <Bubble 
                  key={idx + m.ts} 
                  role={m.role} 
                  attachedFiles={filesForMessage}
                  showAvatar={m.role === "user"}
                  profileImage={m.role === "user" ? profileImage || undefined : undefined}
                  userName={m.role === "user" ? userName : undefined}
                >
                  {m.text}
                </Bubble>
              );
            })}
            {loading && (
              <div className="mr-auto inline-flex items-center gap-2 md:gap-3 rounded-2xl bg-gray-100 px-4 md:px-5 py-3 md:py-3.5 text-gray-900 text-[16px] md:text-[18px] ring-1 ring-inset ring-gray-200">
                <span>Ernest réfléchit</span>
                <span className="inline-flex gap-1 md:gap-1.5">
                  <span className="h-2 w-2 md:h-2.5 md:w-2.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 md:h-2.5 md:w-2.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 md:h-2.5 md:w-2.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            )}
            {error && (
              <div className="mr-auto rounded-2xl bg-red-50 px-4 md:px-5 py-3 md:py-3.5 text-red-800 text-[16px] md:text-[18px] ring-1 ring-inset ring-red-200">
                {error} <button onClick={clearError} className="ml-2 underline">OK</button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

      {/* Boutons juste au-dessus de l'input (bas de page) */}
      <div className="px-3 md:px-6">
        {screen === "home" && composerText.length === 0 && conversation.length === 0 && attachedFiles.length === 0 && (
          <div className="mx-auto mb-2 md:mb-3 mt-16 md:mt-20 w-full max-w-screen-sm md:max-w-screen-md">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-2.5">
              {ALL_INTENTS.map((i) => (
                <button
                  key={i.key}
                  type="button"
                  onClick={() => handleSelectIntent(i.key)}
                  className="inline-flex min-h-[36px] md:min-h-[40px] items-center justify-center rounded-xl bg-white px-2.5 md:px-3 py-1.5 md:py-2 text-[14px] md:text-[15px] text-gray-800 shadow-sm ring-1 ring-inset ring-gray-200 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
                >
                  {i.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {screen === "sos" && (
          <div className="mx-auto mb-2 md:mb-3 w-full max-w-screen-sm md:max-w-screen-md">
            <div className="grid grid-cols-2 md:grid-cols-2 gap-2 md:gap-3">
              {SOS_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => handleSelectSubIntent(o.key)}
                  className="inline-flex min-h-[44px] md:min-h-[52px] items-center justify-center rounded-2xl bg-white px-3 md:px-4 py-2 md:py-2.5 text-[16px] md:text-[17px] text-gray-800 shadow-sm ring-1 ring-inset ring-gray-200 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom composer present on all screens */}
      <Composer
        value={composerText}
        onChange={(v) => setComposerText(v)}
        onSend={async () => {
          const msg = composerText.replace(/\s*\[.*\]$/, "").trim();
          if (!msg && attachedFiles.length === 0) return;
          
          emitTelemetry({ type: "text_send", intent: intent || undefined, subIntent: subIntent || undefined, step: stepIndex });
          
          // Si des fichiers sont joints, les envoyer avec le message
          if (attachedFiles.length > 0) {
            // Créer des prévisualisations pour les fichiers (extraire les données nécessaires)
            const filesWithPreviews: FilePreview[] = [];
            const previewPromises = attachedFiles.map((file) => {
              return new Promise<void>((resolve) => {
                if (file.type.startsWith('image/')) {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    filesWithPreviews.push({ 
                      name: file.name,
                      size: file.size,
                      type: file.type,
                      previewUrl: e.target?.result as string 
                    });
                    resolve();
                  };
                  reader.onerror = () => {
                    filesWithPreviews.push({ 
                      name: file.name,
                      size: file.size,
                      type: file.type,
                      previewUrl: null 
                    });
                    resolve();
                  };
                  reader.readAsDataURL(file);
                } else {
                  filesWithPreviews.push({ 
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    previewUrl: null 
                  });
                  resolve();
                }
              });
            });

            // Attendre que toutes les prévisualisations soient créées
            await Promise.all(previewPromises);

            // Créer un FormData pour envoyer les fichiers
            const formData = new FormData();
            formData.append("sessionId", sessionId);
            formData.append("chatInput", msg || "Fichiers joints");
            
            attachedFiles.forEach((file, index) => {
              formData.append(`file_${index}`, file);
            });
            
            // Mapping texte → intent/subIntent
            const mapped = mapTextToMeta(msg);
            const effectiveIntent: Intent = mapped?.intent || ("fallback" as Intent);
            const effectiveSub: Exclude<SubIntent, null> | undefined = mapped?.subIntent || undefined;
            const effectiveStep = stepIndex > 0 ? stepIndex : 1;
            
            const audioMeta = {
              intent: effectiveIntent,
              subIntent: (effectiveSub ?? null) as SubIntent,
              step: effectiveStep,
            };
            formData.append("meta", JSON.stringify(audioMeta));
            
            // Créer un timestamp avant d'ajouter le message pour synchroniser
            const messageTimestamp = Date.now();
            
            // Stocker les fichiers directement avec le timestamp (on l'utilisera après)
            console.log('Fichiers avec prévisualisations créés:', filesWithPreviews.length, 'fichiers');
            filesWithPreviews.forEach((f, i) => {
              console.log(`  Fichier ${i}: ${f.name}, type: ${f.type}, preview: ${f.previewUrl ? 'oui' : 'non'}`);
            });
            
            // Stocker les fichiers en attente
            pendingFilesRef.current = filesWithPreviews;
            
            // Afficher le message utilisateur (sans les noms de fichiers dans le texte, on les affiche visuellement)
            appendUser(msg || "📎 Fichiers joints");
            
            // Stocker le timestamp pour l'association ultérieure
            // Le useEffect se chargera de l'association quand le message sera ajouté
            
            // Envoyer avec les fichiers
            if (webhookUrl) {
              fetch(webhookUrl, {
                method: "POST",
                body: formData,
              })
                .then((res) => res.json())
                .then((data) => {
                  if (data?.answer) {
                    let answer = data.answer;
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
                            appendAssistant(trimmedMsg);
                          }, index * 2000); // Délai de 2 secondes entre chaque message
                        }
                      });
                    } else {
                      appendAssistant(String(answer));
                    }
                  }
                })
                .catch((err) => {
                  console.error("Erreur lors de l'envoi des fichiers:", err);
                });
            }
            
            // Nettoyer
            setAttachedFiles([]);
            setComposerText("");
            return;
          }
          
          // Envoi normal sans fichiers
          const mapped = mapTextToMeta(msg);
          const effectiveIntent: Intent = mapped?.intent || ("fallback" as Intent);
          const effectiveSub: Exclude<SubIntent, null> | undefined = mapped?.subIntent || undefined;
          const effectiveStep = stepIndex > 0 ? stepIndex : 1;
          sendAction({ intent: effectiveIntent, subIntent: effectiveSub, step: effectiveStep, text: msg });
          setComposerText("");
        }}
        onVoice={() => {
          // Envoyer un message au parent (WeWeb) pour demander la permission micro
          // Le parent gérera la permission et renverra "open_voice_mode" à React
          console.log("Demande de permission micro envoyée au parent (WeWeb)");
          
          try {
            // Essayer d'envoyer au parent
            if (window.parent && window.parent !== window) {
              window.parent.postMessage(
                { type: "request_mic_permission" },
                "*"
              );
            } else {
              // Si on n'est pas dans une iframe, ouvrir directement le mode voix
              console.log("Pas dans une iframe, ouverture directe du mode voix");
              setVoiceMode(true);
              emitTelemetry({ 
                type: "voice_open", 
                intent: intent || undefined, 
                subIntent: subIntent || undefined, 
                step: stepIndex 
              });
            }
          } catch (e) {
            console.error("Erreur lors de l'envoi du message au parent:", e);
            // Fallback : ouvrir directement le mode voix
            setVoiceMode(true);
            emitTelemetry({ 
              type: "voice_open", 
              intent: intent || undefined, 
              subIntent: subIntent || undefined, 
              step: stepIndex 
            });
          }
        }}
        onFileAttach={(files) => {
          setAttachedFiles((prev) => [...prev, ...files]);
        }}
        attachedFiles={attachedFiles}
        onRemoveFile={(index) => {
          setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
        }}
        onFocus={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
      />

      {/* Overlay Mode Voix amélioré - Moitié basse de l'écran seulement */}
      <VoiceModeOverlay
        isOpen={voiceMode}
        onClose={() => {
          setVoiceMode(false);
          setVoiceTranscription("");
          setFinalTranscription("");
          if (recording) {
            stopRec();
          }
        }}
        recording={recording}
        onStartRecording={startRec}
        onStopRecording={stopRec}
        onSendTranscription={sendTranscription}
        voiceStatus={voiceStatus}
        transcription={voiceTranscription.replace(/\s*\[.*\]$/, "")} // Nettoyer les [interim] pour l'affichage
        finalTranscription={finalTranscription}
        meterLevel={meterLevel}
        locale={locale}
      />
    </section>
  );
}



