import { Injectable, OnModuleInit, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AiConfig } from '../../entities/ai-config.entity';
import { deriveKey, encrypt, decrypt } from './cipher.util';

export type AiProvider = 'volcengine' | 'qwen' | 'glm';

/** 各厂商默认配置(启动时 upsert) */
const DEFAULT_CONFIGS: Array<{
  provider: AiProvider;
  modelName: string;
  baseUrl?: string;
  priority: number;
}> = [
  { provider: 'volcengine', modelName: 'doubao-vision-pro', priority: 1 },
  { provider: 'qwen', modelName: 'qwen-vl-plus', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', priority: 2 },
  { provider: 'glm', modelName: 'glm-4v-flash', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', priority: 3 },
];

@Injectable()
export class AiConfigService implements OnModuleInit {
  private readonly logger = new Logger('AiConfig');
  private readonly key: Buffer;

  constructor(
    @InjectRepository(AiConfig) private readonly repo: Repository<AiConfig>,
    private readonly cfg: ConfigService,
  ) {
    this.key = deriveKey(cfg.get('JWT_SECRET') || 'dev_jwt_secret_change_me');
  }

  async onModuleInit() {
    // 启动时补默认行(不覆盖已存在配置)
    for (const d of DEFAULT_CONFIGS) {
      const exists = await this.repo.findOne({ where: { provider: d.provider } });
      if (!exists) {
        await this.repo.save(this.repo.create(d));
      }
    }
    this.logger.log('AiConfig 默认配置就绪');
  }

  /** 加密存储厂商 key(空值不改) */
  async setKey(provider: AiProvider, apiKey?: string, extra?: Partial<AiConfig>) {
    let row = await this.repo.findOne({ where: { provider } });
    if (!row) {
      const def = DEFAULT_CONFIGS.find((d) => d.provider === provider);
      row = await this.repo.save(
        this.repo.create({ provider, modelName: def?.modelName ?? '', priority: def?.priority ?? 9 }),
      );
    }
    const patch: Partial<AiConfig> = {};
    if (apiKey) patch.apiKeyCipher = encrypt(this.key, apiKey);
    if (extra?.modelName) patch.modelName = extra.modelName;
    if (extra?.enabled !== undefined) patch.enabled = extra.enabled;
    if (extra?.dailyQuota !== undefined) patch.dailyQuota = extra.dailyQuota;
    if (extra?.baseUrl) patch.baseUrl = extra.baseUrl;
    await this.repo.update({ id: row.id }, patch);
    return { ok: true };
  }

  /** 解密获取明文 key(供 provider 使用); 无密文返回 null */
  async getKey(provider: AiProvider): Promise<string | null> {
    const row = await this.repo.findOne({ where: { provider } });
    if (!row?.apiKeyCipher) return null;
    return decrypt(this.key, row.apiKeyCipher);
  }

  /** 获取厂商完整配置(模型名/baseUrl/enabled/配额), 供 provider 覆盖 + probe + 面板 */
  async getConfig(provider: AiProvider) {
    const row = await this.repo.findOne({ where: { provider } });
    if (!row) return null;
    return {
      provider: row.provider,
      modelName: row.modelName,
      baseUrl: row.baseUrl ?? null,
      enabled: row.enabled,
      dailyQuota: row.dailyQuota,
      hasKey: !!row.apiKeyCipher,
    };
  }

  /** 列表(仅掩码, 绝不含明文) */
  async listConfigs() {
    const rows = await this.repo.find({ order: { priority: 'ASC' } });
    return rows.map((r) => ({
      provider: r.provider,
      modelName: r.modelName,
      keyMasked: r.apiKeyCipher ? '••••••••(已配置)' : null,
      hasKey: !!r.apiKeyCipher,
      enabled: r.enabled,
      dailyQuota: r.dailyQuota,
      baseUrl: r.baseUrl ?? null,
    }));
  }
}
