import Link from 'next/link';

export default function PrivacyPage() {
  const sections = [
    { t: '我们收集什么', c: '账号标识(uid)、专注会话数据(时长/得分)、荣誉数据、好友关系。' },
    { t: '我们不收集什么', c: '我们不采集通讯录、位置等无关信息。摄像头/屏幕数据仅在巡查时按需处理,详见「巡查说明」。' },
    { t: '数据存储与安全', c: '密码类数据以哈希形式存储,访问令牌 15 分钟轮换,刷新令牌 30 天过期且旋转。违纪快照 30 天后自动删除。' },
    { t: '你的权利', c: '你可随时注销账号,注销后数据将在一段时间后被彻底删除。' },
  ];

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-black text-lg">AI 督学馆</Link>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="text-3xl font-black text-slate-900 mb-10">隐私政策</h1>
        <div className="space-y-8">
          {sections.map((s) => (
            <div key={s.t}>
              <h2 className="font-bold text-slate-900 mb-2">{s.t}</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{s.c}</p>
            </div>
          ))}
          <p className="text-xs text-slate-400">最后更新:2026-08-06</p>
        </div>
      </div>
    </main>
  );
}
