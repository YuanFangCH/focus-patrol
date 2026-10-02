'use client';

/**
 * 全局运行时的挂载点: 心跳 + 突击检查轮询
 * 挂在 RootLayout, 使登录用户在站点所有页面都能保持在线心跳并响应突击检查。
 */

import Heartbeat from '@/components/common/Heartbeat';
import SpotCheckPoller from '@/components/common/SpotCheckPoller';

export default function AppRuntime() {
  return (
    <>
      <Heartbeat />
      <SpotCheckPoller />
    </>
  );
}
