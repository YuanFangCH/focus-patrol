import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../entities/user.entity';
import { IpBinding } from '../../entities/ip-binding.entity';
import { RefreshTokenService } from './refresh-token.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(IpBinding) private readonly ipBindings: Repository<IpBinding>,
    private readonly jwt: JwtService,
    private readonly refresh: RefreshTokenService,
  ) {}

  /**
   * 唯一 uid 登录(纯 uid 即凭证,无密码)
   * uid 由管理员通过 scripts/create-user.js 生成并分发
   */
  async loginByUid(uid: string, deviceFp?: string, rememberIp?: boolean, clientIp?: string) {
    const user = await this.users.findOne({ where: { uid } });
    if (!user) throw new UnauthorizedException('uid 不存在,请联系管理员获取');
    if (user.status !== 1) throw new UnauthorizedException('账号已被禁用');
    // 勾选"记住这台设备IP": 绑定当前 IP 到该用户, 下次同 IP 免登
    if (rememberIp && clientIp) {
      try {
        await this.ipBindings.upsert(
          { ip: clientIp, userId: user.id },
          { conflictPaths: ['ip'] },
        );
      } catch (e) {
        // 绑定失败不阻塞登录
        console.warn('IP 绑定失败:', (e as Error).message);
      }
    }
    return this.buildTokens(user, deviceFp);
  }

  /** 基于客户端 IP 的免登录: 命中绑定则签发 token, 否则 401 */
  async loginByIp(clientIp: string) {
    if (!clientIp) throw new UnauthorizedException('无法获取客户端 IP');
    const binding = await this.ipBindings.findOne({ where: { ip: clientIp } });
    if (!binding) throw new UnauthorizedException('该 IP 未绑定账号');
    const user = await this.users.findOne({ where: { id: binding.userId } });
    if (!user || user.status !== 1) {
      throw new UnauthorizedException('绑定账号不可用');
    }
    return this.buildTokens(user);
  }

  async refreshTokens(raw: string, deviceFp?: string) {
    const result = await this.refresh.rotate(raw, deviceFp);
    if (!result) throw new UnauthorizedException('refresh token 无效或已过期');
    const user = await this.users.findOne({ where: { id: result.userId } });
    if (!user || user.status !== 1) throw new UnauthorizedException('账号不可用');
    return this.buildTokens(user, deviceFp);
  }

  async logout(raw: string) {
    await this.refresh.rotate(raw); // 轮换即可吊销旧 token
    return {};
  }

  private async buildTokens(user: User, deviceFp?: string): Promise<TokenPair & { user: unknown }> {
    const accessToken = this.jwt.sign({
      sub: user.id,
      uid: user.uid,
      tv: user.tokenVersion,
    });
    const refreshToken = await this.refresh.issue(user.id, deviceFp);
    return { accessToken, refreshToken, user: this.safeUser(user) };
  }

  private safeUser(user: User) {
    return {
      id: user.id,
      uid: user.uid ?? null,
      nickname: user.nickname,
      honorLevelId: user.honorLevelId ?? null,
      honorExp: user.honorExp,
    };
  }
}
