'use client';

import type {
  ApiKey,
  AppSettings,
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
  templateId: 'standard',
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
  addApiKey(label: string): ApiKey {
    const key: ApiKey = {
      id: uid(),
      label,
      key: `eah_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
      revoked: false,
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
};