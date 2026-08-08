'use client';

import { useEffect, useState } from 'react';
import {
  Badge,
  Card,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from '@/components/FormControls';
import { TEMPLATES } from '@/lib/data/generator';
import { DIFFICULTIES, PURPOSES, QUESTION_TYPES } from '@/lib/data/questionBank';
import { APP_STORE, uid } from '@/lib/data/store';
import type { ApiKey, AppSettings, UserProfile } from '@/lib/data/types';

const TABS = ['Account', 'Security', 'API Keys', 'Template Defaults', 'Paper Defaults', 'MCP Config'] as const;

export default function SettingsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Account');

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <nav className="flex lg:flex-col gap-1.5 overflow-x-auto">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-left text-[13px] font-semibold transition ${
              tab === name ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {name}
          </button>
        ))}
      </nav>

      <div className="space-y-5">
        {tab === 'Account' && <AccountSection />}
        {tab === 'Security' && <SecuritySection />}
        {tab === 'API Keys' && <ApiKeysSection />}
        {tab === 'Template Defaults' && <TemplateDefaultsSection />}
        {tab === 'Paper Defaults' && <PaperDefaultsSection />}
        {tab === 'MCP Config' && <McpSection />}
      </div>
    </div>
  );
}

function AccountSection() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProfile(APP_STORE.getProfile());
  }, []);

  if (!profile) return null;
  const update = (key: keyof UserProfile, value: string) => setProfile({ ...profile, [key]: value });

  return (
    <Card title="Account" subtitle="Your personal details used on generated papers and communications.">
      <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
        <TextField label="Full name" value={profile.name} onChange={(v) => update('name', v)} />
        <TextField label="Email" type="email" value={profile.email} onChange={(v) => update('email', v)} />
        <TextField label="School / institute" value={profile.school} onChange={(v) => update('school', v)} />
        <TextField label="Role" value={profile.role} onChange={(v) => update('role', v)} />
      </div>
      <div className="mt-5 flex items-center gap-3">
        <PrimaryButton
          onClick={() => {
            APP_STORE.saveProfile(profile);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          }}
        >
          Save changes
        </PrimaryButton>
        {saved && <span className="text-[13px] font-semibold text-[#137a4b]">Saved ✓</span>}
      </div>
    </Card>
  );
}

