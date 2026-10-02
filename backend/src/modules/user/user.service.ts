import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

@Injectable()
export class UserService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async me(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return null;
    return {
      id: user.id,
      uid: user.uid ?? null,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl ?? null,
      honorLevelId: user.honorLevelId ?? null,
      honorExp: user.honorExp,
      createdAt: user.createdAt,
    };
  }
}
