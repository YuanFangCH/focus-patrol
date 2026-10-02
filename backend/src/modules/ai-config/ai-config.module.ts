import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiConfig } from '../../entities/ai-config.entity';
import { AiUsage } from '../../entities/ai-usage.entity';
import { AiConfigService } from './ai-config.service';
import { AiUsageService } from './ai-usage.service';
import { AiConfigController } from './ai-config.controller';
import { LocalIpGuard } from '../admin/local-ip.guard';

@Module({
  imports: [TypeOrmModule.forFeature([AiConfig, AiUsage])],
  controllers: [AiConfigController],
  providers: [AiConfigService, AiUsageService, LocalIpGuard],
  exports: [AiConfigService, AiUsageService],
})
export class AiConfigModule {}
