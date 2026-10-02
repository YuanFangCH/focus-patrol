import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../entities/notification.entity';

export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'session_report'
  | 'violation'
  | 'system';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
  ) {}

  /** 创建通知 */
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body?: string,
    relatedId?: string,
  ) {
    return this.notifications.save(
      this.notifications.create({ userId, type, title, body, relatedId }),
    );
  }

  /** 列表(倒序) */
  async list(userId: string, limit = 20, offset = 0) {
    const [list, total] = await this.notifications.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    const unread = await this.notifications.count({ where: { userId, isRead: false } });
    return { list, total, unread };
  }

  /** 单条已读 */
  async markRead(userId: string, id: number) {
    const n = await this.notifications.findOne({ where: { id, userId } });
    if (!n) throw new NotFoundException('通知不存在');
    if (!n.isRead) {
      n.isRead = true;
      await this.notifications.save(n);
    }
    return {};
  }

  /** 全部已读 */
  async markAllRead(userId: string) {
    await this.notifications.update({ userId, isRead: false }, { isRead: true });
    return {};
  }
}
