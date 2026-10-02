import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AI 督学馆',
    short_name: '督学馆',
    description: '番茄钟 + AI 巡查 + 荣誉体系,让每一次专注都被看见',
    start_url: '/app',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#4f46e5',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
