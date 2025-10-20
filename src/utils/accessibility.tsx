import React, { KeyboardEvent } from "react";

export function isActivationKey(event: KeyboardEvent): boolean {
  return event.key === "Enter" || event.key === " ";
}

export function onActivate(
  handler: () => void
): (event: KeyboardEvent | React.MouseEvent) => void {
  return (event) => {
    if ("key" in event) {
      const e = event as KeyboardEvent;
      if (isActivationKey(e)) {
        e.preventDefault();
        handler();
      }
    } else {
      handler();
    }
  };
}

export function ariaButtonProps(label: string) {
  return {
    role: "button",
    "aria-label": label,
    tabIndex: 0,
  } as const;
}

export function srOnly(text: string) {
  return (
    <span className="sr-only" aria-live="polite">
      {text}
    </span>
  );
}

export function announcePolite(text: string) {
  if (typeof document === "undefined") return;
  const region = document.createElement("div");
  region.setAttribute("aria-live", "polite");
  region.setAttribute("role", "status");
  region.style.position = "absolute";
  region.style.left = "-9999px";
  region.style.height = "1px";
  region.textContent = text;
  document.body.appendChild(region);
  setTimeout(() => region.remove(), 1000);
}

export function focusFirstInteractive(root: HTMLElement | null) {
  if (!root) return;
  const first = root.querySelector<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  first?.focus();
}



