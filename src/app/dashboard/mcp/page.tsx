'use client';

import { useEffect, useState } from 'react';
import { Badge, Card, PrimaryButton } from '@/components/FormControls';
import { APP_STORE } from '@/lib/data/store';
import type { AppSettings } from '@/lib/data/types';

const TOOLS = [
  { name: 'generate_paper', desc: 'Creates a full paper (question, answer, solution) from a configuration object.', kind: 'Write' as const },
  { name: 'list_templates', desc: 'Lists available layouts and marks the current default template.', kind: 'Read' as const },
  { name: 'search_question_bank', desc: 'Searches the question bank by subject, difficulty, type and text.', kind: 'Read' as const },
  { name: 'get_credit_balance', desc: 'Returns the account credit balance and spend summary.', kind: 'Read' as const },
];

type TestState = 'idle' | 'testing' | 'success' | 'fail';

export default function McpPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [state, setState] = useState<TestState>('idle');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    setSettings(APP_STORE.getSettings());
  }, []);

  if (!settings) return null;

  const testConnection = async () => {
    setState('testing');
    setDetail('');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(settings.mcpServerUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json, text/plain, */*' },
      });
      clearTimeout(timer);
      if (res.ok) {
        setState('success');
        setDetail(`Server responded with HTTP ${res.status} — MCP endpoint is reachable.`);
      } else {
        setState('fail');
        setDetail(`Server answered HTTP ${res.status} (${res.statusText}). The endpoint is reachable but may expect a different MCP handshake.`);
      }
    } catch (error) {
      clearTimeout(timer);
      setState('fail');
      setDetail(error instanceof DOMException && error.name === 'AbortError'
        ? 'Connection timed out after 6s — check the URL and that the server allows cross-origin (CORS).'
        : `Could not connect: ${error instanceof Error ? error.message : 'unknown error'}.`);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Card title="MCP Server" subtitle="Model Context Protocol — expose your paper data to external AI agents.">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block flex-1 min-w-[260px]">
            <span className="text-[13px] font-semibold text-on-surface block mb-1.5">Server endpoint URL</span>
            <input
              type="url"
              value={settings.mcpServerUrl}
              onChange={(e) => setSettings({ ...settings, mcpServerUrl: e.target.value })}
              placeholder="https://mcp.sinkwake.app/v1"
              className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-[14px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono"
            />
          </label>
          <div className="flex gap-2">
            <PrimaryButton onClick={() => APP_STORE.saveSettings(settings)}>Save endpoint</PrimaryButton>
            <button
              type="button"
              onClick={testConnection}
              disabled={!settings.mcpServerUrl || state === 'testing'}
              className="rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-[13px] font-semibold text-on-surface hover:border-primary hover:text-primary disabled:opacity-40 transition"
            >
              {state === 'testing' ? 'Testing…' : 'Test Connection'}
            </button>
          </div>
        </div>

        {state === 'success' && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#137a4b]/30 bg-[#e8f5ee] px-4 py-3 text-[13px] font-semibold text-[#137a4b]">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            {detail}
          </div>
        )}
        {state === 'fail' && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#b3261e]/30 bg-[#fdecea] px-4 py-3 text-[13px] font-semibold text-[#b3261e]">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {detail}
          </div>
        )}
        {state === 'idle' && (
          <p className="mt-4 text-[12px] text-on-surface-variant">
            Test sends a GET request to the endpoint with a connection timeout — it validates reachability, not the full JSON-RPC handshake.
          </p>
        )}
      </Card>

      <Card title="Setup Instructions" subtitle="Connect an external AI agent (e.g. Anthropic Claude Desktop, Cursor, or a custom client).">
        <ol className="space-y-2.5 text-[13px] text-on-surface list-decimal list-outside ml-4">
          <li>Create an API key on the <a href="/dashboard/api-keys" className="text-primary hover:underline font-semibold">API Keys page</a>.</li>
          <li>Set your MCP server URL above and click <b>Test Connection</b> to confirm it’s reachable.</li>
          <li>In your AI client, add an MCP server: <code className="rounded bg-surface-container px-1.5 py-0.5 text-[12px]">mcp.json</code> with <code className="rounded bg-surface-container px-1.5 py-0.5 text-[12px]">{settings.mcpServerUrl || '<your-url>'}</code> as the endpoint and the API key passed as Bearer token.</li>
          <li>Grant access to <b>generate_paper</b>, <b>list_templates</b>, <b>search_question_bank</b> and <b>get_credit_balance</b> tools.</li>
          <li>Return here and toggle <b>Enable MCP access</b> below.</li>
        </ol>
        <label className="mt-4 flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.mcpEnabled}
            onChange={(e) => {
              const next = { ...settings, mcpEnabled: e.target.checked };
              setSettings(next);
              APP_STORE.saveSettings(next);
            }}
            className="h-4 w-4 accent-primary"
          />
          <span className="text-[13px] font-semibold text-on-surface">Enable MCP access for this workspace</span>
        </label>
      </Card>

      <Card title="Available Tools" subtitle="What connected AI agents can do with your workspace.">
        <ul className="space-y-2">
          {TOOLS.map((tool) => (
            <li key={tool.name} className="flex items-center gap-4 rounded-xl border border-outline-variant px-4 py-3">
              <code className="rounded-lg bg-surface-container px-2.5 py-1 text-[12px] font-bold text-primary">{tool.name}</code>
              <p className="flex-1 text-[13px] text-on-surface-variant">{tool.desc}</p>
              <Badge tone={tool.kind === 'Write' ? 'success' : 'neutral'}>{tool.kind}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}