import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PingDto {
  @IsOptional()
  @IsString()
  @MaxLength(36)
  sessionId?: string;
}

export class OnlineQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  userIds?: string;
}
