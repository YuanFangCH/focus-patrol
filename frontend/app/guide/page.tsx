import Link from 'next/link';

export default function GuidePage() {
  const steps = [
    { n: '1', title: '选择时长', desc: '25 分钟是经典番茄钟,45/60 分钟适合深度工作' },
    { n: '2', title: '选择巡查模式', desc: '不巡查 / 摄像头 / 屏幕。开始前会再次征得你的授权' },
    { n: '3', title: '开始专注', desc: '番茄钟运行中,AI 督学官会随机抽查你的专注状态' },
    { n: '4', title: '结算得分', desc: '结束后按完成比例评分,获得经验值,荣誉等级随之晋升' },
  ];

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-black text-lg">AI 督学馆</Link>
          <Link href="/login" className="text-sm text-brand-600 font-medium">开始专注</Link>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="text-3xl font-black text-slate-900 mb-2">新兵手册</h1>
        <p className="text-slate-500 mb-10">4 步上手,3 分钟读完</p>
        <div className="space-y-6">
          {steps.map((s) => (
            <div key={s.n} className="flex gap-5">
              <div className="w-10 h-10 shrink-0 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center">
                {s.n}
              </div>
              <div>
                <h2 className="font-bold text-slate-900 mb-1">{s.title}</h2>
                <p className="text-slate-500 text-sm">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
