'use client';

/** 用户表格: checkbox 多选 + uid(在线点)/昵称/状态/等级/经验/创建时间 + 操作(查看·禁用启用·删除) */

import type { AdminUser } from '@/lib/api/admin';

const LEVEL_ICONS: Record<number, string> = { 1: '🥉', 2: '🥈', 3: '🥇', 4: '💎', 5: '👑' };

interface Props {
  users: AdminUser[];
  onView: (u: AdminUser) => void;
  onToggleStatus: (u: AdminUser) => void;
  onDelete: (u: AdminUser) => void;
  busyId?: string | null;
  /** 批量选择 */
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: () => void;
}

export default function UserTable({
  users, onView, onToggleStatus, onDelete, busyId,
  selectedIds = [], onToggleSelect, onSelectAll,
}: Props) {
  const selectable = !!onToggleSelect;
  const allSelected = selectable && users.length > 0 && users.every((u) => selectedIds.includes(u.id));
  if (users.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        没有符合条件的用户
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
            {selectable && (
              <th className="py-2.5 pr-2 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAll}
                  className="accent-brand-600"
                />
              </th>
            )}
            <th className="py-2.5 pr-3 font-medium">uid</th>
            <th className="py-2.5 pr-3 font-medium">昵称</th>
            <th className="py-2.5 pr-3 font-medium">状态</th>
            <th className="py-2.5 pr-3 font-medium">等级</th>
            <th className="py-2.5 pr-3 font-medium">经验</th>
            <th className="py-2.5 pr-3 font-medium">创建时间</th>
            <th className="py-2.5 font-medium text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const disabled = u.status === 0;
            const busy = busyId === u.id;
            const checked = selectedIds.includes(u.id);
            return (
              <tr key={u.id} className={`border-b border-slate-50 ${disabled ? 'opacity-50' : ''}`}>
                {selectable && (
                  <td className="py-2.5 pr-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleSelect?.(u.id)}
                      className="accent-brand-600"
                    />
                  </td>
                )}
                <td className="py-2.5 pr-3 font-mono font-semibold text-brand-700">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        u.online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                      }`}
                      title={u.online ? '在线' : '离线'}
                    />
                    {u.uid ?? '—'}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-slate-800">{u.nickname}</td>
                <td className="py-2.5 pr-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] ${
                      disabled ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {disabled ? '已禁用' : '正常'}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-slate-600">
                  {u.honorLevelName ? `${LEVEL_ICONS[u.honorLevelId ?? 0] ?? ''} Lv.${u.honorLevelId} ${u.honorLevelName}` : '—'}
                </td>
                <td className="py-2.5 pr-3 text-slate-600">{u.honorExp}</td>
                <td className="py-2.5 pr-3 text-slate-400">
                  {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                </td>
                <td className="py-2.5 text-right whitespace-nowrap">
                  <button
                    onClick={() => onView(u)}
                    disabled={busy}
                    className="px-2 py-1 text-xs text-brand-600 hover:underline disabled:opacity-40"
                  >
                    详情
                  </button>
                  <button
                    onClick={() => onToggleStatus(u)}
                    disabled={busy}
                    className="px-2 py-1 text-xs text-amber-600 hover:underline disabled:opacity-40"
                  >
                    {disabled ? '启用' : '禁用'}
                  </button>
                  <button
                    onClick={() => onDelete(u)}
                    disabled={busy}
                    className="px-2 py-1 text-xs text-rose-500 hover:underline disabled:opacity-40"
                  >
                    删除
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
