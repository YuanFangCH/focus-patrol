import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { MockVisionProvider } from './providers/mock-vision.provider';
import { QwenProvider } from './providers/qwen.provider';
import { VolcengineProvider } from './providers/volcengine.provider';
import { GlmProvider } from './providers/glm.provider';
import { IFocusVisionProvider, VisionResult, FocusContext, AiProviderKey } from './vision.types';
import { AiConfigService } from '../modules/ai-config/ai-config.service';
import { AiUsageService } from '../modules/ai-config/ai-usage.service';

/** providerKey → env 中对应厂商 API key 变量名(可用性探测兜底) */
const ENV_KEY_MAP: Record<AiProviderKey, string> = {
  volcengine: 'VOLC_API_KEY',
  qwen: 'QWEN_API_KEY',
  glm: 'GLM_API_KEY',
  mock: '',
};

/**
 * 视觉判定路由(免费优先):
 * 1. AI_PROVIDER=mock → MockProvider(开发期)
 * 2. 免费模型优先: GLM(免费) → Qwen(付费兜底) → Volcengine(最后)
 * 3. 可用性过滤: 仅保留已配置有效 key 的通道(未配 key 的厂商不空转 401)
 * 4. API key 来源: env 优先, AiConfig 加密表兜底(管理面板配置, 不出后端)
 * 5. 每次调用记录用量(ai_usage, 按日聚合); 失败即切下一通道
 * 6. 全部失败 → 返回 unknown(不罚用户)
 */
@Injectable()
export class AIVisionRouter implements OnModuleInit {
  private readonly logger = new Logger('AIVisionRouter');
  private providers: IFocusVisionProvider[] = [];

  constructor(
    private readonly cfg: ConfigService,
    http: HttpService,
    private readonly aiConfig?: AiConfigService,
    private readonly aiUsage?: AiUsageService,
  ) {
    const mode = cfg.get<string>('AI_PROVIDER') || 'mock';
    if (mode === 'mock') {
      this.providers = [new MockVisionProvider()];
      this.logger.warn('AI_PROVIDER=mock,使用 Mock 判定(开发期)');
    } else {
      // 免费优先: GLM(免费)最前, Qwen(付费)兜底, Volcengine 最后
      this.providers = [
        new GlmProvider(http, cfg),
        new QwenProvider(http, cfg),
        new VolcengineProvider(http, cfg),
      ];
    }
  }

  async onModuleInit() {
    // 记录已配置有效 key 的通道(env 或 ai_configs 加密表任一命中)
    const keyOk = new Set<AiProviderKey>();

    // 仅 mock 模式不注入(无真实 key 概念); 其它模式从 AiConfig 加密表兜底注入 env 缺失的 key/模型/baseUrl
    if (this.providers.some((p) => p.providerKey !== 'mock') && this.aiConfig) {
      for (const p of this.providers) {
        try {
          // key: 用 providerKey(对应 ai_configs.provider 键)查
          const envKeyVar = ENV_KEY_MAP[p.providerKey];
          const hasEnvKey = !!envKeyVar && !!this.cfg.get<string>(envKeyVar);
          const key = hasEnvKey ? this.cfg.get<string>(envKeyVar) : await this.aiConfig.getKey(p.providerKey as 'volcengine' | 'qwen' | 'glm');
          if (key && p.setKey) {
            p.setKey(key);
            keyOk.add(p.providerKey);
            this.logger.log(`[${p.providerKey}] key 就绪(${hasEnvKey ? 'env' : 'AiConfig 加密表'})`);
          }
          // 模型名 / baseUrl: 从 ai_configs 覆盖 provider
          const conf = await this.aiConfig.getConfig(p.providerKey as 'volcengine' | 'qwen' | 'glm');
          if (conf) {
            p.setModel?.(conf.modelName);
            if (conf.baseUrl) p.setBaseUrl?.(conf.baseUrl);
          }
        } catch (e) {
          this.logger.warn(`[${p.providerKey}] AiConfig 注入失败: ${(e as Error).message}`);
        }
      }
    }

    this.applyAvailabilityFilter(keyOk);
  }

  /** 可用性过滤: 仅保留已配置有效 key 的通道(mock 恒保留, 未配 key 的厂商不空转 401) */
  private applyAvailabilityFilter(keyOk: Set<AiProviderKey>) {
    const original = this.providers.map((p) => p.providerKey);
    this.providers = this.providers.filter((p) => {
      if (p.providerKey === 'mock') return true; // mock 无 key 也应保留
      return keyOk.has(p.providerKey);
    });
    const effective = this.providers.map((p) => p.providerKey);
    if (original.join(',') !== effective.join(',')) {
      this.logger.log(`可用通道过滤(免费优先, 未配 key 跳过): ${original.join(' → ')} => ${effective.join(' → ')}`);
    } else {
      this.logger.log(`可用视觉通道: ${effective.join(' → ')}`);
    }
  }

  async evaluate(image: Buffer, ctx: FocusContext): Promise<VisionResult> {
    for (const provider of this.providers) {
      try {
        const result = await provider.evaluate(image, ctx);
        this.logger.log(`[${provider.providerKey}] → ${result.result} conf=${result.confidence}`);
        // 用量埋点(成功): 记录该厂商本次调用 tokens
        if (this.aiUsage) {
          await this.aiUsage.record({
            provider: provider.providerKey,
            model: result.model,
            tokens: result.usage?.totalTokens,
          });
        }
        return result;
      } catch (e) {
        this.logger.error(`[${provider.providerKey}] 判定失败: ${(e as Error).message}`);
        // 失败也计一次调用(区分于成功, token 记为 0)
        if (this.aiUsage) {
          await this.aiUsage.record({ provider: provider.providerKey, model: provider.name, tokens: 0 });
        }
      }
    }
    return { result: 'unknown', confidence: 0, model: 'none' };
  }
}
