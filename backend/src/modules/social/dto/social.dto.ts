import { IsUUID, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class RequestFriendDto {
  @IsUUID()
  userId: string;
}

export class FriendshipIdParamDto {
  @Type(() => Number)
  @IsInt()
  id: number;
}

export class FriendIdParamDto {
  @IsUUID()
  userId: string;
}
