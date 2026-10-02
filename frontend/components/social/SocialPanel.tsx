'use client';

/**
 * 社交面板: 好友列表(在线状态) + 好友申请 + 通知中心
 * 数据来自 /social/* 和 /notifications/*
 */

import { useEffect, useState, useCallback } from 'react';
import {
  socialApi, notificationApi, trackApi,
  type FriendUser, type FriendRequest, type NotificationItem,
} from '@/lib/api/social';
import { useAuthStore } from '@/lib/store/authStore';

type Tab = 'friends' | 'requests' | 'notifications';

export default function SocialPanel() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const [addTarget, setAddTarget] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshAll = useCallback(async () => {
    try {
      const [f, r, n] = await Promise.all([
        socialApi.friends(),
        socialApi.requests(),
        notificationApi.list(20, 0),
      ]);
      setFriends(f.friends);
      setRequests(r.requests);
      setNotifications(n.list);
      setUnread(n.unread);
      // 在线状态轮询
      if (f.friends.length > 0) {
        const o = await trackApi.online(f.friends.map((x) => x.id));
        setOnlineIds(o.online);
      }
    } catch {
      /* 静默 */
    }
  }, []);

  useEffect(() => {
    void refreshAll();
    const t = setInterval(() => void refreshAll(), 30000); // 30s 轮询好友/通知/在线
    return () => clearInterval(t);
  }, [refreshAll]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 3000);
  };

  const handleAdd = async () => {
    if (!addTarget.trim()) return;
    setLoading(true);
    try {
      await socialApi.request(addTarget.trim());
      flash('好友申请已发送');
      setAddTarget('');
      void refreshAll();
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (id: number) => {
    await socialApi.accept(id);
    flash('已接受好友申请');
    void refreshAll();
  };

  const handleReject = async (id: number) => {
    await socialApi.reject(id);
    void refreshAll();
  };

  const handleRemove = async (fid: string) => {
    if (!confirm('确定删除该好友?')) return;
    await socialApi.remove(fid);
    void refreshAll();
  };

  const handleReadAll = async () => {
    await notificationApi.markAllRead();
    setUnread(0);
    setNotifications((ns) => ns.map((n) => ({ ...n, isRead: true })));
  };

  const tabs: Array<{ key: Tab; label: string; badge?: number }> = [
    { key: 'friends', label: '好友', badge: friends.length },
    { key: 'requests', label: '申请', badge: requests.length },
    { key: 'notifications', label: '通知', badge: unread },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Tab */}
      <div className="flex border-b border-slate-100">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-sm font-medium transition ${
              tab === t.key
                ? 'text-brand-600 border-b-2 border-brand-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-brand-600 text-white text-[10px]">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {msg && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-brand-50 text-brand-700 text-xs">
          {msg}
        </div>
      )}

      <div className="p-4 min-h-[220px]">
        {/* 好友 */}
        {tab === 'friends' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={addTarget}
                onChange={(e) => setAddTarget(e.target.value)}
                placeholder="输入对方用户 ID 添加好友"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500"
              />
              <button
                onClick={() => void handleAdd()}
                disabled={loading || !addTarget.trim()}
                className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40 transition"
              >
                添加
              </button>
            </div>
            {friends.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">还没有好友, 输入对方 ID 添加吧</p>
            )}
            {friends.map((f) => {
              const online = onlineIds.includes(f.id);
              return (
                <div key={f.id} className="flex items-center gap-3 py-2">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm">
                      {f.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        f.nickname.slice(0, 1)
                      )}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                        online ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{f.nickname}</p>
                    <p className="text-xs text-slate-400">
                      {online ? '🟢 在线' : '离线'} · Lv.{f.honorLevelId ?? 1} · {f.honorExp} EXP
                    </p>
                  </div>
                  <button
                    onClick={() => void handleRemove(f.id)}
                    className="text-xs text-slate-400 hover:text-rose-500 transition"
                  >
                    删除
                  </button>
                </div>
              );
            })}
            <p className="text-[11px] text-slate-300 text-center pt-1">
              提示: 自己是 {user?.nickname ?? '当前用户'}（ID: {user?.id?.slice(0, 8)}…），可让对方用此 ID 添加
            </p>
          </div>
        )}

        {/* 申请 */}
        {tab === 'requests' && (
          <div className="space-y-2">
            {requests.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">暂无新的好友申请</p>
            )}
            {requests.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm">
                  {r.requester?.nickname?.slice(0, 1) ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {r.requester?.nickname ?? '未知用户'}
                  </p>
                  <p className="text-xs text-slate-400">想加你为好友</p>
                </div>
                <button
                  onClick={() => void handleAccept(r.id)}
                  className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition"
                >
                  接受
                </button>
                <button
                  onClick={() => void handleReject(r.id)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs hover:bg-slate-200 transition"
                >
                  拒绝
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 通知 */}
        {tab === 'notifications' && (
          <div>
            {unread > 0 && (
              <button
                onClick={() => void handleReadAll()}
                className="mb-2 text-xs text-brand-600 hover:underline"
              >
                全部标为已读
              </button>
            )}
            <div className="space-y-1">
              {notifications.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">暂无通知</p>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-3 py-2.5 rounded-xl text-sm ${
                    n.isRead ? 'text-slate-500' : 'bg-brand-50/60 text-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{n.title}</p>
                    {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-1.5 shrink-0" />}
                  </div>
                  {n.body && <p className="text-xs text-slate-400 mt-0.5">{n.body}</p>}
                  <p className="text-[10px] text-slate-300 mt-1">
                    {new Date(n.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
