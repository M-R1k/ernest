import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { BookOpen, Brain, PenSquare, ShieldCheck } from "lucide-react";

export type ThinkingStep = {
  key: string;
  label: string;
  subLabel: string;
  icon: LucideIcon;
};

export const THINKING_STEPS: ThinkingStep[] = [
  {
    key: "reading",
    label: "Lecture du message…",
    subLabel: "Je parcours chaque mot pour tout comprendre.",
    icon: BookOpen,
  },
  {
    key: "analysis",
    label: "Analyse en cours…",
    subLabel: "Je cherche les indices suspects et les signes de fraude.",
    icon: Brain,
  },
  {
    key: "drafting",
    label: "Rédaction de la réponse…",
    subLabel: "Je prépare une explication claire et rassurante.",
    icon: PenSquare,
  },
  {
    key: "safety",
    label: "Vérification de la sécurité…",
    subLabel: "Je valide les conseils avant de vous les partager.",
    icon: ShieldCheck,
  },
];

type UseThinkingStepsResult = {
  stepIndex: number;
  step: ThinkingStep;
  progress: number;
  steps: ThinkingStep[];
};

type ThinkingStepsConfig = {
  minDelayMs?: number;
  maxDelayMs?: number;
};

export function useThinkingSteps(
  active: boolean,
  config?: ThinkingStepsConfig
): UseThinkingStepsResult {
  const [stepIndex, setStepIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minDelay = Math.max(600, config?.minDelayMs ?? 1200);
  const maxDelay = Math.max(minDelay + 200, config?.maxDelayMs ?? 2600);

  function scheduleNextStep() {
    const duration =
      Math.random() * (maxDelay - minDelay) + minDelay;
    timerRef.current = setTimeout(() => {
      setStepIndex((prev) => (prev + 1) % THINKING_STEPS.length);
      scheduleNextStep();
    }, duration);
  }

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      clearTimer();
      return;
    }

    scheduleNextStep();

    return () => {
      clearTimer();
    };
  }, [active, minDelay, maxDelay]);

  const safeIndex = Math.min(stepIndex, THINKING_STEPS.length - 1);

  return useMemo(
    () => ({
      stepIndex: safeIndex,
      step: THINKING_STEPS[safeIndex],
      progress: (safeIndex + 1) / THINKING_STEPS.length,
      steps: THINKING_STEPS,
    }),
    [safeIndex]
  );
}


