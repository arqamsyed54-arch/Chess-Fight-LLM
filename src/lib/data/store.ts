'use client';

import type {
  ApiKey,
  AppSettings,
  ChatMessage,
  LoginEvent,
  Paper,
  Ticket,
  UserProfile,
} from './types';

const KEYS = {
  papers: 'eah_papers',
  apiKeys: 'eah_apikeys',
  settings: 'eah_settings',
  tickets: 'eah_tickets',
  profile: 'eah_profile',
  loginHistory: 'eah_login_history',
  preferredTemplate: 'eah_preferred_template',
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable: ignore
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  templateId: 'school',
  defaultDifficulty: 'Medium',
  defaultPurpose: 'Practice',
  excludeAnswerKeys: false,
  defaultQuestionTypes: ['MCQ', 'Short Answer'],
  mcpServerUrl: '',
  mcpEnabled: false,
};

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Alex Teacher',
  email: 'alex@exanalyzer.app',
  school: 'Springfield High School',
  role: 'Teacher',
};

export function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export const APP_STORE = {
  getPapers(): Paper[] {
    return read<Paper[]>(KEYS.papers, []);
  },
  addPaper(paper: Paper): void {
    write(KEYS.papers, [paper, ...this.getPapers()]);
  },
  clearPapers(): void {
    write(KEYS.papers, []);
  },

  getApiKeys(): ApiKey[] {
    return read<ApiKey[]>(KEYS.apiKeys, []);
  },
  async addApiKey(label: string): Promise<ApiKey> {
    const raw = `eah_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    const key: ApiKey = {
      id: uid(),
      label,
      key: raw,
      hash: await hashKey(raw),
      createdAt: new Date().toISOString(),
      revoked: false,
      calls: 0,
      creditsUsed: 0,
    };
    write(KEYS.apiKeys, [...this.getApiKeys(), key]);
    return key;
  },
  revokeApiKey(id: string): void {
    write(
      KEYS.apiKeys,
      this.getApiKeys().map((k) => (k.id === id ? { ...k, revoked: true } : k)),
    );
  },
  recordApiCall(id: string, credits: number): void {
    write(
      KEYS.apiKeys,
      this.getApiKeys().map((k) =>
        k.id === id
          ? { ...k, calls: k.calls + 1, creditsUsed: k.creditsUsed + credits, lastUsedAt: new Date().toISOString() }
          : k,
      ),
    );
  },

  getSettings(): AppSettings {
    return { ...DEFAULT_SETTINGS, ...read<Partial<AppSettings>>(KEYS.settings, {}) };
  },
  saveSettings(settings: AppSettings): void {
    write(KEYS.settings, settings);
  },

  getTickets(): Ticket[] {
    return read<Ticket[]>(KEYS.tickets, []);
  },
  addTicket(ticket: Ticket): void {
    write(KEYS.tickets, [ticket, ...this.getTickets()]);
  },
  closeTicket(id: string): void {
    write(
      KEYS.tickets,
      this.getTickets().map((t) => (t.id === id ? { ...t, status: 'resolved' as const } : t)),
    );
  },

  getProfile(): UserProfile {
    return { ...DEFAULT_PROFILE, ...read<Partial<UserProfile>>(KEYS.profile, {}) };
  },
  saveProfile(profile: UserProfile): void {
    write(KEYS.profile, profile);
  },

  getChat(threadKey: string): ChatMessage[] {
    return read<ChatMessage[]>(`eah_chat_${threadKey}`, []);
  },
  saveChat(threadKey: string, messages: ChatMessage[]): void {
    write(`eah_chat_${threadKey}`, messages.slice(-60));
  },
  clearChat(threadKey: string): void {
    write(`eah_chat_${threadKey}`, []);
  },

  getLoginHistory(): LoginEvent[] {
    return read<LoginEvent[]>(KEYS.loginHistory, []);
  },
  addLoginEvent(event: LoginEvent): void {
    write(KEYS.loginHistory, [event, ...this.getLoginHistory()].slice(0, 20));
  },
  setPreferredTemplate(templateId: string): void {
    write(KEYS.preferredTemplate, templateId);
  },
  getPreferredTemplate(): string | null {
    const value = read<string | null>(KEYS.preferredTemplate, null);
    return value;
  },
};

async function hashKey(key: string): Promise<string> {
  try {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    return `sha256:${Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`;
  } catch {
    return `legacy:${key.slice(0, 8)}`;
  }
}