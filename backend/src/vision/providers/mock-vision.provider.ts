import { Injectable, Logger } from '@nestjs/common';
import { IFocusVisionProvider, VisionResult, FocusContext, AiProviderKey } from '../vision.types';

/**
 * 开发期 Mock 厂商:不真正调用视觉 API。
 * 按图片字节数生成"看似合理"的判定,方便联调全链路。
 * 生产环境替换为 VolcengineProvider / QwenProvider / GLMProvider。
 */
@Injectable()
export class MockVisionProvider implements IFocusVisionProvider {
  readonly name = 'mock-vision';
  readonly providerKey: AiProviderKey = 'mock';
  private readonly logger = new Logger('Vision[Mock]');

  async evaluate(image: Buffer, ctx: FocusContext): Promise<VisionResult> {
    // 伪随机但稳定:同一图片哈希出同一结果
    let hash = 0;
    for (let i = 0; i < image.length; i += 97) {
      hash = ((hash << 5) - hash + image[i]) | 0;
    }
    const rnd = Math.abs(hash) % 100;
    const result = rnd < 55 ? 'focus' : rnd < 85 ? 'distracted' : 'away';
    const confidence = 0.55 + ((Math.abs(hash) >> 3) % 40) / 100;

    this.logger.log(
      `判定 session=${ctx.sessionId} source=${ctx.source} → ${result} (conf=${confidence.toFixed(2)})`,
    );
    return { result, confidence, model: this.name };
  }
}
