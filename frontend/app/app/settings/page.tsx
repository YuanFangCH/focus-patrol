'use client';

/** 配置页：改动后需手动点「保存」才写入生效 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSettingsStore, SETTINGS_DEFAULTS, type WorkMode, type PatrolFrequency } from '@/lib/store/settingsStore';
import { requestCameraStream, normalizeCameraError } from '@/lib/vision/cameraAccess';

// ---------- 局部小组件 ----------

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <p className="font-bold text-slate-900">{title}</p>
      {children}
    </div>
  );
}

function Toggle({
  checked, onChange, disabled, label, hint, badge,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
  badge?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 py-1 ${disabled ? 'opacity-60' : ''}`}>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm text-slate-700">{label}</p>
          {badge && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px]">
              {badge}
            </span>
          )}
        </div>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition shrink-0 ${checked ? 'bg-brand-600' : 'bg-slate-200'} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function RadioCard({
  label, desc, checked, onClick, disabled,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border transition ${
        checked
          ? 'border-brand-500 bg-brand-50/60'
          : 'border-slate-200 hover:border-brand-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <p className={`text-sm font-medium ${checked ? 'text-brand-700' : 'text-slate-700'}`}>{label}</p>
      {desc && <p className="text-xs text-slate-400 mt-0.5">{desc}</p>}
    </button>
  );
}

// ---------- 常量 ----------

const WORK_MODES: Array<{ value: WorkMode; label: string; desc: string }> = [
  { value: 'pomodoro', label: '番茄钟', desc: '限时劳动 + 休整' },
  { value: 'unlimited', label: '无限时长', desc: '持续劳动, 手动结束' },
];

const PATROL_MODES: Array<{ value: 'off' | 'camera' | 'screen'; label: string; desc: string }> = [
  { value: 'off', label: '不巡查', desc: '纯计时' },
  { value: 'camera', label: '摄像头巡查', desc: 'AI 检查是否专注' },
  { value: 'screen', label: '屏幕巡查', desc: 'AI 检查屏幕内容(仅桌面 Chrome/Edge)' },
];

const FREQUENCIES: Array<{ value: PatrolFrequency; label: string; desc: string }> = [
  { value: 'slow', label: '慢速', desc: '1-2 分钟一次' },
  { value: 'normal', label: '正常', desc: '30 秒-1 分钟一次' },
  { value: 'nightmare', label: '噩梦', desc: '8-15 秒一次' },
];

// ---------- 页面 ----------

export default function SettingsPage() {
  const s = useSettingsStore();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [cameraList, setCameraList] = useState<MediaDeviceInfo[]>([]);
  const [permState, setPermState] = useState<'idle' | 'granted' | 'denied' | 'no-camera'>('idle');
  const [requesting, setRequesting] = useState(false);

  // 编辑草稿: 改动只存 draft, 点「保存」才写入 store
  const snapshot = () => ({
    workMode: s.workMode,
    patrolMode: s.patrolMode,
    patrolFrequency: s.patrolFrequency,
    filmFilter: s.filmFilter,
    workMinutes: s.workMinutes,
    breakMinutes: s.breakMinutes,
    longMode: s.longMode,
    longTotalMinutes: s.longTotalMinutes,
    longStudyMinutes: s.longStudyMinutes,
    longBreakMinutes: s.longBreakMinutes,
    archiveEnabled: s.archiveEnabled,
    cameraDeviceId: s.cameraDeviceId,
    cameraPreview: s.cameraPreview,
  });
  const [draft, setDraft] = useState(snapshot);
  const [dirty, setDirty] = useState(false);

  const update = (partial: Partial<ReturnType<typeof snapshot>>) => {
    setDraft((d) => ({ ...d, ...partial }));
    setDirty(true);
  };

  const notify = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  // 保存: draft 写入 store 生效
  const save = () => {
    s.set(draft);
    setDirty(false);
    notify();
  };

  // 取消: draft 回滚到已保存值
  const cancel = () => {
    setDraft(snapshot());
    setDirty(false);
  };

  // 恢复默认: 重置草稿为默认(需再点保存)
  const resetDraft = () => {
    setDraft({ ...SETTINGS_DEFAULTS });
    setDirty(true);
  };

  // 返回工作台: 有未保存改动时拦截
  const goBack = () => {
    if (dirty && !confirm('有未保存的修改,确定丢弃吗?')) return;
    router.push('/app');
  };

  // 检测摄像头: 先请求权限(让 enumerateDevices 返回完整 label), 再枚举所有 videoinput
  // iOS Safari 兼容: 必须在用户手势(点击)中调用, 因此不再在 useEffect 自动执行
  const refreshCams = async () => {
    if (requesting) return; // 防重复点击
    if (!navigator.mediaDevices?.enumerateDevices) {
      setPermState('denied');
      return;
    }
    setRequesting(true);
    let granted = true;
    try {
      // 1) 先 getUserMedia 授权(短暂点亮指示灯), 获取到完整设备 label
      const stream = await requestCameraStream({ width: 320, height: 240 });
      stream.getTracks().forEach((t) => t.stop()); // 立即关闭,不占用摄像头
    } catch (e) {
      granted = false; // 用户拒绝权限 / 非 HTTPS 等
      const err = normalizeCameraError(e);
      console.warn('[settings] 摄像头授权失败:', err.message);
    }
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const cams = devs.filter((d) => d.kind === 'videoinput');
      setCameraList(cams);
      setPermState(
        granted && cams.length > 0 ? 'granted'
          : granted ? 'no-camera'
          : 'denied',
      );
    } catch {
      setPermState('denied');
    } finally {
      setRequesting(false);
    }
  };

  const noCameras = cameraList.length === 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="text-slate-500 hover:text-slate-800 text-sm">
              ← 工作台
            </button>
            <p className="font-black text-slate-900">配置</p>
          </div>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                已保存 ✓
              </span>
            )}
            {dirty && (
              <button
                onClick={cancel}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-600 text-sm hover:border-slate-400 transition"
              >
                取消
              </button>
            )}
            <button
              onClick={save}
              className="px-4 py-1.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition"
            >
              保存
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
        {/* 1. 劳动模式 */}
        <SectionCard title="劳动模式">
          <div className="grid grid-cols-2 gap-3">
            {WORK_MODES.map((m) => (
              <RadioCard
                key={m.value}
                label={m.label}
                desc={m.desc}
                checked={draft.workMode === m.value}
                onClick={() => update({ workMode: m.value })}
              />
            ))}
          </div>
        </SectionCard>

        {/* 2. 巡查模式 */}
        <SectionCard title="巡查模式">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PATROL_MODES.map((m) => (
              <RadioCard
                key={m.value}
                label={m.label}
                desc={m.desc}
                checked={draft.patrolMode === m.value}
                onClick={() => update({ patrolMode: m.value })}
              />
            ))}
          </div>
        </SectionCard>

        {/* 3. 巡查频率 */}
        <SectionCard title="巡查频率">
          <div className="grid grid-cols-3 gap-3">
            {FREQUENCIES.map((f) => (
              <RadioCard
                key={f.value}
                label={f.label}
                desc={f.desc}
                checked={draft.patrolFrequency === f.value}
                onClick={() => update({ patrolFrequency: f.value })}
              />
            ))}
          </div>
        </SectionCard>

        {/* 4. 摄像头 */}
        <SectionCard title="摄像头">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-700">选择要使用的摄像头</p>
              <button
                onClick={() => void refreshCams()}
                disabled={requesting}
                className={`px-3 py-1.5 rounded-lg text-xs transition ${
                  requesting
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
                }`}
              >
                {requesting ? '检测中…' : cameraList.length > 0 ? '重新检测' : '检测摄像头'}
              </button>
            </div>
            <select
              value={draft.cameraDeviceId}
              onChange={(e) => update({ cameraDeviceId: e.target.value })}
              disabled={noCameras || requesting}
              className={`w-full px-3 py-2.5 rounded-xl border text-sm bg-white focus:outline-none focus:border-brand-500 ${
                noCameras ? 'border-slate-200 text-slate-400' : 'border-slate-200 text-slate-800'
              }`}
            >
              <option value="">(默认) 自动选择</option>
              {cameraList.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `摄像头 ${i + 1}`} · {d.deviceId.slice(0, 8)}…
                </option>
              ))}
            </select>
            {/* 三态提示 */}
            <div className="mt-2 text-xs">
              {requesting ? (
                <p className="text-slate-400">正在检测摄像头…</p>
              ) : permState === 'denied' ? (
                <>
                  <p className="text-amber-500">
                    未授予摄像头权限,请在浏览器地址栏相机图标处允许访问后点击「重新检测」。
                  </p>
                  <p className="text-slate-400 mt-1">
                    首次点击「检测摄像头」会弹出授权请求,允许后可显示摄像头名称。
                    {typeof window !== 'undefined' && !window.isSecureContext && (
                      <span className="block mt-1 text-rose-500">
                        ⚠️ 当前为非 HTTPS 连接, iOS 设备无法使用摄像头, 请通过 https:// 地址访问。
                      </span>
                    )}
                  </p>
                </>
              ) : permState === 'no-camera' ? (
                <p className="text-amber-500">未检测到可用摄像头,请确认已连接摄像头后重新检测。</p>
              ) : (
                <p className="text-slate-400">检测到 {cameraList.length} 个摄像头 · 选择后用于摄像头巡查</p>
              )}
            </div>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <Toggle
              checked={draft.cameraPreview}
              onChange={(v) => update({ cameraPreview: v })}
              label="摄像头常开"
              hint="开启后,摄像头巡查时在本机实时显示自己的画面(仅本机可见,不传输,判定逻辑不变)"
            />
          </div>
        </SectionCard>

        {/* 5. 画面 */}
        <SectionCard title="画面">
          <Toggle
            checked={draft.filmFilter}
            onChange={(v) => update({ filmFilter: v })}
            label="黑白做旧滤镜"
            badge="即将上线"
          />
        </SectionCard>

        {/* 6. 时长 */}
        <SectionCard title="劳动 / 休整时长">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-700 mb-1.5">工作 / 劳动</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={draft.workMinutes}
                  onChange={(e) => {
                    const v = Math.min(180, Math.max(1, Number(e.target.value) || 1));
                    update({ workMinutes: v });
                  }}
                  className="w-20 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500"
                />
                <span className="text-xs text-slate-400">分</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-700 mb-1.5">休整 / 休息</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={draft.breakMinutes}
                  onChange={(e) => {
                    const v = Math.min(60, Math.max(0, Number(e.target.value) || 0));
                    update({ breakMinutes: v });
                  }}
                  className="w-20 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500"
                />
                <span className="text-xs text-slate-400">分</span>
              </div>
            </div>
          </div>

          {/* 长时间番茄钟配置 */}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            <Toggle
              checked={draft.longMode}
              onChange={(v) => update({ longMode: v })}
              label="长时间番茄钟"
              hint="设置总学习时长,自动按[学习+休息]多段交替进行"
            />
            {draft.longMode && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">总学习(分)</p>
                  <input
                    type="number" min={30} max={4320}
                    value={draft.longTotalMinutes}
                    onChange={(e) => update({ longTotalMinutes: Math.min(4320, Math.max(30, Number(e.target.value) || 30)) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">单段学习(分)</p>
                  <input
                    type="number" min={25}
                    max={draft.longTotalMinutes}
                    value={draft.longStudyMinutes}
                    onChange={(e) => update({ longStudyMinutes: Math.min(draft.longTotalMinutes, Math.max(25, Number(e.target.value) || 25)) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">25~总时长</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">单段休息(分)</p>
                  <input
                    type="number" min={1} max={30}
                    value={draft.longBreakMinutes}
                    onChange={(e) => update({ longBreakMinutes: Math.min(30, Math.max(1, Number(e.target.value) || 1)) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">1~30</p>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* 7. 其他 */}
        <SectionCard title="其他">
          <div className="border-b border-slate-100 pb-3">
            <Toggle
              checked={draft.archiveEnabled}
              onChange={(v) => update({ archiveEnabled: v })}
              label="巡查判定留档"
              hint="允许后续巡查判定留档(抽样留存静态画面与判定结果,用于质量核查)"
              badge="即将上线"
            />
          </div>
          <div className="pt-1 space-y-2">
            <button
              disabled
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 text-slate-400 text-sm font-medium cursor-not-allowed"
            >
              试机 / 校准 — 即将上线
            </button>
            <button
              disabled
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 text-slate-400 text-sm font-medium cursor-not-allowed"
            >
              安装到桌面 — 即将上线
            </button>
          </div>
        </SectionCard>

        {/* 保存 / 恢复默认 */}
        <div className="space-y-3 text-center pb-8">
          {dirty && (
            <p className="text-xs text-amber-500">有未保存的修改,记得点击「保存配置」生效</p>
          )}
          <button
            onClick={save}
            className={`${dirty ? 'animate-pulse' : ''} w-full py-3.5 rounded-2xl bg-brand-600 text-white text-base font-bold hover:bg-brand-700 transition shadow-lg shadow-brand-600/20`}
          >
            保存配置
          </button>
          <button
            onClick={resetDraft}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-sm hover:border-rose-400 hover:text-rose-500 transition"
          >
            恢复默认设置
          </button>
          <p className="text-xs text-slate-300">
            配置保存在本设备浏览器(localStorage),换设备需重新设置 · 改动需点击「保存」才生效
          </p>
        </div>
      </div>
    </main>
  );
}
