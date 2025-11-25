export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  text: string;
  ts: number;
}

export type Intent =
  | "HOME"
  | "SECURE_ACCOUNTS"
  | "CHECK_SCAM"
  | "SECURE_DEVICE"
  | "AWARENESS"
  | "SAFE_BROWSING"
  | "SOS"
  | "fallback";

export type SubIntent =
  | "ACCOUNT_TAKEOVER"
  | "LOST_MONEY"
  | "PHONE_STOLEN"
  | "DATA_LEAK"
  // SECURE_ACCOUNTS
  | "password_create"
  | "2fa"
  | "account_blocked"
  | "password_check"
  // CHECK_SCAM
  | "email_suspect"
  | "sms_call"
  | "payment_code"
  | "site_doubt"
  // SECURE_DEVICE
  | "phone_tablet"
  | "computer"
  | "device_slow"
  | "device_lost"
  // AWARENESS
  | "report_content"
  | "help_victim"
  | "recognize_harassment"
  | "how_to_react"
  // SAFE_BROWSING
  | "verify_site"
  | "public_wifi"
  | "download_program"
  | "browse_safer"
  | null;

export type SosSubIntent =
  | "ACCOUNT_TAKEOVER"
  | "LOST_MONEY"
  | "PHONE_STOLEN"
  | "DATA_LEAK";

export interface ErnestMeta {
  intent: Intent;
  subIntent: SubIntent;
  step: number;
}

export interface ErnestApiRequest {
  sessionId: string;
  chatInput: string;
  meta: ErnestMeta;
  timestamp?: number;
  locale?: string;
  userAgent?: string;
  conversationHistory?: Array<{ role: Role; text: string; timestamp: number }>;
}

export interface ErnestApiResponse {
  transcript?: string;
  answer: string | string[];
  sessionId: string;
  suggestions?: string[];
  metadata?: {
    intent?: Intent;
    subIntent?: SubIntent;
    confidence?: number;
    processingTime?: number;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

export interface ErnestState {
  sessionId: string;
  messages: ChatMessage[];
  progress: string[];
}

export interface SendActionArgs {
  intent: Intent;
  subIntent?: Exclude<SubIntent, null>;
  step: number;
  text?: string;
}

export interface HookStatus {
  loading: boolean;
  error: string | null;
}

export interface ErnestHookReturn extends HookStatus {
  sessionId: string;
  messages: ChatMessage[];
  progress: string[];
  sendAction: (args: SendActionArgs) => Promise<void>;
  addProgress: (label: string) => void;
  reset: () => void;
  clearError: () => void;
  appendAssistant: (text: string) => void;
  appendUser: (text: string) => void;
}

export interface ErnestWidgetProps {
  onReminder?: () => void;
  webhookUrl?: string;
  locale?: string;
}

export interface TelemetryDetail {
  type: string;
  intent?: Intent;
  subIntent?: Exclude<SubIntent, null>;
  step?: number;
}

