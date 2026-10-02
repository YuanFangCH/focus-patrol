'use client';

/** AI 配置面板: 各厂商 key 掩码/模型/baseUrl 配置 + 用量检查(今日/近7天) + 测试连接 */

import { useCallback, useEffect, useState } from 'react';
import { adminApi, type AiConfigEntry, type AiUsageStats } from '@/lib/api/admin';

const PROVIDER_NAMES: Record<string, string> = {
  volcengine: '火山引擎',
  qwen: '通义千问',
  glm: '智谱 GLM(免费优先)',
};

export default function AiConfigPanel() {
  const [list, setList] = useState<AiConfigEntry[]>([]);
  const [usage, setUsage] = useState<AiUsageStats[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cfg, usg] = await Promise.all([adminApi.listAiConfig(), adminApi.listAiUsage(7)]);
      setList(cfg);
      setUsage(usg);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const usageFor = (provider: string) => usage.find((u) => u.provider === provider);

  const save = async (provider: string) => {
    setBusy(true);
    setError('');
    try {
      await adminApi.updateAiConfig(provider, {
        apiKey: apiKey.trim() || undefined,
        modelName: modelName.trim() || undefined,
        baseUrl: baseUrl.trim() || undefined,
      });
      setEditing(null);
      setApiKey('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // 测试连接: 后端无 probe 端点, 直接请求用量接口确认配置可读
  const testConn = async (provider: string) => {
    setTesting(provider);
    setTestMsg((m) => ({ ...m, [provider]: '测试中…' }));
    try {
      const cfg = (await adminApi.listAiConfig()).find((c) => c.provider === provider);
      if (!cfg) throw new Error('配置不存在');
      if (!cfg.hasKey) throw new Error('未配置 API key');
      setTestMsg((m) => ({ ...m, [provider]: `已配置 ✓ 模型:${cfg.modelName} · key:已加密` }));
    } catch (e) {
      setTestMsg((m) => ({ ...m, [provider]: `检查失败: ${(e as Error).message}` }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="font-bold text-slate-900">AI 判定厂商配置 + 用量</p>
        <p className="text-xs text-slate-400 mt-1">
          API key 仅加密存储在后端数据库(ai_configs), 管理接口只显示掩码, 明文永不出后端。
          用量为每次视觉判定的调用次数与 token 累计(按日聚合)。配置模型/baseUrl/key 后重启后端生效。
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-1 gap-3">
        {list.map((c) => {
          const u = usageFor(c.provider);
          return (
            <div key={c.provider} className="p-4 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">
                    {PROVIDER_NAMES[c.provider] ?? c.provider}
                  </span>
                  <span className="text-xs text-slate-400">{c.modelName}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] ${
                      c.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {c.enabled ? '启用' : '停用'}
                  </span>
                </div>
                <span className="text-xs text-slate-400">日配额 {c.dailyQuota}</span>
              </div>

              {/* 用量条 */}
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-slate-50">
                  <p className="text-[10px] text-slate-400">今日用量</p>
                  <p className="text-sm text-slate-700 font-medium">
                    {u ? `${u.today.calls} 次` : '0 次'}
                    <span className="text-xs text-slate-400 ml-1">
                      {u && u.today.tokens > 0 ? `${u.today.tokens} tok` : ''}
                    </span>
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50">
                  <p className="text-[10px] text-slate-400">近7天用量</p>
                  <p className="text-sm text-slate-700 font-medium">
                    {u ? `${u.week.calls} 次` : '0 次'}
                    <span className="text-xs text-slate-400 ml-1">
                      {u && u.week.tokens > 0 ? `${u.week.tokens} tok` : ''}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  {c.hasKey ? c.keyMasked : '未配置 API key'}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => void testConn(c.provider)}
                    disabled={testing === c.provider}
                    className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs hover:bg-slate-100 transition disabled:opacity-40"
                  >
                    {testing === c.provider ? '测试中…' : '检查配置'}
                  </button>
                  {editing === c.provider ? (
                    <button
                      onClick={() => void save(c.provider)}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-40 transition"
                    >
                      保存
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditing(c.provider);
                        setModelName(c.modelName);
                        setBaseUrl(c.baseUrl ?? '');
                        setApiKey('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs hover:bg-slate-200 transition"
                    >
                      {c.hasKey ? '更新配置' : '配置 key'}
                    </button>
                  )}
                </div>
              </div>

              {testMsg[c.provider] && (
                <p className={`mt-2 text-xs ${testMsg[c.provider].includes('失败') ? 'text-rose-500' : 'text-emerald-600'}`}>
                  {testMsg[c.provider]}
                </p>
              )}

              {editing === c.provider && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="模型名(如 qwen-vl-plus)"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-500"
                  />
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="base_url(OpenAI 兼容端点)"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-500"
                  />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="输入新 API key(留空不改)"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-500"
                  />
                  <button
                    onClick={() => { setEditing(null); setApiKey(''); }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs hover:bg-slate-200 transition"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400">
        说明: 当前视觉判定走 mock 时无真实用量; 配置后可将
        <code className="bg-slate-100 px-1 rounded">AI_PROVIDER</code> 切为
        <code className="bg-slate-100 px-1 rounded">qwen</code> 并重启后端, 即用配置的视觉模型真实判定并累计用量。
      </p>
    </div>
  );
}
