import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatMessage,
  ErnestApiRequest,
  ErnestApiResponse,
  ErnestHookReturn,
  ErnestState,
  SendActionArgs,
} from "../types";
import {
  SECOND_MESSAGE_INTERVAL_MS,
  splitSecondMessage,
} from "../utils/secondMessage";

const SESSION_KEY = "soscyber_session";
const MESSAGES_KEY = "soscyber_messages";
const PROGRESS_KEY = "soscyber_progress";

function getWebhookUrl(override?: string): string {
  const fromEnv = (import.meta as any)?.env?.VITE_ERNEST_WEBHOOK_URL as
    | string
    | undefined;
  return override || fromEnv || "/ernest/voice";
}

function useStableSessionId(): string {
  // Générer un nouveau sessionId à chaque chargement (pas de persistance)
  const [sessionId] = useState(() => {
    return crypto.randomUUID();
  });
  return sessionId;
}

// Désactivé : pas de persistance de la conversation pour l'instant
function persistState(state: ErnestState) {
  // localStorage.setItem(SESSION_KEY, state.sessionId);
  // localStorage.setItem(MESSAGES_KEY, JSON.stringify(state.messages));
  // localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress));
}

// Désactivé : pas de restauration de la conversation
function restoreState(defaultSessionId: string): ErnestState {
  // Nettoyer les données existantes dans le localStorage
  localStorage.removeItem(MESSAGES_KEY);
  localStorage.removeItem(PROGRESS_KEY);
  
  // Toujours retourner un état vide
  return { sessionId: defaultSessionId, messages: [], progress: [] };
  
  // Code désactivé :
  // const messagesRaw = localStorage.getItem(MESSAGES_KEY);
  // const progressRaw = localStorage.getItem(PROGRESS_KEY);
  // let messages: ChatMessage[] = [];
  // let progress: string[] = [];
  // try {
  //   messages = messagesRaw ? (JSON.parse(messagesRaw) as ChatMessage[]) : [];
  // } catch {}
  // try {
  //   progress = progressRaw ? (JSON.parse(progressRaw) as string[]) : [];
  // } catch {}
  // return { sessionId: defaultSessionId, messages, progress };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function postWithRetry(
  url: string,
  body: unknown
): Promise<ErnestApiResponse> {
  const payload = JSON.stringify(body);
  const headers = { "Content-Type": "application/json" };
  const TIMEOUT_MS = 60000; // 60 secondes pour permettre aux workflows n8n longs de se terminer

  async function attempt(): Promise<ErnestApiResponse> {
    let res: Response;
    try {
      res = await fetchWithTimeout(
        url,
        { method: "POST", headers, body: payload },
        TIMEOUT_MS
      );
    } catch (e: any) {
      // Gestion des erreurs réseau (CORS, timeout, réseau)
      if (e.name === 'AbortError') {
        throw new Error(`Le traitement prend plus de ${TIMEOUT_MS / 1000} secondes. Le workflow n8n est peut-être en cours d'exécution, veuillez patienter.`);
      }
      if (e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError')) {
        throw new Error("Impossible de joindre le serveur. Vérifiez votre connexion internet et que le webhook n8n est accessible.");
      }
      throw new Error(`Erreur réseau: ${e.message || 'Erreur inconnue'}`);
    }
    
    const text = await res.text();
    console.log("🔍 Réponse brute de n8n:", text.substring(0, 500) + (text.length > 500 ? "..." : ""));
    
    let data: any = {};
    
    // Vérifier d'abord si la réponse est vide
    if (!text || text.trim().length === 0) {
      console.error("❌ Réponse vide de n8n");
      throw new Error("Le serveur a renvoyé une réponse vide. Vérifiez la configuration du workflow n8n.");
    }
    
    // Nettoyer la réponse si elle contient des caractères invalides
    let cleanedText = text.trim();
    
    // Détecter et corriger les accolades doubles au début
    if (cleanedText.startsWith('{{')) {
      console.warn("⚠️ Détection d'accolades doubles au début, tentative de correction...");
      cleanedText = cleanedText.substring(1); // Enlever une accolade
    }
    
    try {
      data = JSON.parse(cleanedText);
      console.log("✅ JSON parsé avec succès:", data);
    } catch (e: any) {
      console.error("❌ Erreur de parsing JSON:", e);
      console.error("❌ Texte qui a échoué:", cleanedText.substring(0, 200));
      
      // Si le parsing échoue mais que la réponse HTTP est OK, on accepte le texte brut
      if (res.ok) {
        console.warn("⚠️ Réponse HTTP OK mais JSON invalide, utilisation du texte brut comme réponse");
        data = { answer: text };
      } else {
        // Si HTTP n'est pas OK, on lance une erreur
        throw new Error(`Le serveur a renvoyé un JSON invalide. Erreur: ${e.message}. Réponse reçue: ${cleanedText.substring(0, 100)}...`);
      }
    }
    
    if (!res.ok) {
      const message = data?.error?.message || data?.error || `HTTP ${res.status}: ${res.statusText}`;
      throw new Error(message);
    }
    
    console.log("📦 Données finales retournées:", data);
    return data as ErnestApiResponse;
  }

  try {
    return await attempt();
  } catch (e: any) {
    // One retry with exponential backoff (base ~1s)
    console.warn("⚠️ Première tentative échouée, nouvelle tentative dans ~1s...", e.message);
    await new Promise((r) => setTimeout(r, 1000 + Math.floor(Math.random() * 300)));
    try {
      return await attempt();
    } catch (retryError: any) {
      // Si la deuxième tentative échoue aussi, on lance l'erreur
      throw retryError;
    }
  }
}

