import Link from 'next/link';

const FEATURES = [
  { icon: '🍅', title: '番茄钟专注', desc: '25/45/60 分钟专注,状态机自动结算得分与经验' },
  { icon: '🤖', title: 'AI 督学巡查', desc: '摄像头/屏幕 AI 判定专注度,画面变化才上传,隐私优先' },
  { icon: '🏅', title: '荣誉体系', desc: '青铜学徒 → 王者,勋章解锁,让坚持被看见' },
  { icon: '👥', title: '好友督学', desc: '互相关注可见在线,互相监督形成习惯' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-50 via-white to-white py-24">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-100 text-brand-700 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
            AI 督学系统 · v0.4.0
            <Link href="/updates" className="ml-1 underline decoration-dotted hover:text-brand-900">更新日志</Link>
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 leading-tight tracking-tight">
            让每一次专注
            <br />
            都被<span className="text-brand-600">看见</span>
          </h1>
          <p className="mt-6 text-xl text-slate-500 max-w-2xl mx-auto">
            番茄钟 + AI 巡查 + 荣誉体系 —— 督学馆用 AI 当你的督学官,
            帮你把「想专注」变成「真专注」。
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="px-8 py-4 rounded-xl bg-brand-600 text-white font-bold text-lg hover:bg-brand-700 transition shadow-xl shadow-brand-600/25"
            >
              开始专注
            </Link>
            <Link
              href="/guide"
              className="px-8 py-4 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-lg hover:border-brand-400 transition"
            >
              新兵手册
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-400">
            凭唯一 uid 登录 · 数据云端保存
          </p>
        </div>
      </section>

      {/* 特性 */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">督学馆能做什么</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-slate-900">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">现在就开始你的第一次专注</h2>
          <p className="text-slate-400 mb-8">3 分钟上手,AI 督学官全程陪伴</p>
          <Link
            href="/login"
            className="inline-block px-10 py-4 rounded-xl bg-brand-500 text-white font-bold text-lg hover:bg-brand-400 transition"
          >
            免费开始
          </Link>
        </div>
      </section>

      <footer className="py-10 text-center text-sm text-slate-400">
        <Link href="/updates" className="hover:text-slate-600">更新日志</Link>
        <span className="mx-3">·</span>
        <Link href="/privacy" className="hover:text-slate-600">隐私政策</Link>
        <span className="mx-3">·</span>
        <Link href="/privacy-camera" className="hover:text-slate-600">摄像头/屏幕巡查说明</Link>
        <span className="mx-3">·</span>
        <Link href="/faq" className="hover:text-slate-600">常见问题</Link>
      </footer>
    </main>
  );
}
