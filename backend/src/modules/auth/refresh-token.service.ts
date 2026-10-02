import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RefreshToken } from '../../entities/refresh-token.entity';

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken) private readonly repo: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
  ) {}

  /** 签发 refresh token(随机 64 字符),库里只存 sha256 */
  async issue(userId: string, deviceFp?: string): Promise<string> {
    const raw = crypto.randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    await this.repo.save(
      this.repo.create({ userId, tokenHash, deviceFp, expiresAt }),
    );
    return raw;
  }

  /** 轮换:校验旧 token,吊销并返回新 token;检测到重放则返回 null(上层吊销全链) */
  async rotate(raw: string, deviceFp?: string): Promise<{ userId: string; newToken: string } | null> {
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    const row = await this.repo.findOne({ where: { tokenHash } });
    if (!row) return null;
    if (row.revokedAt) {
      // 旧 token 被吊销后再次使用 → 疑似重放,吊销该用户全部 token
      if (row.replacedBy) {
        await this.repo.update(
          { userId: row.userId, revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
      }
      return null;
    }
    if (row.expiresAt < new Date()) return null;

    const newToken = crypto.randomBytes(48).toString('base64url');
    const newHash = crypto.createHash('sha256').update(newToken).digest('hex');
    const newRow = await this.repo.save(
      this.repo.create({
        userId: row.userId,
        tokenHash: newHash,
        deviceFp,
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      }),
    );
    row.revokedAt = new Date();
    row.replacedBy = String(newRow.id);
    await this.repo.save(row);
    return { userId: row.userId, newToken };
  }

  async revokeAll(userId: string) {
    await this.repo.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  get refreshSecret(): string {
    return this.cfg.get('JWT_REFRESH_SECRET') || 'dev_refresh_secret_change_me';
  }
}
