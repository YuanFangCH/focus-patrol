import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 信任本机一跳代理(Next rewrites / proxy.js 8888)的 X-Forwarded-For,
  // 让 req.ip 解析为真实客户端 IP(IP 免登录依赖)。只信 loopback, 不信任公网伪造 XFF, 防撞库盗用。
  const expressApp = app.getHttpAdapter().getInstance() as {
    set?: (key: string, value: string) => void;
  };
  expressApp.set?.('trust proxy', 'loopback');

  app.setGlobalPrefix('api');
  // CORS: 默认全放开(本机开发);生产用 CORS_ORIGINS 白名单(逗号分隔,如 https://x.natfrp.net:12345)
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
