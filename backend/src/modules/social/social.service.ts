import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friendship } from '../../entities/friendship.entity';
import { User } from '../../entities/user.entity';
import { NotificationService } from '../notification/notification.service';

/** 好友返回的用户信息裁剪 */
function pickUser(u: User) {
  return { id: u.id, nickname: u.nickname, avatarUrl: u.avatarUrl ?? null, honorLevelId: u.honorLevelId, honorExp: u.honorExp };
}

@Injectable()
export class SocialService {
  constructor(
    @InjectRepository(Friendship) private readonly friendships: Repository<Friendship>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly notifications: NotificationService,
  ) {}

  /** 发给我的好友申请列表(含对方信息) */
  async requests(userId: string) {
    const rows = await this.friendships.find({
      where: { addresseeId: userId, status: 'pending' },
      order: { requestedAt: 'DESC' },
    });
    const userIds = [...new Set(rows.map((r) => r.requesterId))];
    const users = userIds.length ? await this.users.find({ where: userIds.map((id) => ({ id })) }) : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    return {
      requests: rows.map((r) => ({
        id: r.id,
        requester: userMap.get(r.requesterId) ? pickUser(userMap.get(r.requesterId)!) : null,
        requestedAt: r.requestedAt,
      })),
    };
  }

  /** 发起好友申请 */
  async request(userId: string, addresseeId: string) {
    if (userId === addresseeId) throw new BadRequestException('不能添加自己为好友');
    const target = await this.users.findOne({ where: { id: addresseeId } });
    if (!target) throw new NotFoundException('用户不存在');

    // 双向查重: 我→对方 或 对方→我 已存在关系(含已拒绝)
    const existing = await this.friendships.findOne({
      where: [
        { requesterId: userId, addresseeId },
        { requesterId: addresseeId, addresseeId: userId },
      ],
    });
    if (existing) {
      if (existing.status === 'pending') {
        // 对方已申请我 → 直接接受
        return this.accept(userId, existing.id);
      }
      if (existing.status === 'accepted') {
        throw new ConflictException('你们已经是好友了');
      }
      // rejected → 更新为重新申请
      existing.status = 'pending';
      existing.requestedAt = new Date();
      existing.respondedAt = undefined as unknown as Date;
      await this.friendships.save(existing);
    } else {
      await this.friendships.save(
        this.friendships.create({ requesterId: userId, addresseeId, status: 'pending' }),
      );
    }
    // 通知对方
    const me = await this.users.findOne({ where: { id: userId } });
    await this.notifications.create(
      addresseeId,
      'friend_request',
      `${me?.nickname ?? '有人'} 申请加你为好友`,
      '点击查看并处理好友申请',
      userId,
    );
    return {};
  }

  /** 接受申请 */
  async accept(userId: string, friendshipId: number) {
    const f = await this.friendships.findOne({ where: { id: friendshipId } });
    if (!f) throw new NotFoundException('申请不存在');
    if (f.addresseeId !== userId) throw new BadRequestException('无权处理该申请');
    if (f.status === 'accepted') return {};
    f.status = 'accepted';
    f.respondedAt = new Date();
    await this.friendships.save(f);
    // 通知对方: 已同意
    const me = await this.users.findOne({ where: { id: userId } });
    await this.notifications.create(
      f.requesterId,
      'friend_accepted',
      `${me?.nickname ?? '对方'} 同意了你的好友申请`,
      '你们现在可以互相看到对方的在线状态了',
      userId,
    );
    return {};
  }

  /** 拒绝申请 */
  async reject(userId: string, friendshipId: number) {
    const f = await this.friendships.findOne({ where: { id: friendshipId } });
    if (!f) throw new NotFoundException('申请不存在');
    if (f.addresseeId !== userId) throw new BadRequestException('无权处理该申请');
    if (f.status !== 'pending') throw new BadRequestException('该申请已处理');
    f.status = 'rejected';
    f.respondedAt = new Date();
    await this.friendships.save(f);
    return {};
  }

  /** 好友列表(含在线状态由 Track 模块补充) */
  async friends(userId: string) {
    const rows = await this.friendships.find({
      where: [{ requesterId: userId, status: 'accepted' }, { addresseeId: userId, status: 'accepted' }],
      order: { respondedAt: 'DESC' },
    });
    const friendIds = rows.map((r) =>
      r.requesterId === userId ? r.addresseeId : r.requesterId,
    );
    const users = friendIds.length
      ? await this.users.find({ where: friendIds.map((id) => ({ id })) })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    return {
      friends: friendIds
        .map((id) => (userMap.get(id) ? pickUser(userMap.get(id)!) : null))
        .filter(Boolean),
    };
  }

  /** 删除好友 */
  async remove(userId: string, friendId: string) {
    const f = await this.friendships.findOne({
      where: [
        { requesterId: userId, addresseeId: friendId, status: 'accepted' },
        { requesterId: friendId, addresseeId: userId, status: 'accepted' },
      ],
    });
    if (!f) throw new NotFoundException('好友关系不存在');
    await this.friendships.delete(f.id);
    return {};
  }
}
