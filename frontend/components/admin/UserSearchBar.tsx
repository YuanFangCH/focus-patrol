'use client';

/** 用户搜索栏: 关键字 + 状态过滤 + 分页 */

interface Props {
  keyword: string;
  status: number | undefined;
  page: number;
  total: number;
  size: number;
  onKeyword: (kw: string) => void;
  onStatus: (s: number | undefined) => void;
  onPage: (p: number) => void;
}

export default function UserSearchBar({
  keyword, status, page, total, size, onKeyword, onStatus, onPage,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        value={keyword}
        onChange={(e) => onKeyword(e.target.value)}
        placeholder="搜索 uid / 昵称…"
        className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500"
      />
      <select
        value={status === undefined ? '' : String(status)}
        onChange={(e) => onStatus(e.target.value === '' ? undefined : Number(e.target.value))}
        className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-500"
      >
        <option value="">全部状态</option>
        <option value="1">正常</option>
        <option value="0">已禁用</option>
      </select>
      <div className="flex items-center gap-1 text-sm text-slate-500">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-brand-400 disabled:opacity-40 transition"
        >
          ←
        </button>
        <span className="px-2 text-xs">
          {page}/{totalPages} · 共 {total} 人
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-brand-400 disabled:opacity-40 transition"
        >
          →
        </button>
      </div>
    </div>
  );
}
