'use client';

/** 建号表单: 昵称 + 数量 → 展示生成的 uid 列表(可复制) */

import { useState } from 'react';
import { adminApi, type AdminCreatedAccount } from '@/lib/api/admin';

export default function CreateUsersForm({ onCreated }: { onCreated?: () => void }) {
  const [nickname, setNickname] = useState('');
  const [count, setCount] = useState(1);
  const [accounts, setAccounts] = useState<AdminCreatedAccount[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const create = async () => {
    if (!nickname.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const r = await adminApi.createUsers(nickname.trim(), count);
      setAccounts(r.accounts);
      onCreated?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copyAll = async () => {
    if (!accounts) return;
    const text = accounts.map((a) => a.uid).join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* 忽略 */ }
  };

  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
      <p className="text-sm font-medium text-slate-700 mb-3">批量创建账号</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="昵称前缀(如 小明)"
          maxLength={20}
          className="flex-1 min-w-[140px] px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500"
        />
        <input
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
          className="w-20 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500"
        />
        <button
          onClick={() => void create()}
          disabled={loading || !nickname.trim()}
          className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40 transition"
        >
          {loading ? '创建中…' : '创建账号'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {accounts && accounts.length > 0 && (
        <div className="mt-3 p-3 rounded-lg bg-white border border-brand-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-brand-700">
              已创建 {accounts.length} 个账号,请分发给用户
            </p>
            <button
              onClick={() => void copyAll()}
              className="text-xs text-slate-500 hover:text-brand-600 hover:underline"
            >
              复制全部 uid
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {accounts.map((a) => (
              <div
                key={a.id}
                className="px-2 py-1.5 rounded-lg bg-slate-50 text-center"
                title={`${a.nickname} (${a.id})`}
              >
                <span className="font-mono text-sm font-bold text-slate-800">{a.uid}</span>
                <span className="ml-1.5 text-[10px] text-slate-400">{a.nickname}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
