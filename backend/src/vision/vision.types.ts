export type FocusVerdict = 'focus' | 'distracted' | 'away';

export interface FocusContext {
  sessionId: string;
  source: 'camera' | 'screen';
  ts: number;
}

export interface VisionResult {
  result: FocusVerdict | 'unknown';
  confidence: number;
  model: string;
  /** 该次调用的 tokens 用量(来自 OpenAI 兼容响应 usage) */
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

/** ai_configs 表的 provider 键 */
export type AiProviderKey = 'volcengine' | 'qwen' | 'glm' | 'mock';

/** AI 视觉判定统一抽象:任何厂商适配器实现该接口 */
export interface IFocusVisionProvider {
  readonly name: string;
  /** 对应 ai_configs.provider 键, 用于从加密表注入 key(区别于 name 模型名) */
  readonly providerKey: AiProviderKey;
  evaluate(image: Buffer, ctx: FocusContext): Promise<VisionResult>;
  /** 覆盖/注入 API key(env 缺失时由 AiConfig 加密表兜底) */
  setKey?(key: string): void;
  /** 覆盖模型名(ai_configs.modelName) */
  setModel?(model: string): void;
  /** 覆盖 base_url(ai_configs.baseUrl) */
  setBaseUrl?(url: string): void;
}
