import React, { useEffect, useMemo, useRef, useState } from "react";
import useErnest from "./hooks/useErnest";
import type { ErnestWidgetProps, Intent, SubIntent, SendActionArgs, ChatMessage } from "./types";
import { ariaButtonProps, onActivate, focusFirstInteractive } from "./utils/accessibility";

type Screen = "home" | "sos" | "chat";

const ALL_INTENTS: Array<{ key: Intent; label: string; icon: string }> = [
  { key: "SECURE_ACCOUNTS", label: "Je sécurise mes comptes en ligne", icon: "🔐" },
  { key: "CHECK_SCAM", label: "Je vérifie si c’est une arnaque", icon: "🕵️" },
  { key: "SECURE_DEVICE", label: "Je sécurise mes appareils", icon: "📱" },
  { key: "AWARENESS", label: "Je me sensibilise à la cybersécurité", icon: "💡" },
  { key: "SAFE_BROWSING", label: "Je veux naviguer en sécurité", icon: "🌐" },
  { key: "SOS", label: "🆘 J’ai besoin d’aide", icon: "🆘" },
];

const SOS_OPTIONS: Array<{ key: Exclude<SubIntent, null>; label: string }> = [
  { key: "ACCOUNT_TAKEOVER", label: "Mon compte a été piraté" },
  { key: "LOST_MONEY", label: "J’ai perdu de l’argent" },
  { key: "PHONE_STOLEN", label: "Mon téléphone est volé" },
  { key: "DATA_LEAK", label: "Mes données ont fuité" },
];

type Choice = { value: string; label: string };
type StepDef = { question: string; choices: Choice[] };

