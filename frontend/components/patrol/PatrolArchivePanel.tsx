'use client';

/**
 * 判定留档面板: 展示本次页面内的巡查判定留档(静态画面 + 判定结果), 供质量核查
 * - 留档仅保留在当前页面, 退出页面/会话即自动删除(由父组件在卸载时释放 blob URL)
 * - 违纪条目标记"已上传后端"(违纪判定自动上传后端留存快照)
 */

import { useState } from 'react';
import type { PatrolArchiveEntry } from '@/lib/vision/patrolArchive';

interface PatrolArchivePanelProps {
  entries: PatrolArchiveEntry[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

const RESULT_STYLE: Record<string, string> = {
  focus: 'bg-emerald-50 text-emerald-600',
  distracted: 'bg-amber-50 text-amber-600',
  away: 'bg-rose-50 text-rose-600',
};

const RESULT_LABEL: Record<string, string> = {
  focus: '专注',
  distracted: '分心',
  away: '离开',
};

export default function PatrolArchivePanel({ entries, onRemove, onClear }: PatrolArchivePanelProps) {
  const [open, setOpen] = useState(true);
  const [preview, setPreview] = useState<PatrolArchiveEntry | null>(null);

  const fmt = (ts: number) => new Date(ts).toLocaleTimeString('zh-CN', { hour12: false });

  return (
    <div className="border-t border-slate-100 pt-3 text-left">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800"
        >
          <span className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>▶</span>
          判定留档
          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-xs text-slate-500 tabular-nums">
            {entries.length}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">仅本次页面保留 · 退出自动清除</span>
          {entries.length > 0 && (
            <button onClick={onClear} className="text-xs text-slate-400 hover:text-rose-500">
              清空
            </button>
          )}
        </div>
      </div>

      {/* 留档列表 */}
      {open &&
        (entries.length === 0 ? (
          <p className="mt-2 py-4 text-xs text-slate-400 text-center">暂无判定留档</p>
        ) : (
          <ul className="mt-2 space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-2.5 rounded-lg border border-slate-100 p-1.5">
                <button onClick={() => setPreview(e)} className="relative shrink-0" title="点击查看大图">
                  {e.frameUrl ? (
                    <img
                      src={e.frameUrl}
                      alt="留档画面"
                      className="w-16 h-11 rounded-md object-cover border border-slate-200"
                    />
                  ) : (
                    <span className="w-16 h-11 rounded-md bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">
                      无帧
                    </span>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-slate-600 tabular-nums">{fmt(e.ts)}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${RESULT_STYLE[e.result] ?? 'bg-slate-100 text-slate-500'}`}>
                      {RESULT_LABEL[e.result] ?? e.result}
                    </span>
                    {e.isViolation && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium">
                        违纪
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {e.source === 'camera' ? '📷 摄像头' : '🖥️ 屏幕'} · 置信度 {(e.confidence * 100).toFixed(0)}%
                    {e.isViolation && (
                      <span className={e.uploaded ? ' text-emerald-500' : ' text-slate-400'}>
                        {' '}
                        · {e.uploaded ? '已上传后端' : '未上传后端'}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => onRemove(e.id)}
                  className="shrink-0 px-1.5 text-slate-300 hover:text-rose-500"
                  title="移除该条留档"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ))}

      {/* 大图预览 */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {preview.frameUrl ? (
              <img src={preview.frameUrl} alt="留档大图" className="w-full max-h-80 object-contain bg-slate-100" />
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-slate-400">
                无静态画面留档
              </div>
            )}
            <div className="p-4">
              <p className="text-sm font-medium text-slate-800">
                {fmt(preview.ts)} · {RESULT_LABEL[preview.result] ?? preview.result}
                {preview.isViolation && (
                  <span className="ml-2 text-rose-600 font-semibold">
                    违纪{preview.uploaded ? '(已上传后端留档)' : ''}
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {preview.source === 'camera' ? '📷 摄像头' : '🖥️ 屏幕'}巡查 · 置信度{' '}
                {(preview.confidence * 100).toFixed(0)}% · 判定留档(仅本次页面, 退出即自动删除)
              </p>
              <button
                onClick={() => setPreview(null)}
                className="mt-3 w-full py-2 rounded-xl bg-slate-100 text-slate-600 text-sm hover:bg-slate-200 transition"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
