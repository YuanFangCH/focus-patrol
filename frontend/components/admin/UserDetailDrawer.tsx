'use client';

/** 用户详情抽屉: 基本信息 + 统计卡片 + 最近会话/违纪 + 勋章 + 突击检查 */

import { useEffect, useState } from 'react';
import { adminApi, type AdminUser, type AdminUserDetailResp, type SpotCheckItem, type RealtimeStatus } from '@/lib/api/admin';

interface Props {
  user: AdminUser | null;
  onClose: () => void;
}

export default function UserDetailDrawer({ user, onClose }: Props) {
  const [detail, setDetail] = useState<AdminUserDetailResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [spotBusy, setSpotBusy] = useState(false);
  const [spotMsg, setSpotMsg] = useState('');
  const [spotResult, setSpotResult] = useState<{ result: string; confidence: number; isViolation: boolean; taskId: string } | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<SpotCheckItem[]>([]);
  const [realtime, setRealtime] = useState<RealtimeStatus | null>(null);
  const [realtimeBusy, setRealtimeBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDetail(null);
    setError('');
    setSpotMsg('');
    setSpotResult(null);
    setImgUrl(null);
    setHistory([]);
    setRealtime(null);
    setLoading(true);
    adminApi
      .userDetail(user.id)
      .then(setDetail)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
    // 加载突击检查历史
    void adminApi.spotHistory(user.id)
      .then(setHistory)
      .catch(() => {});
  }, [user]);

  if (!user) return null;

  // 发起突击检查
  const runSpot = async () => {
    setSpotBusy(true);
    setSpotMsg('');
    setSpotResult(null);
    setImgUrl(null);
    try {
      const r = await adminApi.spotCheck(user.id);
      // 按返回的在线/可抓帧状态展示提示
      const msg = !r.online
        ? `⚠️ ${r.hint}`
        : r.canCapture
          ? '✅ 用户在线且当前有会话,突击检查已发起,等待判定…'
          : `ℹ️ ${r.hint},已发起任务`;
      setSpotMsg(msg);
      // 轻量轮询判定结果(用户端提交后 done)
      void pollSpotResult(r.taskId);
    } catch (e) {
      setSpotMsg(`发起失败: ${(e as Error).message}`);
    } finally {
      setSpotBusy(false);
    }
  };

  const pollSpotResult = async (taskId: string) => {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const list = await adminApi.spotHistory(user.id);
        const done = list.find((x) => x.id === taskId && x.status === 'done');
        if (done) {
          setSpotResult({ result: done.result!, confidence: done.confidence ?? 0, isViolation: done.result === 'distracted' || done.result === 'away', taskId });
          setSpotMsg('');
          setHistory(list);
          if (done.hasImage) {
            const url = await adminApi.spotImage(user.id, taskId);
            setImgUrl(url);
          }
          return;
        }
      } catch {
        /* 继续轮询 */
      }
    }
    setSpotMsg('等待超时(用户可能离线或未响应)');
  };

  // 删除图
  const delImage = async () => {
    if (!spotResult) return;
    if (!confirm('确定删除这份突击检查原图?')) return;
    try {
      await adminApi.spotDeleteImage(user.id, spotResult.taskId);
      if (imgUrl) URL.revokeObjectURL(imgUrl);
      setImgUrl(null);
      setSpotMsg('原图已删除');
    } catch (e) {
      setSpotMsg(`删除失败: ${(e as Error).message}`);
    }
  };

  // 实时获取用户状态(按钮触发, 不做自动轮询)
  const loadRealtime = async () => {
    setRealtimeBusy(true);
    try {
      setRealtime(await adminApi.userRealtime(user.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRealtimeBusy(false);
    }
  };

  // 实时状态面板文案
  const realtimeLabel = (c: RealtimeStatus['currentStatus']) =>
    c === 'online-focus' ? '专注中' : c === 'online-break' ? '休整中' : c === 'online-idle' ? '空闲在线' : '离线';
  const fmtDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}小时${m}分` : `${m}分${sec % 60}秒`;
  };

  const stats: Array<{ label: string; value: number; color: string }> = detail
    ? [
        { label: '总会话', value: detail.counts.sessions, color: 'text-brand-600' },
        { label: '已完成', value: detail.counts.completed, color: 'text-emerald-600' },
        { label: '巡查', value: detail.counts.patrols, color: 'text-sky-600' },
        { label: '违纪', value: detail.counts.violations, color: 'text-rose-500' },
        { label: '快照', value: detail.counts.snapshots, color: 'text-amber-600' },
        { label: '好友', value: detail.counts.friends, color: 'text-violet-600' },
        { label: '勋章', value: detail.counts.achievements, color: 'text-slate-700' },
        { label: '未读通知', value: detail.counts.unread, color: 'text-slate-500' },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-slate-900">
              {detail?.user.nickname ?? user.nickname}
              {detail && detail.user.status === 0 && (
                <span className="ml-2 text-xs text-rose-500 font-normal">已禁用</span>
              )}
            </p>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              <span className={`inline-block w-2 h-2 rounded-full mr-1 ${detail?.user.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              uid: {detail?.user.uid ?? user.uid ?? '—'} · id: {user.id.slice(0, 8)}…
              {detail?.user.online && <span className="text-emerald-600 font-normal">(在线)</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">
            ✕
          </button>
        </div>

        {/* 操作区: 改 uid / 突击检查 / 实时状态 */}
        <div className="px-6 pt-4 flex gap-2">
          <button
            onClick={() => {
              const name = prompt('请输入新的 8 位 uid(仅用 ABCDEFGHJKMNPQRSTUVWXYZ23456789)', user.uid ?? '');
              if (!name) return;
              if (!confirm('修改 uid 后该用户旧登录将失效,需用新 uid 重新登录,继续?')) return;
              setSpotMsg('');
              adminApi.setUserUid(user.id, name.toUpperCase())
                .then((r) => { setSpotMsg(`uid 已改为 ${r.uid}`); return adminApi.userDetail(user.id); })
                .then(setDetail)
                .catch((e) => setSpotMsg(`改 uid 失败: ${(e as Error).message}`));
            }}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:border-brand-400 transition"
          >
            修改 uid
          </button>
          <button
            onClick={() => void runSpot()}
            disabled={spotBusy}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${spotBusy ? 'bg-slate-100 text-slate-400' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
          >
            {spotBusy ? '发起中…' : '🕵️ 突击检查'}
          </button>
          <button
            onClick={() => void loadRealtime()}
            disabled={realtimeBusy}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${realtimeBusy ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {realtimeBusy ? '获取中…' : '🔄 实时状态'}
          </button>
        </div>

        {/* 实时状态面板 */}
        {realtime && !loading && (
          <div className="px-6 pt-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">实时状态</p>
                <button
                  onClick={() => void loadRealtime()}
                  disabled={realtimeBusy}
                  className="text-[11px] text-brand-600 hover:underline disabled:opacity-40"
                >
                  {realtimeBusy ? '刷新中…' : '刷新'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${realtime.online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                <span className="text-sm font-medium text-slate-800">
                  {realtimeLabel(realtime.currentStatus)}
                </span>
                {realtime.online && realtime.currentStatus !== 'online-idle' && (
                  <span className="text-xs text-slate-500">已进行 {fmtDuration(realtime.elapsedSeconds)}</span>
                )}
              </div>
              {realtime.runningSession && (
                <div className="text-xs text-slate-600 space-y-1 border-t border-slate-200 pt-2 mt-1">
                  <p>巡查 {realtime.runningSession.mode === 'off' ? '关' : realtime.runningSession.mode === 'camera' ? '📷 摄像头' : '🖥️ 屏幕'} · 本次巡查 {realtime.runningSession.patrolCount} 次</p>
                  <p>
                    违纪 {realtime.runningSession.violationCount} 次
                    {realtime.runningSession.violationCount > 0 && (
                      <span className="text-rose-500 font-semibold"> ⚠️</span>
                    )}
                  </p>
                </div>
              )}
              {realtime.recentViolations.length > 0 && (
                <div className="text-xs border-t border-slate-200 pt-2 mt-1 space-y-1">
                  <p className="text-slate-500 font-medium">最近违规({realtime.recentViolations.length})</p>
                  {realtime.recentViolations.map((v) => (
                    <div key={v.id} className="flex items-center justify-between text-rose-600">
                      <span>{v.result}</span>
                      <span className="text-slate-400">
                        {new Date(v.scheduledAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {realtime.recentViolations.length === 0 && !realtime.runningSession && (
                <p className="text-xs text-slate-400 border-t border-slate-200 pt-2 mt-1">近三个月无违规记录</p>
              )}
            </div>
          </div>
        )}

        {/* 突击检查结果 */}
        {(spotMsg || spotResult || imgUrl) && !loading && (
          <div className="px-6 pt-4 space-y-3">
            {spotMsg && (
              <p className={`text-sm ${spotMsg.includes('失败') || spotMsg.includes('超时') ? 'text-rose-500' : 'text-brand-600'}`}>
                {spotMsg}
              </p>
            )}
            {spotResult && (
              <div className="p-3 rounded-xl bg-slate-50 text-sm">
                <p className="font-medium text-slate-800">
                  判定: {spotResult.result}
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${spotResult.isViolation ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {spotResult.isViolation ? '违规' : '正常'}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">置信度 {(spotResult.confidence * 100).toFixed(0)}%</span>
                </p>
              </div>
            )}
            {imgUrl && (
              <div className="relative inline-block rounded-lg overflow-hidden border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgUrl} alt="突击检查原图" className="max-h-56 rounded-lg" />
                <button
                  onClick={() => void delImage()}
                  className="absolute top-1 right-1 px-2 py-0.5 rounded bg-rose-500 text-white text-xs hover:bg-rose-600"
                >
                  删除原图
                </button>
              </div>
            )}
          </div>
        )}

        <div className="p-6">
          {loading && <p className="text-sm text-slate-400 text-center py-10">加载中…</p>}
          {error && <p className="text-sm text-red-500 text-center py-10">{error}</p>}

          {detail && !loading && (
            <div className="space-y-6">
              {/* 等级信息 */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-50/60 border border-brand-100">
                <span className="text-3xl">
                  {detail.user.honorLevelName === '王者' ? '👑' : detail.user.honorLevelName === '钻石督军' ? '💎' : detail.user.honorLevelName === '黄金督学' ? '🥇' : detail.user.honorLevelName === '白银卫士' ? '🥈' : '🥉'}
                </span>
                <div>
                  <p className="font-bold text-slate-900">
                    {detail.user.honorLevelName ?? '青铜学徒'}
                    <span className="ml-2 text-sm font-normal text-slate-500">{detail.user.honorExp} EXP</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    创建于 {new Date(detail.user.createdAt).toLocaleString('zh-CN')}
                    {detail.user.lastActiveAt && ` · 最近活跃 ${new Date(detail.user.lastActiveAt).toLocaleString('zh-CN')}`}
                  </p>
                </div>
              </div>

              {/* 统计卡片 */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">数据统计</p>
                <div className="grid grid-cols-4 gap-2">
                  {stats.map((s) => (
                    <div key={s.label} className="p-2.5 rounded-xl bg-slate-50 text-center">
                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] text-slate-400">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 最近会话 */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">最近会话</p>
                {detail.recentSessions.length === 0 ? (
                  <p className="text-xs text-slate-300">暂无</p>
                ) : (
                  <div className="space-y-1">
                    {detail.recentSessions.map((s: Record<string, unknown>) => (
                      <div key={String(s.id)} className="px-3 py-2 rounded-lg bg-slate-50 flex items-center justify-between text-xs">
                        <span className="text-slate-600">
                          {String(s.mode)} · {Number(s.durationMinutes)} 分钟 · 得分 {s.score === null || s.score === undefined ? 0 : Number(s.score)}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded ${s.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                          {s.status === 'completed' ? '完成' : String(s.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 最近违纪 */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">最近违纪</p>
                {detail.recentViolations.length === 0 ? (
                  <p className="text-xs text-slate-300">暂无</p>
                ) : (
                  <div className="space-y-1">
                    {detail.recentViolations.map((v: Record<string, unknown>) => (
                      <div key={String(v.id)} className="px-3 py-2 rounded-lg bg-rose-50/60 flex items-center justify-between text-xs">
                        <span className="text-rose-600">{String(v.result)}</span>
                        <span className="text-slate-400">
                          {new Date(String(v.scheduledAt)).toLocaleString('zh-CN')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 勋章 */}
              {detail.achievements.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">勋章</p>
                  <div className="flex flex-wrap gap-2">
                    {detail.achievements.map((a) => (
                      <span
                        key={a.code}
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
          )}
        </div>
      </div>
    </div>
  );
}
