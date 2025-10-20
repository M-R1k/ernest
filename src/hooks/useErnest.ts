import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatMessage,
  ErnestApiRequest,
  ErnestApiResponse,
  ErnestHookReturn,
  ErnestState,
  SendActionArgs,
} from "../types";

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
  const [sessionId] = useState(() => {
    let existing = localStorage.getItem(SESSION_KEY);
    if (!existing) {
      existing = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, existing);
    }
    return existing;
  });
  return sessionId;
}

function persistState(state: ErnestState) {
  localStorage.setItem(SESSION_KEY, state.sessionId);
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(state.messages));
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress));
}

function restoreState(defaultSessionId: string): ErnestState {
  const messagesRaw = localStorage.getItem(MESSAGES_KEY);
  const progressRaw = localStorage.getItem(PROGRESS_KEY);
  let messages: ChatMessage[] = [];
  let progress: string[] = [];
  try {
    messages = messagesRaw ? (JSON.parse(messagesRaw) as ChatMessage[]) : [];
  } catch {}
  try {
    progress = progressRaw ? (JSON.parse(progressRaw) as string[]) : [];
  } catch {}
  return { sessionId: defaultSessionId, messages, progress };
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
  const TIMEOUT_MS = 12000;

  async function attempt(): Promise<ErnestApiResponse> {
    const res = await fetchWithTimeout(
      url,
      { method: "POST", headers, body: payload },
      TIMEOUT_MS
    );
    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      // Accept plain-text fallback as answer
      data = { answer: text };
    }
    if (!res.ok) {
      const message = data?.error || `HTTP ${res.status}`;
      throw new Error(message);
    }
    return data as ErnestApiResponse;
  }

  try {
    return await attempt();
  } catch (e) {
    // One retry with exponential backoff (base ~1s)
    await new Promise((r) => setTimeout(r, 1000 + Math.floor(Math.random() * 300)));
    return await attempt();
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

  // Persist whenever state changes
  useEffect(() => {
    persistState({ sessionId, messages, progress });
  }, [sessionId, messages, progress]);

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
    localStorage.setItem(SESSION_KEY, newId);
    localStorage.removeItem(MESSAGES_KEY);
    localStorage.removeItem(PROGRESS_KEY);
    setState({ sessionId: newId, messages: [], progress: [] });
    setError(null);
  }, []);

  const sendAction = useCallback(
    async ({ intent, subIntent, step, text }: SendActionArgs) => {
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
      };

      try {
        const response = await postWithRetry(webhookUrl, requestBody);
        // Update session ID if backend rotated it
        const nextSessionId = response.sessionId || stateRef.current.sessionId;
        setState((prev) => ({ ...prev, sessionId: nextSessionId }));

        const answerText = response.answer || response.transcript || "";
        appendMessage({ role: "assistant", text: answerText, ts: Date.now() });
      } catch (e: any) {
        setError(
          "Oups, le service est lent ou indisponible. Réessayez dans un instant."
        );
      } finally {
        setLoading(false);
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



