import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AiConfigService, AiProvider } from './ai-config.service';
import { AiUsageService } from './ai-usage.service';
import { LocalIpGuard } from '../admin/local-ip.guard';
import { Public } from '../../common/decorators/public.decorator';
import { UpdateAiConfigDto } from './dto/ai-config.dto';

@Controller('admin/ai-config')
@UseGuards(LocalIpGuard)
@Public()
export class AiConfigController {
  constructor(
    private readonly ai: AiConfigService,
    private readonly usage: AiUsageService,
  ) {}

  /** 列表(仅掩码) */
  @Get()
  list() {
    return this.ai.listConfigs();
  }

  /** 用量统计(每厂商今日 + 近 N 天) */
  @Get('usage')
  usageStats(@Query('days') days?: string) {
    const d = Math.min(Math.max(Number(days) || 7, 1), 90);
    return this.usage.stats(d);
  }

  /** 更新厂商配置(apiKey 为空=不改) */
  @Put(':provider')
  update(@Param('provider') provider: AiProvider, @Body() dto: UpdateAiConfigDto) {
    return this.ai.setKey(provider, dto.apiKey, {
      modelName: dto.modelName,
      baseUrl: dto.baseUrl,
      enabled: dto.enabled,
      dailyQuota: dto.dailyQuota,
    });
  }
}
