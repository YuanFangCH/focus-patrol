import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Response } from 'express';

/** 全局异常 → 统一 { code, data, message } */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const path = ctx.getRequest<Request>()?.url ?? '';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 1;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
      } else if (resp && typeof resp === 'object') {
        const r = resp as Record<string, unknown>;
        message = (r.message as string) || (r.error as string) || exception.message;
        if (Array.isArray(r.message)) message = r.message.join('; ');
      }
      code = status >= 500 ? 1 : status;
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(`[${path}] ${exception.stack}`);
    }

    res.status(status).json({ code, data: null, message });
  }
}
