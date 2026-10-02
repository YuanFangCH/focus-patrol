import { IsOptional, IsString, IsInt, Max, Min, MaxLength, IsIn, IsArray, ArrayNotEmpty, Length } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUsersDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nickname?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  count?: number;
}

export class UserListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  keyword?: string;

  /** 0=禁用 1=正常(可空=全部) */
  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  status?: number;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nickname?: string;

  /** 0=禁用 1=正常 */
  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  status?: number;
}

export class UserIdParamDto {
  @IsString()
  id: string;
}

/** 批量调整(dto 校验:id[] + 可选 nickname/status) */
export class BatchUpdateUsersDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nickname?: string;

  /** 0=禁用 1=正常 */
  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  status?: number;
}

/** 自定义 8 位 uid */
export class SetUidDto {
  @IsString()
  @Length(8, 8)
  uid: string;
}
