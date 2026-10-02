import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { IFocusVisionProvider, VisionResult, FocusContext } from '../vision.types';
import { AiProviderKey } from '../vision.types';

interface QwenResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string };
}

/** 阿里云百炼 OpenAI 兼容接口，可通过 env / ai_configs 覆盖 */
const DEFAULT_BASE_URL =
  'https://dashscope.aliyuncs.com/compatible-mode/v1';

/**
 * 通义千问适配器(OpenAI 兼容协议)。
 * 默认模型 qwen-vl-plus(公开视觉模型), 可由 env/ai_configs 覆盖。
 * 统一提示词要求模型返回 JSON { verdict, confidence, reason }。
 */
@Injectable()
export class QwenProvider implements IFocusVisionProvider {
  readonly name = 'qwen';
  readonly providerKey: AiProviderKey = 'qwen';
  private readonly logger = new Logger('Vision[Qwen]');

  constructor(
    private readonly http: HttpService,
    cfg: ConfigService,
  ) {
    this.apiKey = cfg.get('QWEN_API_KEY') || '';
    this.baseUrl = cfg.get('QWEN_BASE_URL') || DEFAULT_BASE_URL;
    this.model = cfg.get('QWEN_MODEL') || 'qwen-vl-plus';
  }
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  /** 覆盖/注入 API key(AiConfig 加密表兜底) */
  setKey(key: string) {
    this.apiKey = key;
  }
  /** 覆盖模型名(ai_configs.modelName) */
  setModel(model: string) {
    if (model) this.model = model;
  }
  /** 覆盖 base_url(ai_configs.baseUrl) */
  setBaseUrl(url: string) {
    if (url) this.baseUrl = url;
  }

  /** 完整 OpenAI 兼容端点: baseUrl 若不含 /chat/completions 则补齐 */
  private endpoint(): string {
    const base = this.baseUrl.replace(/\/+$/, '');
    return /\/chat\/completions$/.test(base) ? base : `${base}/chat/completions`;
  }

  async evaluate(image: Buffer, ctx: FocusContext): Promise<VisionResult> {
    const prompt = `你是督学官。判断画面中的人是否处于专注状态。只输出 JSON:{"verdict":"focus|distracted|away","confidence":0-1,"reason":"一句话"}`;
    const b64 = image.toString('base64');

    const { data } = await lastValueFrom(
      this.http.post<QwenResponse>(
        this.endpoint(),
        {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } },
              ],
            },
          ],
        },
        { headers: { Authorization: `Bearer ${this.apiKey}` }, timeout: 30000 },
      ),
    );

    if (data.error?.message) {
      throw new Error(`qwen error: ${data.error.message}`);
    }
    const content = data.choices?.[0]?.message?.content ?? '';
    const match = content.match(/\{[^}]*\}/);
    if (!match) throw new Error('qwen 返回格式异常');
    const parsed = JSON.parse(match[0]);
    const verdict = ['focus', 'distracted', 'away'].includes(parsed.verdict)
      ? parsed.verdict
      : 'unknown';
    return {
      result: verdict as VisionResult['result'],
      confidence: Number(parsed.confidence) || 0.5,
      model: this.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
    };
  }
}
