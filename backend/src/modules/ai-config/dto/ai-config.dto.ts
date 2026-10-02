import { IsIn, IsOptional, IsString, IsBoolean, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAiConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  modelName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  baseUrl?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  dailyQuota?: number;
}