export function useErnest(webhookOverride?: string): ErnestHookReturn {
  const baseSessionId = useStableSessionId();
  const [{ sessionId, messages, progress }, setState] = useState<ErnestState>(
    () => restoreState(baseSessionId)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const webhookUrl = useMemo(() => getWebhookUrl(webhookOverride), [webhookOverride]);

  const stateRef = useRef<ErnestState>({ sessionId, messages, progress });
  useEffect(() => {
    stateRef.current = { sessionId, messages, progress };
  }, [sessionId, messages, progress]);

  // Persist whenever state changes - DÉSACTIVÉ pour l'instant
  // useEffect(() => {
  //   persistState({ sessionId, messages, progress });
  // }, [sessionId, messages, progress]);

  const appendMessage = useCallback((message: ChatMessage) => {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
    }));
  }, []);

  const appendAssistant = useCallback((text: string) => {
    appendMessage({ role: "assistant", text, ts: Date.now() });
  }, [appendMessage]);

  const appendUser = useCallback((text: string) => {
    appendMessage({ role: "user", text, ts: Date.now() });
  }, [appendMessage]);

  const addProgress = useCallback((label: string) => {
    setState((prev) => ({ ...prev, progress: [...prev.progress, label] }));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const reset = useCallback(() => {
    const newId = crypto.randomUUID();
    // Nettoyer le localStorage si des données existent encore
    localStorage.removeItem(MESSAGES_KEY);
    localStorage.removeItem(PROGRESS_KEY);
    setState({ sessionId: newId, messages: [], progress: [] });
    setError(null);
  }, []);

  const sendAction = useCallback(
    async ({ intent, subIntent, step, text }: SendActionArgs) => {
      let waitingForSegments = false;
      const now = Date.now();
      const userText = text || `${intent}${subIntent ? `:${subIntent}` : ""}#${step}`;
      appendMessage({ role: "user", text: userText, ts: now });
      setLoading(true);
      setError(null);

      const requestBody: ErnestApiRequest = {
        sessionId: stateRef.current.sessionId,
        chatInput: userText,
        meta: {
          intent,
          subIntent: (subIntent as any) ?? null,
          step,
        },
        timestamp: now,
        locale: navigator.language || "fr-FR",
        userAgent: navigator.userAgent,
        conversationHistory: stateRef.current.messages.slice(-5), // Derniers 5 messages pour contexte
      };

      try {
        const response = await postWithRetry(webhookUrl, requestBody);
        // Update session ID if backend rotated it
        const nextSessionId = response.sessionId || stateRef.current.sessionId;
        setState((prev) => ({ ...prev, sessionId: nextSessionId }));

        // Gestion des erreurs dans la réponse
        if (response.error) {
          console.error("Erreur API:", response.error);
          setError(response.error.message || "Une erreur s'est produite");
          return;
        }

        // Log des métadonnées pour débogage
        if (response.metadata) {
          console.log("Métadonnées réponse:", response.metadata);
        }

        // Log des suggestions (pour usage futur)
        if (response.suggestions && response.suggestions.length > 0) {
          console.log("Suggestions disponibles:", response.suggestions);
        }

        let answer = response.answer || response.transcript || "";
        
        // Debug: Log de la réponse complète
        console.log("🔍 Réponse API complète:", response);
        console.log("🔍 Type de answer initial:", typeof answer, "Est un tableau?", Array.isArray(answer));
        console.log("🔍 Valeur de answer initial:", answer);
        
        // Si answer est une string qui ressemble à un tableau JSON, la parser
        if (typeof answer === 'string' && answer.trim().startsWith('[') && answer.trim().endsWith(']')) {
          try {
            const parsed = JSON.parse(answer);
            if (Array.isArray(parsed)) {
              console.log("✅ String JSON parsée en tableau avec", parsed.length, "éléments");
              answer = parsed;
            }
          } catch (e) {
            console.warn("⚠️ Impossible de parser la string comme JSON:", e);
          }
        }
        
        const queue: string[] = [];

        const enqueueSegments = (raw: unknown) => {
          const trimmed = String(raw ?? "").trim();
          if (!trimmed) return;
          const segments = splitSecondMessage(trimmed);
          segments.forEach((segment) => {
            if (segment) {
              queue.push(segment);
            }
          });
        };

        if (Array.isArray(answer)) {
          console.log("✅ Answer est un tableau avec", answer.length, "éléments");
          if (answer.length === 0) {
            console.warn("⚠️ Le tableau answer est vide!");
          }
          answer.forEach((msg, index) => {
            enqueueSegments(msg);
            console.log(`📝 Message ${index}:`, String(msg).trim().substring(0, 50) + "...");
          });
        } else {
          console.log("📄 Answer est une string");
          enqueueSegments(answer);
        }

        if (queue.length === 0) {
          waitingForSegments = false;
        } else {
          waitingForSegments = true;
          queue.forEach((segment, index) => {
            const sendSegment = () => {
              appendMessage({
                role: "assistant",
                text: segment,
                ts: Date.now() + index,
              });
              if (index === queue.length - 1) {
                waitingForSegments = false;
                setLoading(false);
              }
            };

            if (index === 0) {
              sendSegment();
            } else {
              setTimeout(sendSegment, index * SECOND_MESSAGE_INTERVAL_MS);
            }
          });
        }
      } catch (e: any) {
        console.error("❌ Erreur dans sendAction:", e);
        const errorMessage = e?.message || "Oups, le service est lent ou indisponible. Réessayez dans un instant.";
        setError(errorMessage);
        // Afficher aussi un message d'assistant pour informer l'utilisateur
        appendMessage({ 
          role: "assistant", 
          text: `Désolé, une erreur s'est produite : ${errorMessage}. Veuillez réessayer.`, 
          ts: Date.now() 
        });
      } finally {
        if (!waitingForSegments) {
          setLoading(false);
        }
      }
    },
    [appendMessage, webhookUrl]
  );

  return {
    sessionId,
    messages,
    progress,
    loading,
    error,
    sendAction,
    addProgress,
    reset,
    clearError,
    appendAssistant,
    appendUser,
  };
}

export default useErnest;



