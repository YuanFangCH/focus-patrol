import { IsString, Matches, IsOptional, IsBoolean } from 'class-validator';

/** uid 字符集:ABCDEFGHJKMNPQRSTUVWXYZ23456789(排除 0/O/1/I) */
export const UID_REGEX = /^[A-HJ-NP-Z2-9]{8}$/;

export class LoginByUidDto {
  @IsString()
  @Matches(UID_REGEX, { message: 'uid 为 8 位大写字母/数字' })
  uid: string;

  @IsOptional()
  @IsString()
  deviceFp?: string;

  /** 勾选后绑定当前客户端 IP, 下次同 IP 免登录 */
  @IsOptional()
  @IsBoolean()
  rememberIp?: boolean;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}

export class LogoutDto {
  @IsString()
  refreshToken: string;
}
