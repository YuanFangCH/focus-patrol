import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StreamableFile } from '@nestjs/common';

export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

/** 统一响应包装 { code:0, data, message } */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // StreamableFile(如图片/文件流)不包装, 保持二进制流输出, 否则会被 JSON 化破坏
        if (data instanceof StreamableFile) return data as unknown as ApiResponse<T>;
        return { code: 0, data, message: 'ok' };
      }),
    );
  }
}
