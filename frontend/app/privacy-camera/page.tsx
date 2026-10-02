import Link from 'next/link';

export default function PrivacyCameraPage() {
  const points = [
    { t: '授权方式', c: '每次开始带巡查的专注前,你需明确选择「摄像头」或「屏幕」模式;浏览器会弹出授权框,拒绝即不启用,不会静默降级。' },
    { t: '数据如何被处理', c: '前端本地将视频帧缩小到 32×32 灰度,计算「亮度指纹」;画面无显著变化时不上传。仅在画面变化或抽查命中时,压缩为单帧(最长边 720px)发送判定。' },
    { t: '留存规则', c: '判定为「专注/分心/离席」的普通帧:判定后立即丢弃,不落盘。判定为「违纪」的帧:保存为快照,30 天后自动删除,你可随时删除。' },
    { t: 'AI 厂商', c: '单帧由第三方视觉大模型判定(如豆包视觉/Doubao-vision-pro),仅传递当前帧用于判定,不留存。' },
    { t: '撤回权限', c: '浏览器设置中撤销摄像头/屏幕权限即可停止巡查;共享中断时会明确提示。' },
  ];

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-black text-lg">AI 督学馆</Link>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="text-3xl font-black text-slate-900 mb-2">摄像头 / 屏幕巡查说明</h1>
        <p className="text-slate-500 mb-10">合规与隐私的关键说明,请务必阅读</p>
        <div className="space-y-8">
          {points.map((p) => (
            <div key={p.t}>
              <h2 className="font-bold text-slate-900 mb-2">{p.t}</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{p.c}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
