'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionStore } from '@/lib/store/sessionStore';
import type { PatrolMode } from '@/lib/store/sessionStore';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { useLongClockStore } from '@/lib/store/longClockStore';
import { usePreviewStore } from '@/lib/store/previewStore';
import { PatrolEngine, PATROL_FREQUENCY_MAP } from '@/lib/vision/patrolEngine';
import type { PatrolArchiveEntry } from '@/lib/vision/patrolArchive';
import type { PatrolVerdict } from '@/lib/api/patrols';
import { requestCameraStream, stopStream, normalizeCameraError } from '@/lib/vision/cameraAccess';
import PatrolOverlay from '@/components/patrol/PatrolOverlay';
import PatrolArchivePanel from '@/components/patrol/PatrolArchivePanel';

/** 判定留档上限(抽样留存最近 N 条, 超出淘汰最旧, 控制页面内存) */
const ARCHIVE_MAX = 60;

const DURATIONS = [25, 45, 60];
const MODES: Array<{ value: PatrolMode; label: string; desc: string }> = [
  { value: 'off', label: '不巡查', desc: '纯计时' },
  { value: 'camera', label: '摄像头巡查', desc: 'AI 检查是否专注' },
  { value: 'screen', label: '屏幕巡查', desc: 'AI 检查屏幕内容' },
];
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export default function PomodoroTimer() {
  const {
    phase, session, remainingSeconds, totalSeconds, mode, unlimited, lastResult,
    start, pause, resume, end, interrupt, reset,
  } = useSessionStore();
  const settings = useSettingsStore();
  const longClock = useLongClockStore();
  const [duration, setDuration] = useState(settings.workMinutes);
  const [patrolMode, setPatrolMode] = useState<PatrolMode>(settings.patrolMode);
  const [now, setNow] = useState(Date.now());
  const [violation, setViolation] = useState<PatrolVerdict | null>(null);
  const engineRef = useRef<PatrolEngine | null>(null);
  // 判定留档(仅当前页面内存, 退出即自动删除): state 驱动渲染 + ref 供卸载清理
  const [archive, setArchive] = useState<PatrolArchiveEntry[]>([]);
  const archiveRef = useRef<PatrolArchiveEntry[]>([]);

  /** 统一的留档更新入口(同步 state 与 ref, 便于卸载时释放 blob URL) */
  const updateArchive = useCallback(
    (updater: (prev: PatrolArchiveEntry[]) => PatrolArchiveEntry[]) => {
      setArchive((prev) => {
        const next = updater(prev);
        archiveRef.current = next;
        return next;
      });
    },
    [],
  );

  /** 新增一条判定留档(判定帧转 blob URL 仅存内存, 退出页面释放) */
  const addArchive = useCallback(
    (v: PatrolVerdict, frame?: Blob) => {
      const frameUrl = frame ? URL.createObjectURL(frame) : null;
      const entry: PatrolArchiveEntry = {
        id: v.patrolId || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ts: Date.now(),
        source: mode as 'camera' | 'screen',
        result: v.result,
        confidence: v.confidence,
        isViolation: v.isViolation,
        uploaded: v.isViolation && !!v.snapshotUrl,
        snapshotUrl: v.snapshotUrl,
        frameUrl,
      };
      updateArchive((prev) => {
        const next = [...prev, entry];
        // 抽样留存: 超过上限淘汰最旧并释放其 blob URL
        if (next.length > ARCHIVE_MAX) {
          const dropped = next.splice(0, next.length - ARCHIVE_MAX);
          dropped.forEach((e) => e.frameUrl && URL.revokeObjectURL(e.frameUrl));
        }
        return next;
      });
    },
    [mode, updateArchive],
  );

  /** 移除单条留档并释放其 blob URL */
  const removeArchive = useCallback(
    (id: string) => {
      updateArchive((prev) => {
        const target = prev.find((e) => e.id === id);
        if (target?.frameUrl) URL.revokeObjectURL(target.frameUrl);
        return prev.filter((e) => e.id !== id);
      });
    },
    [updateArchive],
  );

  /** 清空全部留档并释放 blob URL */
  const clearArchive = useCallback(() => {
    updateArchive((prev) => {
      prev.forEach((e) => e.frameUrl && URL.revokeObjectURL(e.frameUrl));
      return [];
    });
  }, [updateArchive]);

  // 退出页面(组件卸载)自动删除全部留档缓存
  useEffect(
    () => () => {
      archiveRef.current.forEach((e) => e.frameUrl && URL.revokeObjectURL(e.frameUrl));
      archiveRef.current = [];
    },
    [],
  );

  const isUnlimited = phase === 'idle' ? settings.workMode === 'unlimited' : unlimited;
  // 是否为长时间模式(总时长=多段学习+休息)
  const isLong = phase === 'idle' ? settings.longMode : longClock.running;

  // 时钟
  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // 巡查引擎生命周期: 运行中且 mode!=off 时启动, 否则停止
  useEffect(() => {
    if (phase === 'running' && session?.id && mode !== 'off') {
      const freq = PATROL_FREQUENCY_MAP[settings.patrolFrequency] ?? PATROL_FREQUENCY_MAP.normal;
      // camera 模式复用摄像头常开预览流(避免重复占用摄像头); 否则引擎自采(getDisplayMedia/getUserMedia)
      const previewStream = mode === 'camera'
        ? usePreviewStore.getState().mediaStream
        : undefined;
      const engine = new PatrolEngine({
        sessionId: session.id,
        source: mode,
        intervalMs: freq.intervalMs,
        minUploadGapMs: freq.minUploadGapMs,
        changeThreshold: freq.changeThreshold,
        localRuleHits: freq.localRuleHits,
        deviceId: settings.cameraDeviceId || undefined,
        stream: previewStream ?? undefined,
        onVerdict: (v, frame) => {
          // 判定留档(静态画面 + 判定结果, 仅当前页面内存; 违纪判定已自动上传后端快照)
          addArchive(v, frame);
          // 实时刷新会话统计(已巡查/违纪次数)
          useSessionStore.getState().updatePatrolStats(v.patrolCount, v.violationCount);
        },
        onViolation: (v) => {
          setViolation(v);
          // 派发事件触发 PatrolOverlay 内部违纪弹层
          window.dispatchEvent(new CustomEvent('patrol:violation', { detail: v }));
        },
        onError: (e) => console.warn('[patrol]', e.message),
      });
      engineRef.current = engine;
      void engine.start().catch((e) => console.warn('[patrol] 启动失败:', e.message));
      return () => {
        engine.stop();
        engineRef.current = null;
      };
    }
    return undefined;
  }, [phase, session?.id, mode, settings.patrolFrequency, settings.cameraDeviceId, settings.cameraPreview, addArchive]);

  // 会话结束/中断时, 自动关闭违纪弹层
  useEffect(() => {
    if (phase === 'completed' || phase === 'interrupted' || phase === 'idle') {
      setViolation(null);
    }
  }, [phase]);

  const mm = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const ss = String(remainingSeconds % 60).padStart(2, '0');
  const progress = totalSeconds > 0 ? (totalSeconds - remainingSeconds) / totalSeconds : 0;

  const activeMode = phase !== 'idle' ? mode : patrolMode;

  const handleStart = async () => {
    // 新一轮开始: 清空上一轮判定留档(留档仅保留当前轮次, 退出页面即自动删除)
    clearArchive();
    // iOS Safari 兼容: getUserMedia 必须在用户手势(点击)调用栈内发起, 否则不弹权限框。
    // 因此在点击「开始专注」的手势栈内预请求摄像头流, 存入 previewStore 供引擎复用。
    if (patrolMode === 'camera') {
      try {
        const prev = usePreviewStore.getState().mediaStream;
        if (prev) stopStream(prev);
        const stream = await requestCameraStream({
          deviceId: settings.cameraDeviceId || undefined,
          width: 640,
          height: 480,
        });
        usePreviewStore.getState().setStream(stream);
      } catch (e) {
        const err = normalizeCameraError(e);
        console.warn('[patrol] 摄像头预请求失败:', err.message);
        // 不阻止开始: 引擎内部会再次尝试并降级处理
      }
    }
    if (settings.longMode) {
      // 长时间番茄钟: 总时长=多段学习+休息, 由 longClock 调度
      longClock.start();
      return;
    }
    if (settings.workMode === 'unlimited') {
      void start(duration, patrolMode, { unlimited: true });
    } else {
      void start(duration, patrolMode);
    }
  };

  // 提前休息(学习段): 仅当学习段已运行且已过设定学习段的 min 时间(即当前学习段 >= 设定学习时长即视为可跳)
  const canEarlyBreak = phase === 'running' && longClock.running && longClock.segPhase === 'study';

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* 督学官浮标/弹层: 巡查期间常驻挂载(浮标), 违纪时弹出居中警告 */}
      {phase === 'running' && session?.id && mode !== 'off' && (
        <PatrolOverlay
          source={mode === 'screen' ? 'screen' : 'camera'}
          sessionId={session.id}
          onDismiss={() => setViolation(null)}
        />
      )}
      {/* 设置区 */}
      {phase === 'idle' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
          {/* 长时/普通 模式切换提示 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">{isLong ? '长时间番茄钟' : '专注时长'}</p>
              {isLong && (
                <p className="text-xs text-slate-400 mt-0.5">总学习时长由多段学习 + 休息交替组成</p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.longMode}
                onChange={(e) => settings.set({ longMode: e.target.checked })}
                className="accent-brand-600 w-4 h-4 rounded"
              />
              长时间模式
            </label>
          </div>

          {isUnlimited && !isLong ? (
            <div className="py-3 rounded-xl border border-brand-500 bg-brand-50 text-center">
              <p className="font-medium text-brand-700">无限时长 · 持续劳动</p>
              <p className="text-xs text-brand-400 mt-0.5">手动点击结束才结算</p>
            </div>
          ) : isLong ? (
            <div className="space-y-4">
              {/* 长时配置 */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">总学习时长(分)</p>
                  <input
                    type="number" min={30} max={4320}
                    value={settings.longTotalMinutes}
                    onChange={(e) => settings.set({ longTotalMinutes: Math.max(30, Number(e.target.value) || 30) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-center font-bold focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                  />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">单段学习(分)</p>
                  <input
                    type="number" min={25}
                    max={settings.longTotalMinutes}
                    value={settings.longStudyMinutes}
                    onChange={(e) => settings.set({ longStudyMinutes: clamp(Number(e.target.value) || 25, 25, settings.longTotalMinutes) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-center font-bold focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">≥25 且 ≤总时长</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">单段休息(分)</p>
                  <input
                    type="number" min={1} max={30}
                    value={settings.longBreakMinutes}
                    onChange={(e) => settings.set({ longBreakMinutes: clamp(Number(e.target.value) || 1, 1, 30) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-center font-bold focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">1~30</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                按「总时长」累计学习分钟数, 自动在学习段与休息段间切换。学习段≥25 分后可提前休息, 休息时可随时开始下一段。
              </p>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-3 gap-3">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`py-3 rounded-xl border text-center transition ${
                      duration === d
                        ? 'bg-brand-600 text-white border-brand-600 shadow'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-brand-500'
                    }`}
                  >
                    {d} 分钟
                  </button>
                ))}
              </div>
              {/* 自定义时长 25~120 */}
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number" min={25} max={120}
                  placeholder="自定义"
                  value={duration}
                  onChange={(e) => setDuration(clamp(Number(e.target.value) || 25, 25, 120))}
                  className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-center font-bold focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                />
                <span className="text-sm text-slate-400">分钟（25~120）</span>
              </div>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-slate-600 mb-3">巡查模式</p>
            <div className="space-y-2">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setPatrolMode(m.value)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition ${
                    patrolMode === m.value
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-slate-200 bg-white hover:border-brand-300'
                  }`}
                >
                  <span className="font-medium text-slate-800">{m.label}</span>
                  <span className="text-sm text-slate-500">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => void handleStart()}
            className="w-full py-4 rounded-xl bg-brand-600 text-white text-lg font-bold hover:bg-brand-700 transition shadow-lg shadow-brand-600/20"
          >
            {isLong ? '开始长时间专注' : isUnlimited ? '开始持续劳动' : '开始专注'}
          </button>
        </div>
      )}

      {/* 运行区 */}
      {phase !== 'idle' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-6">
          <div className="flex items-center justify-center gap-3">
            <span className="text-sm px-3 py-1 rounded-full bg-brand-50 text-brand-600 font-medium">
              {activeMode === 'camera' && '📷 摄像头巡查中'}
              {activeMode === 'screen' && '🖥️ 屏幕巡查中'}
              {activeMode === 'off' && '⏱️ 纯计时'}
            </span>
            {isUnlimited && !isLong && (
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500 font-medium">
                ∞ 无限时长
              </span>
            )}
            {isLong && (
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                longClock.segPhase === 'study' ? 'bg-brand-100 text-brand-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {longClock.segPhase === 'study' ? `学段 ${longClock.segIndex}` : '☕ 休息中'}
              </span>
            )}
          </div>

          {/* 长时总进度条 */}
          {isLong && (
            <div className="px-2">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>已学习 {Math.floor(longClock.accumulatedStudySeconds / 60)} / {Math.floor(longClock.totalStudySeconds / 60)} 分钟</span>
                <span>{longClock.segPhase === 'break' ? '休息后继续' : '学习段休息可提前'}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, (longClock.accumulatedStudySeconds / (longClock.totalStudySeconds || 1)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="relative w-56 h-56 mx-auto">
            {isUnlimited ? (
              // 无限模式: 脉冲圆点(无进度环)
              <div className="w-full h-full flex items-center justify-center">
                <div className="relative">
                  <div className="w-36 h-36 rounded-full bg-brand-100/70 flex items-center justify-center">
                    <span className="text-5xl font-bold tabular-nums text-brand-700">∞</span>
                  </div>
                  <div className="absolute -inset-3 rounded-full border-2 border-brand-300/60 animate-ping" />
                </div>
              </div>
            ) : (
              <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                <circle cx="100" cy="100" r="88" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                <circle
                  cx="100" cy="100" r="88" fill="none"
                  stroke="#4f46e5" strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 88}`}
                  strokeDashoffset={`${2 * Math.PI * 88 * (1 - progress)}`}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold tabular-nums text-slate-900">
                {isUnlimited ? `${mm}:${ss}` : `${mm}:${ss}`}
              </span>
              <span className="mt-2 text-sm text-slate-500">
                {phase === 'running' && (isLong ? (longClock.segPhase === 'study' ? '学习中' : '休息中') : isUnlimited ? '劳动中' : '专注中')}
                {phase === 'paused' && '已暂停'}
                {phase === 'completed' && (isLong ? '本段完成' : '完成!')}
                {phase === 'interrupted' && '已中断'}
              </span>
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center justify-center gap-3">
            {phase === 'running' && (
              <>
                {isLong && longClock.segPhase === 'study' && (
                  <button
                    onClick={() => longClock.earlyBreak()}
                    className="px-6 py-3 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition"
                  >
                    提前休息
                  </button>
                )}
                {isLong && longClock.segPhase === 'break' && (
                  <button
                    onClick={() => longClock.startNextStudy()}
                    className="px-6 py-3 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 transition"
                  >
                    开始下一段
                  </button>
                )}
                <button
                  onClick={pause}
                  className="px-6 py-3 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 transition"
                >
                  暂停
                </button>
                {isUnlimited && !isLong && (
                  <button
                    onClick={() => void end()}
                    className="px-6 py-3 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 transition"
                  >
                    结束劳动
                  </button>
                )}
                <button
                  onClick={() => (isLong ? longClock.interrupt() : void interrupt())}
                  className="px-6 py-3 rounded-xl bg-slate-200 text-slate-700 font-medium hover:bg-slate-300 transition"
                >
                  中断
                </button>
              </>
            )}
            {phase === 'paused' && (
              <button
                onClick={resume}
                className="px-6 py-3 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 transition"
              >
                继续
              </button>
            )}
            {(phase === 'completed' || phase === 'interrupted') && (
              <button
                onClick={() => (isLong ? longClock.reset() : reset())}
                className="px-6 py-3 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 transition"
              >
                {isLong ? '重新开始' : '再来一轮'}
              </button>
            )}
          </div>

          {phase === 'completed' && session?.score != null && (
            <div className="pt-2 border-t border-slate-100 flex justify-center gap-8">
              <div>
                <p className="text-xs text-slate-500">本次得分</p>
                <p className="text-2xl font-bold text-brand-600">{session.score}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">完成时长</p>
                <p className="text-2xl font-bold text-slate-900">
                  {Math.floor((totalSeconds - remainingSeconds) / 60)} 分
                </p>
              </div>
              {lastResult?.expGained != null && (
                <div>
                  <p className="text-xs text-slate-500">获得经验</p>
                  <p className="text-2xl font-bold text-amber-500">+{lastResult.expGained}</p>
                </div>
              )}
            </div>
          )}

          {/* 升级/成就庆祝 */}
          {phase === 'completed' && (lastResult?.levelUp || lastResult?.unlockedAchievements?.length) && (
            <div className="pt-3 rounded-xl bg-gradient-to-r from-amber-50 to-brand-50 border border-amber-200 p-4 text-center">
              {lastResult.levelUp && (
                <p className="text-lg font-bold text-amber-600">
                  🎉 升级! Lv.{lastResult.levelUp.from} → Lv.{lastResult.levelUp.to} {lastResult.levelUp.name}
                </p>
              )}
              {lastResult.unlockedAchievements?.map((a) => (
                <p key={a.code} className="mt-1 text-sm text-brand-700">
                  🏅 解锁成就「{a.name}」
                </p>
              ))}
            </div>
          )}

          {/* 巡查统计(仅巡查模式) */}
          {(phase === 'running' || phase === 'completed') && activeMode !== 'off' && (
            <div className="pt-2 border-t border-slate-100 flex justify-center gap-8 text-sm">
              <div>
                <p className="text-xs text-slate-500">已巡查</p>
                <p className="text-lg font-bold text-slate-800">{session?.patrolCount ?? 0} 次</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">违纪提醒</p>
                <p className="text-lg font-bold text-rose-500">{session?.violationCount ?? 0} 次</p>
              </div>
            </div>
          )}

          {/* 判定留档(静态画面 + 判定结果, 仅当前页面内存; 退出页面自动删除; 违纪判定自动上传后端快照) */}
          {activeMode !== 'off' && (
            <PatrolArchivePanel entries={archive} onRemove={removeArchive} onClear={clearArchive} />
          )}
        </div>
      )}
    </div>
  );
}
