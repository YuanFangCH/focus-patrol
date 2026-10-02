import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 信任本机一跳代理的 X-Forwarded-For,
  // 让 req.ip 解析为真实客户端 IP(IP 免登录依赖)。只信 loopback, 不信任不可信来源伪造的 XFF, 防撞库盗用。
  const expressApp = app.getHttpAdapter().getInstance() as {
    set?: (key: string, value: string) => void;
  };
  expressApp.set?.('trust proxy', 'loopback');

  app.setGlobalPrefix('api');
  // CORS: 默认全放开(本机开发);共享环境可用 CORS_ORIGINS 白名单(逗号分隔)
  const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors(
    corsOrigins.length > 0
      ? { origin: corsOrigins, credentials: true }
      : { origin: true, credentials: true },
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port);
  console.log(`[aidushu-api] listening on http://localhost:${port}/api`);
}
bootstrap();
