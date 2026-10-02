import { IsInt, Min, Max, IsIn, IsOptional } from 'class-validator';

export class CreateSessionDto {
  @IsInt()
  @Min(1)
  @Max(180)
  durationMinutes: number;

  @IsOptional()
  @IsIn(['off', 'camera', 'screen'])
  mode?: 'off' | 'camera' | 'screen';

  /** 会话类型: 专注学习(focus) / 休息(break, 不结算荣誉) */
  @IsOptional()
  @IsIn(['focus', 'break'])
  type?: 'focus' | 'break';
}

export class EndSessionDto {
  @IsInt()
  @Min(0)
  actualSeconds: number;
}

export class ListQueryDto {
  @IsOptional()
  @IsIn(['running', 'completed', 'interrupted'])
  status?: string;

  @IsOptional()
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @IsInt()
  size?: number = 20;
}
