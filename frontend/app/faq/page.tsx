import Link from 'next/link';

export default function FaqPage() {
  const faqs = [
    { q: 'AI 巡查是怎么工作的?', a: '前端在本地对视频帧做「亮度指纹」预筛:画面没有明显变化时不上传,只有画面变化或随机抽查命中时才把单帧压缩后发给服务端判定,结果实时反馈。' },
    { q: '摄像头画面会被保存吗?', a: '不会。只有判定为「违纪」的帧才会留存为快照(30 天内自动清理),其余帧判定后立即丢弃。详见「摄像头/屏幕巡查说明」。' },
    { q: '巡查模式可以关闭吗?', a: '可以。开始专注前可选择「不巡查/摄像头/屏幕」,权限可随时撤销,不会静默降级。' },
    { q: '荣誉等级怎么提升?', a: '完成专注会话获得经验值:基础 10 分 + 得分加成。青铜学徒(0)→白银卫士(100)→黄金督学(300)→钻石督军(800)→王者(2000)。' },
    { q: '怎么登录?', a: '向管理员获取你的唯一 uid(8 位大写字母数字),在登录页输入即可。uid 是账号的唯一凭证,请妥善保管。' },
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
        <h1 className="text-3xl font-black text-slate-900 mb-10">常见问题</h1>
        <div className="space-y-4">
          {faqs.map((f) => (
            <details key={f.q} className="group border border-slate-200 rounded-xl px-6 py-4">
              <summary className="font-medium text-slate-900 cursor-pointer list-none flex justify-between items-center">
                {f.q}
                <span className="text-slate-400 group-open:rotate-45 transition">＋</span>
              </summary>
              <p className="mt-3 text-sm text-slate-500 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </main>
  );
}
