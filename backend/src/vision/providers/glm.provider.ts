import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { IFocusVisionProvider, VisionResult, FocusContext, AiProviderKey } from '../vision.types';

interface GlmResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

/** 智谱 GLM-4V-Flash 适配器(OpenAI 兼容协议,免费额度) */
@Injectable()
export class GlmProvider implements IFocusVisionProvider {
  readonly name = 'glm-4v-flash';
  readonly providerKey: AiProviderKey = 'glm';
  private readonly logger = new Logger('Vision[GLM]');

  constructor(
    private readonly http: HttpService,
    cfg: ConfigService,
  ) {
    this.apiKey = cfg.get('GLM_API_KEY') || '';
    this.baseUrl = cfg.get('GLM_BASE_URL') || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
  }
  private apiKey: string;
  private baseUrl: string;

  /** 覆盖/注入 API key(AiConfig 加密表兜底) */
  setKey(key: string) {
    this.apiKey = key;
  }

  async evaluate(image: Buffer, ctx: FocusContext): Promise<VisionResult> {
    const prompt = `你是督学官。判断画面中的人是否专注。只输出 JSON:{"verdict":"focus|distracted|away","confidence":0-1,"reason":"一句话"}`;
    const b64 = image.toString('base64');

    const { data } = await lastValueFrom(
      this.http.post<GlmResponse>(
        this.baseUrl,
        {
          model: this.name,
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
        { headers: { Authorization: `Bearer ${this.apiKey}` }, timeout: 20000 },
      ),
    );

    if (data.error?.message) throw new Error(`glm error: ${data.error.message}`);
    const content = data.choices?.[0]?.message?.content ?? '';
    const match = content.match(/\{[^}]*\}/);
    if (!match) throw new Error('glm 返回格式异常');
    const parsed = JSON.parse(match[0]);
    const verdict = ['focus', 'distracted', 'away'].includes(parsed.verdict)
      ? parsed.verdict
      : 'unknown';
    return {
      result: verdict as VisionResult['result'],
      confidence: Number(parsed.confidence) || 0.5,
      model: this.name,
    };
  }
}
