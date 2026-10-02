import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { IFocusVisionProvider, VisionResult, FocusContext, AiProviderKey } from '../vision.types';

interface VolcResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

/** 火山方舟 Doubao-vision-pro 适配器(OpenAI 兼容协议) */
@Injectable()
export class VolcengineProvider implements IFocusVisionProvider {
  readonly name = 'doubao-vision-pro';
  readonly providerKey: AiProviderKey = 'volcengine';
  private readonly logger = new Logger('Vision[Volc]');

  constructor(
    private readonly http: HttpService,
    cfg: ConfigService,
  ) {
    this.apiKey = cfg.get('VOLC_API_KEY') || '';
    this.baseUrl = cfg.get('VOLC_BASE_URL') || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
    this.model = cfg.get('VOLC_MODEL') || 'doubao-vision-pro-32k';
  }
  private apiKey: string;
  private baseUrl: string;

  /** 覆盖/注入 API key(AiConfig 加密表兜底) */
  setKey(key: string) {
    this.apiKey = key;
  }
  private model: string;

  async evaluate(image: Buffer, ctx: FocusContext): Promise<VisionResult> {
    const prompt = `你是督学官。判断画面中的人是否专注。只输出 JSON:{"verdict":"focus|distracted|away","confidence":0-1,"reason":"一句话"}`;
    const b64 = image.toString('base64');

    const { data } = await lastValueFrom(
      this.http.post<VolcResponse>(
        this.baseUrl,
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
        { headers: { Authorization: `Bearer ${this.apiKey}` }, timeout: 20000 },
      ),
    );

    if (data.error?.message) throw new Error(`volc error: ${data.error.message}`);
    const content = data.choices?.[0]?.message?.content ?? '';
    const match = content.match(/\{[^}]*\}/);
    if (!match) throw new Error('volc 返回格式异常');
    const parsed = JSON.parse(match[0]);
    const verdict = ['focus', 'distracted', 'away'].includes(parsed.verdict)
      ? parsed.verdict
      : 'unknown';
    return {
      result: verdict as VisionResult['result'],
      confidence: Number(parsed.confidence) || 0.5,
      model: this.model,
    };
  }
}