// Minimal flow definitions (can be extended)
const NON_SOS_FLOWS: Record<Exclude<Intent, "SOS" | "HOME">, StepDef[]> = {
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
        { value: "good_habits", label: "Les bons réflexes à adopter" },
        { value: "mistakes_to_avoid", label: "Les erreurs à éviter" },
        { value: "understand_scams", label: "Mieux comprendre les arnaques" },
        { value: "quiz", label: "Petit quiz pour s’entraîner" },
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

const SOS_FLOWS: Record<Exclude<SubIntent, null>, StepDef[]> = {
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
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-gray-300 bg-white p-5 text-center text-[18px] font-semibold shadow-sm transition hover:border-blue-500 hover:shadow focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 min-h-[88px]"
      aria-label={ariaLabel}
    >
      <span className="text-3xl" aria-hidden>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 shadow-sm ring-1 ring-inset ${
      isUser
        ? "ml-auto bg-blue-600 text-white ring-blue-500"
        : "mr-auto bg-gray-100 text-gray-900 ring-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
    }`}
      aria-live={isUser ? undefined : "polite"}
    >
      {children}
    </div>
  );
}

function ChoiceGroup({ step, choices, onSelect }: { step: number; choices: Choice[]; onSelect: (value: string) => void }) {
  return (
    <div role="group" aria-label={`Choix étape ${step}`} className="flex flex-wrap gap-3">
      {choices.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onSelect(c.value)}
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-4 py-3 text-[18px] font-medium ring-1 ring-inset ring-gray-300 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
          aria-label={c.label}
        >
          {c.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onSelect("fallback")}
        className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-4 py-3 text-[18px] font-medium ring-1 ring-inset ring-gray-300 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
        aria-label="Je n’y arrive pas"
      >
        Je n’y arrive pas
      </button>
    </div>
  );
}

function TopBar({ onBack, onMenu, onReset }: { onBack: () => void; onMenu: () => void; onReset: () => void }) {
  return (
    <header className="flex items-center justify-between px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        className="grid h-10 w-10 place-items-center rounded-full bg-gray-100 text-gray-700 shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
        aria-label="Retour"
      >
        <span aria-hidden>←</span>
      </button>
      <div className="text-[16px] font-semibold text-gray-900">Ernest</div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onReset}
          className="grid h-10 w-10 place-items-center rounded-full bg-gray-100 text-gray-700 shadow-sm transition hover:bg-gray-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
          aria-label="Effacer la conversation"
          title="Effacer la conversation"
        >
          <span aria-hidden>🗑️</span>
        </button>
        <button
          type="button"
          onClick={onMenu}
          className="grid h-10 w-10 place-items-center rounded-full bg-gray-100 text-gray-700 shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
          aria-label="Menu"
        >
          <span aria-hidden>≡</span>
        </button>
      </div>
    </header>
  );
}

function StickyBar({ onBack, onHome, onContact, onReminder }: { onBack: () => void; onHome: () => void; onContact: () => void; onReminder: () => void }) {
  return (
    <div className="sticky bottom-0 z-10 w-full border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
      <div className="mx-auto flex max-w-screen-lg items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="min-h-[48px] rounded-xl bg-gray-100 px-4 py-3 text-[18px] font-semibold shadow-sm transition hover:bg-gray-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300">
            ↩️ Retour
          </button>
          <button type="button" onClick={onHome} className="min-h-[48px] rounded-xl bg-gray-100 px-4 py-3 text-[18px] font-semibold shadow-sm transition hover:bg-gray-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300">
            🏠 Menu
          </button>
        </div>
        <div className="flex items-center gap-2">
          <a href="tel:3018" onClick={onContact} className="min-h-[48px] rounded-xl bg-green-600 px-4 py-3 text-[18px] font-semibold text-white shadow-sm transition hover:bg-green-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-300">
            📞 Contact
          </a>
          <button type="button" onClick={onReminder} className="min-h-[48px] rounded-xl bg-amber-100 px-4 py-3 text-[18px] font-semibold shadow-sm transition hover:bg-amber-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300">
            🔔 Rappel
          </button>
        </div>
      </div>
    </div>
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
  onMic: () => void;
  onVoice: () => void;
  onFocus?: () => void;
  listening?: boolean;
  meterLevel?: number;
};

function Composer({
  value,
  onChange,
  onSend,
  onMic,
  onVoice,
  onFocus,
  listening,
  meterLevel,
}: ComposerProps) {
  return (
    <div className="w-full px-4 py-3">
      <div className="mx-auto flex w-full max-w-screen-sm items-center gap-3 rounded-full bg-gray-100 px-4 py-3 text-gray-700">
        {listening ? (
          <div
            className="flex-1 inline-flex items-center gap-3 rounded-lg bg-white/70 px-3 py-2 ring-1 ring-inset ring-gray-300 text-gray-700 min-w-0"
            role="status"
            aria-live="polite"
            aria-label="Écoute en cours, parlez"
            title="Écoute en cours…"
          >
            <span className="text-red-600 animate-pulse">
              <MicIcon className="h-6 w-6" />
            </span>
            <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              {(() => {
                const match = value.match(/\[(.*)\]/);
                const interim = match?.[1]?.trim();
                return interim && interim.length > 0 ? interim : "En écoute… Parlez";
              })()}
            </span>
            <span className="ml-auto inline-flex items-end gap-1" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => {
                const level = Math.max(0, Math.min(1, (meterLevel || 0)));
                const activeBars = Math.round(level * 5);
                const isActive = i < activeBars;
                const heights = [8, 12, 16, 12, 8];
                return (
                  <span
                    key={i}
                    className={`w-1.5 rounded ${isActive ? 'bg-red-500' : 'bg-red-300/40'}`}
                    style={{ height: `${heights[i]}px` }}
                  />
                );
              })}
            </span>
          </div>
        ) : (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) onSend();
            }}
            placeholder="Posez votre question"
            aria-label="Posez votre question"
            className="flex-1 bg-transparent text-[16px] outline-none placeholder:text-gray-500"
          />
        )}
        <button
          type="button"
          onClick={onMic}
          className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-gray-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 ${listening ? "animate-pulse text-red-600" : ""}`}
          aria-label={listening ? "Arrêter la dictée" : "Démarrer la dictée"}
          title={listening ? "Écoute en cours…" : "Dicter un message"}
        >
          <MicIcon className="h-8 w-8" />
        </button>
        <button
          type="button"
          onClick={onVoice}
          className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-blue-600 text-white shadow-md transition hover:bg-blue-700 disabled:opacity-50"
          aria-label="Mode Voix"
        >
          <SendWavesIcon className="h-8 w-8" />
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
  const [listening, setListening] = useState(false);
  const [meterLevel, setMeterLevel] = useState(0);
  const recognitionRef = useRef<any>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const meterStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<any>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    if (containerRef.current) focusFirstInteractive(containerRef.current);
  }, [screen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, stepIndex, screen]);

  useEffect(() => {
    if (composerText.length > 0) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [composerText]);

  // Pas de message d'intro par défaut

  // Dictée Web Speech (navigateur)
  useEffect(() => {
    const anyWindow = window as any;
    const SpeechRecognition = anyWindow.SpeechRecognition || anyWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec: any = new SpeechRecognition();
    rec.lang = locale;
    rec.interimResults = true; // retours en temps réel
    rec.continuous = true; // reste en écoute jusqu’à stop
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      let interim = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += transcript;
        else interim += transcript;
      }
      setComposerText((prev) => {
        const base = prev.replace(/\s*\[.*\]$/, "");
        if (interim) return `${base} [${interim.trim()}]`;
        if (finalText) return `${base} ${finalText}`.trim();
        return prev;
      });
    };

    rec.onerror = () => {
      setListening(false);
      stopMeter();
    };
    rec.onspeechend = () => {
      try { rec.stop(); } catch {}
    };
    rec.onend = () => {
      setListening(false);
      stopMeter();
    };

    recognitionRef.current = rec;
    return () => {
      try { rec.abort(); } catch {}
    };
  }, [locale]);

  function toggleDictation() {
    const rec = recognitionRef.current;
    if (!rec) {
      alert("La dictée n’est pas supportée par ce navigateur. Essayez Chrome/Edge/Safari récents.");
      return;
    }
    if (!listening) {
      setListening(true);
      try { rec.start(); } catch {}
      startMeter();
    } else {
      setListening(false);
      try { rec.stop(); } catch {}
      // Nettoie les [interim]
      setComposerText((v) => v.replace(/\s*\[.*\]$/, ""));
      stopMeter();
    }
  }

  function startMeter() {
    if (meterRafRef.current) return;
    navigator.mediaDevices.getUserMedia({ audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: false } }).then((stream) => {
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
    }).catch(() => {
      // ignore if user denied; meter just won't show
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
      return SOS_FLOWS[subIntent];
    }
    return NON_SOS_FLOWS[intent as Exclude<Intent, "SOS" | "HOME">] || null;
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
    const text = `${stepDef.question} → ${value}`;
    if (value === "fallback") addProgress("Besoin d’assistance supplémentaire");
    emitTelemetry({ type: "action", intent, subIntent: subIntent || undefined, step });
    await sendAction({ intent, subIntent: subIntent || undefined, step, text });

    // Keyword safety banner
    const maybeUrl = keywordBannerUrlFor(text);
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMime();
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType });
      mrRef.current = mr;
      setRecording(true);
      setVoiceStatus("Enregistrement…");
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          chunksRef.current = [];
          await sendAudio(blob);
        } catch (e) {
          setVoiceStatus("Erreur d’envoi");
        } finally {
          stream.getTracks().forEach((t) => t.stop());
          setRecording(false);
        }
      };
      mr.start(250);
    } catch (e) {
      setVoiceStatus("Accès micro refusé");
      setRecording(false);
    }
  }

  function stopRec() {
    const mr = mrRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    setVoiceStatus("Envoi en cours…");
    // Revenir à la vue conversation dès l'arrêt
    setVoiceMode(false);
    setScreen("chat");
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
      // Ajout du message utilisateur: préférer la transcription si disponible
      const userText = data?.transcript ? String(data.transcript) : "🎤 Message vocal envoyé";
      appendUser(userText);
      // Ajouter la réponse assistant
      if (data?.answer) {
        appendAssistant(String(data.answer));
      }
      setVoiceStatus("Prêt");
    } catch (e) {
      setVoiceStatus("Service indisponible");
    }
  }

  return (
    <section ref={containerRef} className="flex h-dvh w-full flex-col bg-white text-[18px]">
      <TopBar
        onBack={handleBack}
        onMenu={() => { /* menu plus tard */ }}
        onReset={() => {
          reset();
          setIntent(null);
          setSubIntent(null);
          setStepIndex(0);
          setShowBannerUrl(null);
          emitTelemetry({ type: "reset" });
        }}
      />

      {/* Home screen top section supprimée pour placer les boutons en bas */}
      {false && screen === "home" && <div />}

      {/* SOS submenu top section supprimée pour placer les boutons en bas */}
      {false && screen === "sos" && <div />}

      {/* Conversation area - toujours visible */}
      <div className="flex flex-1 flex-col gap-4 px-4 py-2">
          {/* Message central d'accueil */}
          {conversation.length === 0 && (
            <div className="grid w-full flex-1 place-items-center">
              <div className="mx-auto max-w-screen-sm rounded-2xl bg-white px-4 py-3 text-center text-gray-700 shadow-sm ring-1 ring-inset ring-gray-200">
                Sélectionnez un thème ou tapez directement pour commencer.
              </div>
            </div>
          )}
          {/* Safety banner */}
          {showBannerUrl && (
            <div className="mx-auto w-full max-w-screen-sm rounded-xl bg-amber-50 p-4 text-amber-900 ring-1 ring-inset ring-amber-200">
              <div className="mb-2 font-semibold">Pour votre sécurité, utilisez les canaux officiels.</div>
              <a
                href={showBannerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
              >
                Ouvrir le site officiel
              </a>
            </div>
          )}

          {(currentSteps?.[stepIndex]) && (
            <div className="mx-auto flex w-full max-w-screen-sm flex-col gap-3">
              <Bubble role="assistant">{currentSteps![stepIndex]!.question}</Bubble>
              <ChoiceGroup step={stepIndex + 1} choices={currentSteps![stepIndex]!.choices} onSelect={handleChoiceSelect} />
            </div>
          )}

          <div className="mx-auto flex w-full max-w-screen-sm flex-col gap-3" role="log" aria-live="polite" aria-relevant="additions">
            {conversation.map((m, idx) => (
              <Bubble key={idx + m.ts} role={m.role}>{m.text}</Bubble>
            ))}
            {loading && (
              <div className="mr-auto inline-flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-3 text-gray-900 ring-1 ring-inset ring-gray-200">
                <span>Ernest réfléchit</span>
                <span className="inline-flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            )}
            {error && (
              <div className="mr-auto rounded-2xl bg-red-50 px-4 py-3 text-red-800 ring-1 ring-inset ring-red-200">
                {error} <button onClick={clearError} className="ml-2 underline">OK</button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

      {/* Boutons juste au-dessus de l'input (bas de page) */}
      <div className="px-4">
        {screen === "home" && (
          <div className="mx-auto mb-2 w-full max-w-screen-sm">
            <div className="grid grid-cols-2 gap-2">
              {ALL_INTENTS.map((i) => (
                <button
                  key={i.key}
                  type="button"
                  onClick={() => handleSelectIntent(i.key)}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-white px-3 py-2 text-[16px] text-gray-800 shadow-sm ring-1 ring-inset ring-gray-200 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
                >
                  {i.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {screen === "sos" && (
          <div className="mx-auto mb-2 w-full max-w-screen-sm">
            <div className="grid grid-cols-2 gap-2">
              {SOS_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => handleSelectSubIntent(o.key)}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-white px-3 py-2 text-[16px] text-gray-800 shadow-sm ring-1 ring-inset ring-gray-200 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
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
        onSend={() => {
          const msg = composerText.replace(/\s*\[.*\]$/, "").trim();
          if (!msg) return;
          emitTelemetry({ type: "text_send", intent: intent || undefined, subIntent: subIntent || undefined, step: stepIndex });
          // Envoie en texte libre côté API
          sendAction({ intent: intent || "HOME", subIntent: subIntent || undefined, step: stepIndex, text: msg });
          setComposerText("");
        }}
        onMic={() => {
          toggleDictation();
          emitTelemetry({ type: listening ? "dictation_stop" : "dictation_start", intent: intent || undefined, subIntent: subIntent || undefined, step: stepIndex });
        }}
        onVoice={() => {
          setVoiceMode(true);
          emitTelemetry({ type: "voice_open", intent: intent || undefined, subIntent: subIntent || undefined, step: stepIndex });
        }}
        listening={listening}
        meterLevel={meterLevel}
        onFocus={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
      />

      {voiceMode && (
        <div className="fixed inset-0 z-50 flex flex-col voice-overlay-enter" role="dialog" aria-label="Mode Voix">
          {/* Dégradé de fond */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#4db1ff] to-[#cfe8ff] voice-overlay-bg" />

          {/* Top bar */}
          <div className="relative flex items-center justify-between px-4 py-4 text-white/90">
            <button
              type="button"
              onClick={() => setVoiceMode(false)}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/20 backdrop-blur"
              aria-label="Fermer"
            >
              ←
            </button>
            <div className="text-left">
              <div className="text-[16px] font-semibold">Mode Voix</div>
              <div className="text-[12px] opacity-90">Ernest - Mode Voix • {voiceStatus}</div>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white/20 backdrop-blur" aria-hidden>≡</div>
          </div>

          {/* Cercle animé */}
          <div className="relative mx-auto mt-10 grid max-w-sm flex-1 place-items-center">
            <div className="relative h-72 w-72">
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,102,255,0.9),rgba(0,102,255,0.4)_40%,transparent_70%)] blur-[2px]" />
              {/* Anneaux tournants */}
              <div className="voice-arc voice-arc-1 voice-arc-spin" />
              <div className="voice-arc voice-arc-2 voice-arc-spin" />
              <div className="voice-arc voice-arc-3 voice-arc-spin" />
              <div className="absolute inset-10 grid place-items-center text-center text-white">
                <div className="text-2xl font-semibold">Ernest</div>
                <div className="mt-2 text-md opacity-90">Votre guide intelligent pour une aide vocale immédiate.</div>
              </div>
            </div>
          </div>

          {/* Bouton micro principal */}
          <div className="relative mx-auto mb-16 grid place-items-center mic-pop">
            <button
              type="button"
              onClick={() => (recording ? stopRec() : startRec())}
              className={`group relative grid h-36 w-36 place-items-center rounded-full text-white shadow-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60 ${recording ? "bg-gradient-to-b from-[#ff6b6b] to-[#e02424] animate-pulse" : "bg-gradient-to-b from-[#3aa0ff] to-[#1677ff]"}`}
              aria-label="Appuyer pour parler"
            >
              {recording && (
                <span
                  className="absolute -inset-4 -z-20 rounded-full bg-red-400/20 animate-ping"
                  aria-hidden
                />
              )}
              <span className="absolute inset-0 -z-10 rounded-full bg-white/40 blur-xl transition group-hover:scale-110" />
              <span className="absolute inset-2 rounded-full bg-white/20" />
              {/* Remplissage dégradé façon maquette (halo clair en haut, plus dense au centre) */}
              <span className={`absolute inset-6 rounded-full ring-1 ring-white/40 shadow-[inset_0_8px_20px_rgba(255,255,255,.45)] ${recording ? 'bg-[radial-gradient(ellipse_at_30%_25%,#ffd8d8_0%,#ff8a8a_55%,#e02424_95%)]' : 'bg-[radial-gradient(ellipse_at_30%_25%,#d9efff_0%,#86c7ff_55%,#2a8df8_95%)]'}`} />
              {/* Lueur/éclat supérieur subtil */}
              <span className="absolute inset-6 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,0)_45%)] mix-blend-screen pointer-events-none" />
              <MicIcon className={`relative z-10 h-[60px] w-[60px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)] ${recording ? 'animate-pulse' : ''}`} />
            </button>
            <div className="mt-4 text-xl text-black/95">{recording ? "Appuyer pour arrêter" : "Appuyer pour parler"}</div>
          </div>
        </div>
      )}
    </section>
  );
}