function SecuritySection() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [notice, setNotice] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [sessions, setSessions] = useState<{ id: string; device: string; active: boolean; last: string }[]>([]);
  const [history, setHistory] = useState<
    { id: string; device: string; location: string; at: string; status: 'success' | 'failed' }[]
  >([]);

  useEffect(() => {
    setSessions(
      typeof window !== 'undefined'
        ? JSON.parse(window.localStorage.getItem('eah_sessions') || 'null') || [
            { id: uid(), device: 'Chrome on this computer', active: true, last: 'Now' },
            { id: uid(), device: 'Edge on this computer', active: false, last: 'Yesterday' },
            { id: uid(), device: 'iPhone — School Safari', active: false, last: '3 days ago' },
          ]
        : [],
    );
    let events = APP_STORE.getLoginHistory();
    if (events.length === 0) {
      const seed: { id: string; device: string; location: string; at: string; status: 'success' | 'failed' }[] = [
        { id: uid(), device: 'Chrome on this computer', location: 'Delhi, IN', at: new Date().toISOString(), status: 'success' },
        { id: uid(), device: 'Edge on this computer', location: 'Delhi, IN', at: new Date(Date.now() - 86400000).toISOString(), status: 'success' },
        { id: uid(), device: 'Chrome on this computer', location: 'Noida, IN', at: new Date(Date.now() - 172800000).toISOString(), status: 'failed' },
      ];
      seed.forEach((event) => APP_STORE.addLoginEvent(event));
      events = APP_STORE.getLoginHistory();
    }
    setHistory(events);
  }, []);

  const saveSessions = (list: typeof sessions) => {
    setSessions(list);
    if (typeof window !== 'undefined') window.localStorage.setItem('eah_sessions', JSON.stringify(list));
  };

  const changePassword = () => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('eah_password') || '' : '';
    if (stored && current !== stored) {
      setNotice('Current password is incorrect.');
      return;
    }
    if (next.length < 6) {
      setNotice('New password must be at least 6 characters.');
      return;
    }
    if (next !== confirm) {
      setNotice('New passwords do not match.');
      return;
    }
    if (typeof window !== 'undefined') window.localStorage.setItem('eah_password', next);
    setNotice('');
    setCurrent('');
    setNext('');
    setConfirm('');
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 2500);
  };

  return (
    <Card title="Security" subtitle="Manage your password and active login sessions.">
      <div className="grid sm:grid-cols-3 gap-4 max-w-2xl">
        <TextField label="Current password" type="password" value={current} onChange={setCurrent} placeholder="••••••••" />
        <TextField label="New password" type="password" value={next} onChange={setNext} placeholder="min 6 characters" />
        <TextField label="Confirm new password" type="password" value={confirm} onChange={setConfirm} placeholder="repeat" />
      </div>
      {notice && <p className="mt-3 text-[13px] font-semibold text-[#b3261e]">{notice}</p>}
      {passwordSaved && <p className="mt-3 text-[13px] font-semibold text-[#137a4b]">Password updated ✓</p>}
      <div className="mt-5">
        <PrimaryButton onClick={changePassword}>Update password</PrimaryButton>
      </div>

      <div className="mt-8">
        <h4 className="text-[14px] font-bold text-on-surface">Login history</h4>
        <ul className="mt-3 space-y-2">
          {history.map((event) => (
            <li key={event.id} className="flex items-center gap-3 rounded-xl border border-outline-variant px-4 py-3">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">history</span>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-on-surface">{event.device}</p>
                <p className="text-[12px] text-on-surface-variant">{event.location} • {new Date(event.at).toLocaleString()}</p>
              </div>
              <Badge tone={event.status === 'success' ? 'success' : 'warn'}>
                {event.status === 'success' ? 'Success' : 'Failed'}
              </Badge>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <h4 className="text-[14px] font-bold text-on-surface">Login sessions</h4>
        <ul className="mt-3 space-y-2">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-center gap-3 rounded-xl border border-outline-variant px-4 py-3">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">laptop_mac</span>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-on-surface">{session.device}</p>
                <p className="text-[12px] text-on-surface-variant">Last active: {session.last}</p>
              </div>
              <Badge tone={session.active ? 'success' : 'neutral'}>{session.active ? 'Active' : 'Inactive'}</Badge>
              {session.active && (
                <SecondaryButton onClick={() => saveSessions(sessions.filter((s) => s.id !== session.id))}>
                  Revoke
                </SecondaryButton>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [label, setLabel] = useState('');
  const [newKey, setNewKey] = useState<ApiKey | null>(null);

  useEffect(() => {
    setKeys(APP_STORE.getApiKeys());
  }, []);

  const create = async () => {
    if (!label.trim()) return;
    const key = await APP_STORE.addApiKey(label.trim());
    setKeys(APP_STORE.getApiKeys());
    setNewKey(key);
    setLabel('');
  };

  return (
    <Card title="API keys" subtitle="Keys let third-party tools generate papers through your SinkWake account.">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container px-4 py-3">
        <p className="text-[13px] text-on-surface-variant">
          Prefer the full management table with usage stats, last-used and hashed display?
        </p>
        <a
          href="/dashboard/api-keys"
          className="whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-[12px] font-bold text-white hover:bg-primary-dark transition"
        >
          Open API Keys page
        </a>
      </div>
      {newKey && (
        <div className="mb-5 rounded-xl border border-[#137a4b]/30 bg-[#e8f5ee] px-4 py-3">
          <p className="text-[13px] font-bold text-[#137a4b]">Key created — copy it now, it won’t be shown again:</p>
          <code className="mt-1 block break-all bg-white rounded-lg px-3 py-2 text-[12px] text-on-surface">{newKey.key}</code>
        </div>
      )}
      <div className="flex gap-3 max-w-xl">
        <div className="flex-1">
          <TextField label="Key label" value={label} onChange={setLabel} placeholder="e.g. School portal integration" />
        </div>
        <div className="self-end">
          <PrimaryButton onClick={create} disabled={!label.trim()}>
            Create key
          </PrimaryButton>
        </div>
      </div>

      <ul className="mt-6 space-y-2">
        {keys.length === 0 && (
          <li className="text-[13px] text-on-surface-variant">No API keys yet — create one above.</li>
        )}
        {keys.map((key) => (
          <li key={key.id} className="flex items-center gap-3 rounded-xl border border-outline-variant px-4 py-3">
            <span className="material-symbols-outlined text-[20px] text-primary">vpn_key</span>
            <div className="flex-1 overflow-hidden">
              <p className="text-[13px] font-semibold text-on-surface">{key.label}</p>
              <code className="text-[11px] text-on-surface-variant">{key.key.slice(0, 12)}••••••••••</code>
            </div>
            <Badge tone={key.revoked ? 'neutral' : 'success'}>{key.revoked ? 'Revoked' : 'Active'}</Badge>
            {!key.revoked && (
              <SecondaryButton
                onClick={() => {
                  APP_STORE.revokeApiKey(key.id);
                  setKeys(APP_STORE.getApiKeys());
                }}
              >
                Revoke
              </SecondaryButton>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TemplateDefaultsSection() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const current = APP_STORE.getSettings();
    if (current.templateId === 'standard') {
      current.templateId = 'school';
      APP_STORE.saveSettings(current);
    }
    setSettings(current);
  }, []);

  if (!settings) return null;

  return (
    <Card title="Template defaults" subtitle="The template used for generated papers when you skip template choice.">
      <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => setSettings({ ...settings, templateId: template.id })}
            className={`rounded-xl border p-4 text-left transition ${
              settings.templateId === template.id
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-outline-variant hover:border-primary/50'
            }`}
          >
            <p className="text-[14px] font-bold text-on-surface">{template.name}</p>
            <p className="text-[12px] text-on-surface-variant mt-1">{template.desc}</p>
          </button>
        ))}
      </div>
      <div className="mt-5">
        <SaveBar onSave={() => { APP_STORE.saveSettings(settings); setSaved(true); setTimeout(() => setSaved(false), 2500); }} saved={saved} />
      </div>
    </Card>
  );
}

function PaperDefaultsSection() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(APP_STORE.getSettings());
  }, []);

  if (!settings) return null;

  const toggleType = (type: string) =>
    setSettings({
      ...settings,
      defaultQuestionTypes: settings.defaultQuestionTypes.includes(type)
        ? settings.defaultQuestionTypes.filter((t) => t !== type)
        : [...settings.defaultQuestionTypes, type],
    });

  return (
    <Card title="Paper generation defaults" subtitle="Prefilled values when you start a new paper.">
      <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
        <label className="block">
          <span className="text-[13px] font-semibold text-on-surface block mb-1.5">Default difficulty</span>
          <select
            value={settings.defaultDifficulty}
            onChange={(e) => setSettings({ ...settings, defaultDifficulty: e.target.value as AppSettings['defaultDifficulty'] })}
            className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-[14px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {DIFFICULTIES.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[13px] font-semibold text-on-surface block mb-1.5">Default purpose</span>
          <select
            value={settings.defaultPurpose}
            onChange={(e) => setSettings({ ...settings, defaultPurpose: e.target.value })}
            className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-[14px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {PURPOSES.map((purpose) => (
              <option key={purpose} value={purpose}>{purpose}</option>
            ))}
          </select>
        </label>
      </div>

      <h4 className="mt-6 text-[14px] font-bold text-on-surface">Default question types</h4>
      <div className="mt-2 flex flex-wrap gap-2">
        {QUESTION_TYPES.filter((t) => t !== 'Custom').map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => toggleType(type)}
            className={`rounded-full px-4 py-1.5 text-[12px] font-semibold border transition ${
              settings.defaultQuestionTypes.includes(type)
                ? 'bg-primary text-white border-primary'
                : 'border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <label className="mt-6 flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={settings.excludeAnswerKeys}
          onChange={(e) => setSettings({ ...settings, excludeAnswerKeys: e.target.checked })}
          className="h-4 w-4 accent-primary"
        />
        <span className="text-[13px] font-semibold text-on-surface">Exclude answer key from student downloads</span>
      </label>

      <div className="mt-5">
        <SaveBar onSave={() => { APP_STORE.saveSettings(settings); setSaved(true); setTimeout(() => setSaved(false), 2500); }} saved={saved} />
      </div>
    </Card>
  );
}

function McpSection() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(APP_STORE.getSettings());
  }, []);

  if (!settings) return null;

  return (
    <Card title="MCP configuration" subtitle="Connect AI agents (like this assistant) to your paper data via the Model Context Protocol.">
      <label className="block max-w-xl">
        <span className="text-[13px] font-semibold text-on-surface block mb-1.5">MCP server endpoint</span>
        <input
          type="url"
          value={settings.mcpServerUrl}
          onChange={(e) => setSettings({ ...settings, mcpServerUrl: e.target.value })}
          placeholder="https://mcp.your-server.example.com/mcp"
          className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-[14px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>
      <label className="mt-4 flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={settings.mcpEnabled}
          onChange={(e) => setSettings({ ...settings, mcpEnabled: e.target.checked })}
          className="h-4 w-4 accent-primary"
        />
        <span className="text-[13px] font-semibold text-on-surface">Enable MCP for this workspace</span>
      </label>
      {settings.mcpEnabled && settings.mcpServerUrl && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#e8f5ee] border border-[#137a4b]/20 px-4 py-3 text-[13px] font-semibold text-[#137a4b]">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          Connected — AI agents can now read your paper history.
        </div>
      )}
      <div className="mt-5">
        <SaveBar onSave={() => { APP_STORE.saveSettings(settings); setSaved(true); setTimeout(() => setSaved(false), 2500); }} saved={saved} />
      </div>
    </Card>
  );
}

function SaveBar({ onSave, saved }: { onSave: () => void; saved: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <PrimaryButton onClick={onSave}>Save settings</PrimaryButton>
      {saved && <span className="text-[13px] font-semibold text-[#137a4b]">Saved ✓</span>}
    </div>
  );
}