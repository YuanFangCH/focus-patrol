import type { Metadata } from 'next';
import './globals.css';
import AppRuntime from '@/components/common/AppRuntime';

export const metadata: Metadata = {
  title: 'AI 督学馆 - 让每一次专注都被看见',
  description: 'AI 督学馆:番茄钟 + AI 巡查 + 荣誉体系,帮你把专注变成习惯。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {/* 全局运行时: 在线心跳 + 突击检查轮询(无 UI) */}
        <AppRuntime />
        {children}
      </body>
    </html>
  );
}
