'use client';

/** 管理面板主页: Tab = 用户管理 / AI 配置 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, type AdminUser, type AdminStats } from '@/lib/api/admin';
import UserTable from '@/components/admin/UserTable';
import UserSearchBar from '@/components/admin/UserSearchBar';
import CreateUsersForm from '@/components/admin/CreateUsersForm';
import UserDetailDrawer from '@/components/admin/UserDetailDrawer';
import AiConfigPanel from '@/components/admin/AiConfigPanel';

const SIZE = 20;
type Tab = 'users' | 'ai';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<number | undefined>(undefined);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchErr, setBatchErr] = useState('');

  // 批量选择
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const selectAll = () =>
    setSelectedIds((prev) =>
      prev.length === users.length ? [] : users.map((u) => u.id));
  const clearSel = () => setSelectedIds([]);

  const runBatch = async (patch: { nickname?: string; status?: number }, label: string) => {
    if (selectedIds.length === 0) { alert('请先勾选用户'); return; }
    if (!confirm(`确定对选中的 ${selectedIds.length} 个用户执行「${label}」?`)) return;
    if (patch.status === 0) {
      if (!confirm('⚠️ 禁用会强制这些用户下线(旧登录失效),继续?')) return;
    }
    setBatchErr('');
    try {
      const r = await adminApi.batchUpdateUsers(selectedIds, patch);
      alert(`已处理 ${r.updated} 个用户`);
      setSelectedIds([]);
      void load();
      void loadStats();
    } catch (e) {
      setBatchErr((e as Error).message);
    }
  };

  const handleBatchNickname = () => {
    const name = prompt('请输入新的昵称');
    if (!name) return;
    void runBatch({ nickname: name }, '批量改昵称');
  };

  const load = useCallback(async () => {
    try {
      const r = await adminApi.listUsers({ page, size: SIZE, keyword: keyword || undefined, status });
      setUsers(r.list);
      setTotal(r.total);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [page, keyword, status]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await adminApi.stats());
    } catch { /* 统计失败不阻塞 */ }
  }, []);

  useEffect(() => {
    if (tab === 'users') void load();
  }, [load, tab]);

  useEffect(() => {
    if (tab === 'users') void loadStats();
  }, [loadStats, tab]);

  // 防抖搜索
  useEffect(() => {
    const t = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(t);
  }, [keyword]);

  const handleToggle = async (u: AdminUser) => {
    if (!confirm(u.status === 1 ? `确定禁用用户 ${u.nickname}(${u.uid})?禁用后立即强制下线。` : `确定启用用户 ${u.nickname}(${u.uid})?`)) return;
    setBusyId(u.id);
    try {
      await adminApi.updateUser(u.id, { status: u.status === 1 ? 0 : 1 });
      void load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (u: AdminUser) => {
    if (!confirm(`⚠️ 确定删除用户 ${u.nickname}(${u.uid})?\n将级联清除其全部会话/巡查/快照/好友/通知,不可恢复!`)) return;
    setBusyId(u.id);
    try {
      await adminApi.deleteUser(u.id);
      void load();
      void loadStats();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const statCards = stats
    ? [
        { label: '总用户', value: stats.users, color: 'text-brand-600' },
        { label: '总会话', value: stats.sessions, color: 'text-emerald-600' },
        { label: '违纪次数', value: stats.violations, color: 'text-rose-500' },
        { label: '违纪快照', value: stats.snapshots, color: 'text-amber-600' },
      ]
    : [];

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'users', label: '用户管理' },
    { key: 'ai', label: 'AI 配置' },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <p className="font-black text-slate-900">AI 督学馆 · 管理面板</p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              仅本机可访问
            </span>
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
              返回站点 →
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Tab 切换 */}
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                tab === t.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-brand-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'users' && (
          <>
            {/* 统计条 */}
            {statCards.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {statCards.map((s) => (
                  <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
                    <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 建号 */}
            <CreateUsersForm onCreated={() => { void load(); void loadStats(); }} />

            {/* 用户列表 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-900">用户列表</p>
                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">已选 {selectedIds.length} 人</span>
                    <button
                      onClick={handleBatchNickname}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs hover:bg-slate-200 transition"
                    >
                      批量改昵称
                    </button>
                    <button
                      onClick={() => void runBatch({ status: 1 }, '批量启用')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs hover:bg-emerald-100 transition"
                    >
                      批量启用
                    </button>
                    <button
                      onClick={() => void runBatch({ status: 0 }, '批量禁用')}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-500 text-xs hover:bg-rose-100 transition"
                    >
                      批量禁用
                    </button>
                    <button
                      onClick={clearSel}
                      className="px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
              <UserSearchBar
                keyword={keyword}
                status={status}
                page={page}
                total={total}
                size={SIZE}
                onKeyword={setKeyword}
                onStatus={(s) => { setStatus(s); setPage(1); }}
                onPage={setPage}
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              {batchErr && <p className="text-sm text-red-500">{batchErr}</p>}
              <UserTable
                users={users}
                onView={setDetailUser}
                onToggleStatus={handleToggle}
                onDelete={handleDelete}
                busyId={busyId}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onSelectAll={selectAll}
              />
            </div>
          </>
        )}

        {tab === 'ai' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <AiConfigPanel />
          </div>
        )}

        <p className="text-xs text-slate-300 text-center">
          管理接口仅允许本机或局域网访问(LocalIpGuard)
        </p>
      </div>

      <UserDetailDrawer user={detailUser} onClose={() => setDetailUser(null)} />
    </main>
  );
}
