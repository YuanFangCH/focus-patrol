import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class EvaluateQueryDto {
  @IsUUID()
  sessionId: string;

  @IsIn(['camera', 'screen'])
  source: 'camera' | 'screen';
}

export class LocalRuleDto {
  @IsUUID()
  sessionId: string;

  @IsIn(['camera', 'screen'])
  source: 'camera' | 'screen';

  /** 命中的本地规则名(如 occluded-black / occluded-white / occluded-solid) */
  @IsString()
  @MaxLength(50)
  rule: string;

  @IsIn(['away'])
  result: 'away';
}

export class SnapshotUploadDto {
  @IsUUID()
  patrolId: string;
}

export class PatrolListQueryDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsString()
  page?: string = '1';

  @IsOptional()
  @IsString()
  size?: string = '20';
}

/** 突击检查提交(query: taskId + 图片 source 可省略, 用前端默认 camera) */
export class SpotCheckSubmitQueryDto {
  @IsUUID()
  taskId: string;

  @IsOptional()
  @IsIn(['camera', 'screen'])
  source?: 'camera' | 'screen' = 'camera';
}

/** 突击检查图片查看/删除(query: taskId) */
export class SpotImageViewQueryDto {
  @IsUUID()
  taskId: string;
}
