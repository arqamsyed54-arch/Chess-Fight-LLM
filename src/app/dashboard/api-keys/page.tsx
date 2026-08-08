'use client';

import { useEffect, useState } from 'react';
import { Badge, Card } from '@/components/FormControls';
import { APP_STORE } from '@/lib/data/store';
import type { ApiKey } from '@/lib/data/types';

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [label, setLabel] = useState('');
  const [freshKey, setFreshKey] = useState<ApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setKeys(APP_STORE.getApiKeys());
  }, []);

  const create = async () => {
    if (!label.trim()) {
      setError('Give the key a label first.');
      return;
    }
    setError('');
    const key = await APP_STORE.addApiKey(label.trim());
    setKeys(APP_STORE.getApiKeys());
    setFreshKey(key);
    setLabel('');
    setCopied(false);
  };

  const copyKey = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy your key:', value);
    }
  };

  const overall = keys.filter((k) => !k.revoked);
  const calls = keys.reduce((sum, k) => sum + k.calls, 0);
  const credits = keys.reduce((sum, k) => sum + k.creditsUsed, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4 max-w-xl">
        <MiniStat icon="vpn_key" label="Active keys" value={String(overall.length)} />
        <MiniStat icon="call_split" label="API calls" value={String(calls)} />
        <MiniStat icon="bolt" label="Credits via API" value={String(credits)} />
      </div>

      <Card title="Create API Key" subtitle="Keys are shown once and stored only as SHA-256 hashes.">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block flex-1 min-w-[240px]">
            <span className="text-[13px] font-semibold text-on-surface block mb-1.5">Key label</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') create();
              }}
              placeholder="e.g. School portal integration"
              className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-[14px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <button
            type="button"
            onClick={create}
            disabled={!label.trim()}
            className="rounded-xl bg-primary px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:opacity-40 transition"
          >
            Generate New Key
          </button>
        </div>
        {error && <p className="mt-2 text-[12px] font-semibold text-[#b3261e]">{error}</p>}

        {freshKey && (
          <div className="mt-4 rounded-xl border border-[#137a4b]/30 bg-[#e8f5ee] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-bold text-[#137a4b]">
                Key created — copy it now. Only a hash is stored, so it can never be shown again.
              </p>
              <button
                type="button"
                onClick={() => copyKey(freshKey.key)}
                className="whitespace-nowrap rounded-lg bg-[#137a4b] px-3.5 py-1.5 text-[12px] font-bold text-white hover:opacity-90 transition"
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <code className="mt-2 block break-all rounded-lg bg-white px-3 py-2 text-[12px] font-mono text-on-surface">
              {freshKey.key}
            </code>
          </div>
        )}
      </Card>

      <Card title="Your Keys" subtitle={`${keys.length} total • hashed at rest`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                <th className="pb-3 pr-4 font-bold">Label</th>
                <th className="pb-3 pr-4 font-bold">Created</th>
                <th className="pb-3 pr-4 font-bold">Last used</th>
                <th className="pb-3 pr-4 font-bold">Calls</th>
                <th className="pb-3 pr-4 font-bold">Credits used</th>
                <th className="pb-3 pr-4 font-bold">Status</th>
                <th className="pb-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {keys.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-on-surface-variant">No keys yet — create one above.</td>
                </tr>
              )}
              {keys.map((key) => (
                <tr key={key.id} className="border-t border-outline-variant">
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-on-surface">{key.label}</p>
                    <code className="text-[11px] text-on-surface-variant">{key.hash ? `${key.hash.slice(0, 12)}•••` : key.key.slice(0, 8)}</code>
                  </td>
                  <td className="py-3 pr-4 text-on-surface-variant">{new Date(key.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 pr-4 text-on-surface-variant">{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}</td>
                  <td className="py-3 pr-4 text-on-surface font-semibold">{key.calls}</td>
                  <td className="py-3 pr-4 text-on-surface font-semibold">{key.creditsUsed}</td>
                  <td className="py-3 pr-4">
                    <Badge tone={key.revoked ? 'neutral' : 'success'}>{key.revoked ? 'Revoked' : 'Active'}</Badge>
                  </td>
                  <td className="py-3">
                    {key.revoked ? (
                      <span className="text-[12px] text-on-surface-variant">—</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          APP_STORE.revokeApiKey(key.id);
                          setKeys(APP_STORE.getApiKeys());
                        }}
                        className="text-[12px] font-semibold text-[#b3261e] hover:underline transition"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[12px] text-on-surface-variant">
          Hash: <code className="rounded bg-surface-container px-1.5 py-0.5">sha256:{'<key>'.slice(0, 24)}…</code> —
          revoking a key immediately blocks its calls. Next milestone replaces browser storage with the database.
        </p>
      </Card>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <Card className="!p-4">
      <div className="flex items-center gap-2.5">
        <span className="material-symbols-outlined text-[20px] text-primary">{icon}</span>
        <div>
          <p className="text-[20px] font-bold text-on-surface leading-none">{value}</p>
          <p className="text-[12px] text-on-surface-variant mt-1">{label}</p>
        </div>
      </div>
    </Card>
  );
}