'use client';

/**
 * 荣誉卡: 等级/经验进度 + 勋章墙
 * 数据来自 /honor/me
 */

import { useEffect, useState, useCallback } from 'react';
import { honorApi, type HonorMe } from '@/lib/api/social';

const LEVEL_ICONS: Record<number, string> = {
  1: '🥉',
  2: '🥈',
  3: '🥇',
  4: '💎',
  5: '👑',
};

export default function HonorCard() {
  const [data, setData] = useState<HonorMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await honorApi.me();
      setData(d);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-pulse">
        <div className="h-4 bg-slate-100 rounded w-1/3 mb-4" />
        <div className="h-8 bg-slate-100 rounded mb-2" />
        <div className="h-3 bg-slate-100 rounded" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-sm text-slate-500">
        荣誉数据加载失败({error ?? '无数据'})
        <button onClick={() => void load()} className="ml-2 text-brand-600 hover:underline">重试</button>
      </div>
    );
  }

  const { level, exp, nextMinExp, achievements } = data;
  const currentMin = level.minExp;
  const nextMin = nextMinExp ?? currentMin;
  const progress = nextMinExp
    ? Math.min(100, Math.round(((exp - currentMin) / (nextMin - currentMin)) * 100))
    : 100;
  const icon = LEVEL_ICONS[level.id] ?? '🎖️';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center text-3xl">
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-lg font-bold text-slate-900">Lv.{level.id} {level.name}</p>
          <p className="text-xs text-slate-500">
            {nextMinExp
              ? `再积累 ${nextMinExp - exp} EXP 升级到下一等级`
              : '已达最高等级, 荣誉之巅'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-brand-600">{exp}</p>
          <p className="text-xs text-slate-400">EXP</p>
        </div>
      </div>

      {/* 进度条 */}
      <div className="mt-4 h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
      {nextMinExp && (
        <p className="mt-1 text-right text-[11px] text-slate-400">{nextMinExp} EXP</p>
      )}

      {/* 勋章墙 */}
      {achievements.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-500 mb-2">我的勋章 ({achievements.length})</p>
          <div className="flex flex-wrap gap-2">
            {achievements.map((a) => (
              <span
                key={a.id}
                title={a.description}
                className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs text-amber-700"
              >
                {a.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
