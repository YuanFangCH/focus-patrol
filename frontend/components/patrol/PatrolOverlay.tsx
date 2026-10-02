'use client';

/**
 * 督学官弹层: 巡查中的浮层提示 + 违纪时的"督学官现身"提醒
 * - 巡查中: 左下角小浮标显示"督学官巡查中"
 * - 违纪时: 居中弹层警告, 支持"我回来了"重新专注 / "查看快照"
 * - 快照预览: 点击查看违纪快照(仅你可见, 30 天后自动删除)
 */

import { useEffect, useState, useCallback } from 'react';
import { patrolApi, type PatrolVerdict } from '@/lib/api/patrols';
import { useAuthStore } from '@/lib/store/authStore';

interface PatrolOverlayProps {
  source: 'camera' | 'screen';
  sessionId: string;
  onDismiss?: () => void;
}

export default function PatrolOverlay({ source, sessionId, onDismiss }: PatrolOverlayProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [violation, setViolation] = useState<PatrolVerdict | null>(null);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [snapshotSrc, setSnapshotSrc] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 接收外部违纪事件: 由 PomodoroTimer 通过 window event 触发
  useEffect(() => {
    const onViolation = (e: Event) => {
      const verdict = (e as CustomEvent<PatrolVerdict>).detail;
      setViolation(verdict);
      setShowSnapshot(false);
    };
    window.addEventListener('patrol:violation', onViolation as EventListener);
    return () => window.removeEventListener('patrol:violation', onViolation as EventListener);
  }, []);

  const handleViewSnapshot = useCallback(async () => {
    if (!violation?.patrolId) return;
    try {
      // 快照接口返回图片流, 直接 fetch 并转 blob URL
      // API_BASE 为 "/" 时同源直拼路径, 避免拼出 "//path" 协议相对 URL
      const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
      const path = patrolApi.snapshotUrl(violation.patrolId);
      const url = base === '/' ? path : `${base}${path}`;
      const res = await fetch(url, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!res.ok) {
        setNotice('快照已不存在或已被删除');
        return;
      }
      const blob = await res.blob();
      setSnapshotSrc(URL.createObjectURL(blob));
      setShowSnapshot(true);
      setNotice(null);
    } catch {
      setNotice('快照加载失败');
    }
  }, [violation, accessToken]);

  const handleDeleteSnapshot = useCallback(async () => {
    if (!violation?.patrolId) return;
    try {
      await patrolApi.deleteSnapshot(violation.patrolId);
      setSnapshotSrc(null);
      setShowSnapshot(false);
      setNotice('快照已删除');
    } catch {
      setNotice('删除失败,请稍后再试');
    }
  }, [violation]);

  const handleBackToFocus = useCallback(() => {
    setViolation(null);
    setShowSnapshot(false);
    onDismiss?.();
  }, [onDismiss]);

  if (!violation) {
    // 巡查中浮标(不打扰)
    return (
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full bg-slate-900/80 text-white text-xs px-3 py-1.5 shadow-lg backdrop-blur">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <span>督学官巡查中 {source === 'camera' ? '📷' : '🖥️'}</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <div className="text-center">
          <div className="text-5xl mb-2">⚠️</div>
          <h3 className="text-xl font-bold text-slate-900">督学官发现你走神了</h3>
          <p className="mt-2 text-sm text-slate-500">
            AI 判定: <span className="font-medium text-rose-600">
              {violation.result === 'away' ? '离开座位' : '分心'}
            </span>
            {' '}· 置信度 {(violation.confidence * 100).toFixed(0)}%
          </p>
        </div>

        {showSnapshot && snapshotSrc && (
          <div className="mt-4 rounded-xl overflow-hidden border border-slate-200">
            <img src={snapshotSrc} alt="违纪快照" className="w-full object-cover" />
            <div className="flex justify-between items-center px-3 py-2 bg-slate-50 text-xs text-slate-500">
              <span>违纪瞬间(仅你可见,30 天后自动删除)</span>
              <button onClick={handleDeleteSnapshot} className="text-rose-500 hover:underline">
                删除快照
              </button>
            </div>
          </div>
        )}
        {!showSnapshot && violation.snapshotUrl && (
          <button
            onClick={() => void handleViewSnapshot()}
            className="mt-4 w-full py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:border-brand-500 hover:text-brand-600 transition"
          >
            查看违纪快照
          </button>
        )}

        {notice && <p className="mt-3 text-xs text-center text-slate-400">{notice}</p>}

        <div className="mt-4 flex gap-3">
          <button
            onClick={handleBackToFocus}
            className="flex-1 py-3 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 transition"
          >
            我回来了, 继续专注
          </button>
        </div>
        <p className="mt-3 text-[11px] text-center text-slate-400 leading-relaxed">
          违纪帧作为快照留存 30 天, 你可随时删除。详见
          <a href="/privacy-camera" target="_blank" className="text-brand-500 hover:underline"> 摄像头/屏幕巡查说明</a>
        </p>
      </div>
    </div>
  );
}
