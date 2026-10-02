import Link from 'next/link';

/** 更新日志数据 */
interface ChangeItem {
  type: 'new' | 'improve' | 'fix';
  text: string;
}
interface ChangeVersion {
  date: string;
  version: string;
  title: string;
  summary: string;
  items: ChangeItem[];
}

const TYPE_BADGE: Record<ChangeItem['type'], { label: string; cls: string }> = {
  new: { label: '新增', cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  improve: { label: '优化', cls: 'bg-brand-50 text-brand-600 border-brand-200' },
  fix: { label: '修复', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
};

const CHANGES: ChangeVersion[] = [
  {
    date: '2026-08-10',
    version: 'v0.4.0',
    title: '管理与巡检增强',
    summary: '更强大的后台管理、自动登录、AI 视觉判定与番茄钟升级',
    items: [
      { type: 'new', text: '番茄钟支持自定义单次时长(25~120 分钟), 不再局限于固定档位' },
      { type: 'new', text: '新增「长时间番茄钟」: 设置总学习时长, 自动按[学习+休息]多段交替进行, 可提前休息/随时开始下一段, 休息段不结算荣誉' },
      { type: 'new', text: '登录页「记住这台设备IP」后同 IP 自动登录; 并自动记忆使用过的 uid, 下次打开免输入或直接免登录' },
      { type: 'new', text: '在线状态全局化: 登录后在站内任何页面都保持在线(心跳+突击检查轮询常驻)' },
      { type: 'new', text: '管理面板支持批量改昵称/批量启用/批量禁用, 自定义 8 位 uid, 实时在线状态查看' },
      { type: 'new', text: '管理面板「实时获取用户状态」按钮: 一键查看在线/当前状态/已开始时长/近违规' },
      { type: 'improve', text: '视觉判定支持阿里云百炼等 OpenAI 兼容接口, 可配置视觉模型并统计 API 用量' },
      { type: 'improve', text: '突击检查优化: 在线用户随时可发起, 发起时反馈在线/可抓帧状态' },
      { type: 'fix', text: '修复突击检查原图无法查看 (被统一响应拦截器 JSON 化的问题)' },
      { type: 'fix', text: '修复在线状态偶发显示离线 (省电/切后台导致心跳中断)' },
    ],
  },
  {
    date: '2026-08-08',
    version: 'v0.3.0',
    title: '工作台与摄像头',
    summary: '更顺滑的专注体验与底层能力升级',
    items: [
      { type: 'new', text: '摄像头常开「小电视」: 空闲也能看到自己的画面(仅本机, 不传输)' },
      { type: 'new', text: '配置页新增: 摄像头选择、常态预览开关、巡查频率档位(慢/标准/极限)' },
      { type: 'improve', text: '无限时长模式: 前端正向计时(不受 180 分钟上限限制)' },
      { type: 'improve', text: '配置页支持保存/恢复默认, 未保存离开有提示' },
    ],
  },
  {
    date: '2026-08-07',
    version: 'v0.2.0',
    title: '荣誉体系与社交',
    summary: '从自律到他律',
    items: [
      { type: 'new', text: '荣誉等级体系: 青铜学徒→白银卫士→黄金督学→钻石督军→王者, 专注攒经验升段' },
      { type: 'new', text: '勋章解锁: 完成特定目标自动颁发成就徽章' },
      { type: 'new', text: '好友系统: 互相关注可查看在线状态, 互相监督' },
      { type: 'new', text: '通知中心: 好友申请/事件实时提醒' },
    ],
  },
  {
    date: '2026-08-06',
    version: 'v0.1.0',
    title: '核心能力上线',
    summary: '用 AI 当你的督学官',
    items: [
      { type: 'new', text: '番茄钟专注: 25/45/60 分钟专注, 自动结算得分与经验' },
      { type: 'new', text: 'AI 督学巡查: 摄像头/屏幕 AI 判定专注度, 画面变化才上传(隐私优先)' },
      { type: 'new', text: '违纪快照留存: 判定违纪时留存静态画面(可删除)' },
      { type: 'new', text: '荣誉工作台: 集中展示等级/经验/今日专注' },
      { type: 'new', text: '唯一 uid 登录: 8 位短码即凭证, 无需密码' },
    ],
  },
];

export default function UpdatesPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-14">
        {/* 头部 */}
        <div className="mb-10">
          <Link href="/" className="text-sm text-brand-600 hover:underline">← 返回首页</Link>
          <h1 className="text-3xl font-bold text-slate-900 mt-3">更新日志</h1>
          <p className="text-slate-500 mt-2">
            这里记录督学馆的每一次改动 —— 从第一版到现在的功能变化。
          </p>
        </div>

        <div className="space-y-8">
          {CHANGES.map((v) => (
            <div key={v.version} className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-baseline justify-between mb-1">
                <h2 className="text-lg font-bold text-slate-800">{v.title}</h2>
                <span className="text-sm font-mono text-brand-600">{v.version}</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">{v.date} · {v.summary}</p>
              <ul className="space-y-2">
                {v.items.map((it, i) => {
                  const b = TYPE_BADGE[it.type];
                  return (
                    <li key={i} className={`flex items-start gap-2 text-sm text-slate-600 rounded-lg border px-3 py-2 ${b.cls.replace('border-amber-200','').replace('border-brand-200','').replace('border-emerald-200','')}`}>
                      <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${b.cls}`}>
                        {b.label}
                      </span>
                      <span>{it.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 mt-10">
          AI 督学馆 · 持续迭代中, 更多功能敬请期待
        </p>
      </div>
    </div>
  );
}
