'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api/auth';
import { useAuthStore, LOGGED_OUT_KEY } from '@/lib/store/authStore';

/** uid 格式:8 位大写字母/数字(排除 0/O/1/I/L) */
const UID_REGEX = /^[A-HJKMNP-Z2-9]{8}$/;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [uid, setUid] = useState(() => useAuthStore.getState().rememberedUid ?? '');
  const [rememberIp, setRememberIp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const uidValid = UID_REGEX.test(uid);

  const login = async () => {
    if (!uidValid || loading) return;
    setLoading(true);
    setError('');
    try {
      // 手动登录即"主动选择登录", 清除退出标志(允许下次自动登录)
      try { sessionStorage.removeItem(LOGGED_OUT_KEY); } catch { /* 忽略 */ }
      const pair = await authApi.login(uid, rememberIp);
      setAuth(pair);
      router.push('/app');
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-center font-black text-2xl text-slate-900 mb-8">
          AI 督学馆
        </Link>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <h1 className="text-xl font-bold text-slate-900 mb-2 text-center">凭 uid 登录</h1>
          <p className="text-sm text-slate-500 text-center mb-6">
            输入你的唯一 uid 进入专注工作台
          </p>

          <div className="space-y-4">
            <input
              value={uid}
              onChange={(e) => setUid(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 8))}
              onKeyDown={(e) => e.key === 'Enter' && login()}
              placeholder="请输入 8 位 uid(如 A7K9Q2M4)"
              disabled={loading}
              autoCapitalize="characters"
              autoComplete="off"
              className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-center text-xl tracking-[0.4em] font-mono font-bold focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
            />

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

            <label className="flex items-center justify-center gap-2 text-sm text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberIp}
                onChange={(e) => setRememberIp(e.target.checked)}
                className="accent-brand-600 w-4 h-4 rounded"
              />
              记住这台设备IP,下次免登录
            </label>

            <button
              onClick={login}
              disabled={!uidValid || loading}
              className="w-full py-3.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 transition disabled:opacity-40"
            >
              {loading ? '登录中…' : '登录'}
            </button>
          </div>

          <p className="mt-6 text-xs text-center text-slate-400">
            还没有 uid?请联系管理员获取。
            <br />
            登录即代表同意
            <Link href="/privacy" className="text-brand-600 hover:underline">隐私政策</Link>
            <span className="mx-1">和</span>
            <Link href="/privacy-camera" className="text-brand-600 hover:underline">巡查说明</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
