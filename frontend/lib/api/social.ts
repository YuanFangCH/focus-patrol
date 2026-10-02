import { api } from './client';

export interface HonorLevel {
  id: number;
  name: string;
  minExp: number;
  iconUrl?: string | null;
}

export interface Achievement {
  id: number;
  code: string;
  name: string;
  iconUrl?: string | null;
  description?: string;
}

export interface HonorMe {
  level: HonorLevel;
  exp: number;
  nextMinExp: number | null;
  achievements: Achievement[];
}

export const honorApi = {
  me: () => api.get<HonorMe>('/honor/me'),
  levels: () => api.get<HonorLevel[]>('/honor/levels', false),
};

export interface FriendUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  honorLevelId: number | null;
  honorExp: number;
}

export interface FriendRequest {
  id: number;
  requester: FriendUser | null;
  requestedAt: string;
}

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body?: string | null;
  relatedId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export const socialApi = {
  requests: () => api.get<{ requests: FriendRequest[] }>('/social/requests'),
  request: (userId: string) => api.post('/social/requests', { userId }),
  accept: (id: number) => api.post(`/social/requests/${id}/accept`, {}),
  reject: (id: number) => api.post(`/social/requests/${id}/reject`, {}),
  friends: () => api.get<{ friends: FriendUser[] }>('/social/friends'),
  remove: (userId: string) => api.delete(`/social/friends/${userId}`),
};

export const notificationApi = {
  list: (limit = 20, offset = 0) =>
    api.get<{ list: NotificationItem[]; total: number; unread: number }>(
      `/notifications?limit=${limit}&offset=${offset}`,
    ),
  markRead: (id: number) => api.post(`/notifications/${id}/read`, {}),
  markAllRead: () => api.post('/notifications/read-all', {}),
};

export const trackApi = {
  ping: (sessionId?: string) => api.post('/track/ping', { sessionId }),
  leave: () => api.post('/track/leave', {}),
  online: (userIds: string[]) => api.get<{ online: string[] }>(`/track/online?userIds=${userIds.join(',')}`),
};
