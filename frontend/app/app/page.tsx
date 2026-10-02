'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, LOGGED_OUT_KEY } from '@/lib/store/authStore';
import { authApi } from '@/lib/api/auth';
import CameraPreview from '@/components/camera/CameraPreview';
import PomodoroTimer from '@/components/pomodoro/PomodoroTimer';
import HonorCard from '@/components/honor/HonorCard';
import SocialPanel from '@/components/social/SocialPanel';
import Link from 'next/link';

export default function AppPage() {
  const { user, logout, setAuth } = useAuthStore();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // 守卫: 无 user 时按序尝试自动登录 —— 主动退出标志 / IP免登(兼容) / 记住的 uid 自动登录; 都失败才跳登录页
  useEffect(() => {
    const run = async () => {
      if (user) {
        setChecking(false);
        return;
      }
      // 主动退出过(本次会话): 不自动登录, 直接跳登录页, 并清标志
      if (sessionStorage.getItem(LOGGED_OUT_KEY)) {
        try { sessionStorage.removeItem(LOGGED_OUT_KEY); } catch { /* 忽略 */ }
        router.replace('/login');
        setChecking(false);
        return;
      }
      try {
        // 1) 兼容 IP 绑定免登
        const pair = await authApi.ipLogin();
        setAuth(pair);
      } catch {
        // 2) 自动用记住的 uid 登录
        const rememberedUid = useAuthStore.getState().rememberedUid;
        if (rememberedUid) {
          try {
            const pair = await authApi.login(rememberedUid);
            setAuth(pair);
          } catch {
            router.replace('/login');
          }
        } else {
          router.replace('/login');
        }
      } finally {
        setChecking(false);
      }
    };
    void run();
  }, [user, router, setAuth]);

  if (!user && checking) return null; // 防闪烁
  if (!user) return null; // 已跳转登录页

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-black text-lg text-slate-900">
            AI 督学馆
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/app/settings"
              className="text-sm text-slate-500 hover:text-brand-600"
            >
              配置
            </Link>
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{user.nickname}</p>
              <p className="text-xs text-slate-400">
                荣誉 Lv.{user.honorLevelId ?? 1} · {user.honorExp} EXP
              </p>
            </div>
            <button
              onClick={() => {
                logout();
                router.push('/');
              }}
              className="text-sm text-slate-500 hover:text-slate-800"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pt-10">
        <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">专注工作台</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左: 摄像头小电视 + 番茄钟 */}
          <div className="lg:col-span-2 space-y-6">
            <CameraPreview />
            <PomodoroTimer />
          </div>

          {/* 右: 荣誉 + 社交 */}
          <div className="space-y-6">
            <HonorCard />
            <SocialPanel />
          </div>
        </div>
      </div>
    </main>
  );
}
