import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { SessionModule } from './modules/session/session.module';
import { HonorModule } from './modules/honor/honor.module';
import { PatrolModule } from './modules/patrol/patrol.module';
import { SocialModule } from './modules/social/social.module';
import { NotificationModule } from './modules/notification/notification.module';
import { TrackModule } from './modules/track/track.module';
import { AdminModule } from './modules/admin/admin.module';
import { AiConfigModule } from './modules/ai-config/ai-config.module';
import { CommonModule } from './common/common.module';
import { entities } from './entities';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService): import('@nestjs/typeorm').TypeOrmModuleOptions => {
        const dbType = cfg.get<string>('DB_TYPE') || 'sqlite';
        if (dbType === 'postgres') {
          const url = cfg.get<string>('DATABASE_URL');
          if (url) {
            return {
              type: 'postgres' as const,
              url,
              entities,
              synchronize: true,
              logging: false,
            };
          }
          return {
            type: 'postgres' as const,
            host: cfg.get('DB_HOST') || 'localhost',
            port: Number(cfg.get('DB_PORT')) || 5432,
            username: cfg.get('DB_USER') || 'aidushu',
            password: cfg.get('DB_PASSWORD') || 'aidushu_dev_pass',
            database: String(cfg.get('DB_NAME') || 'aidushu'),
            entities,
            synchronize: true,
            logging: false,
          };
        }
        // 默认 SQL.js(WASM,零编译零依赖)先跑通;后续切 PG 只改 DB_TYPE
        return {
          type: 'sqljs',
          location: cfg.get('DB_FILE') || './data/aidushu.sqlite',
          autoSave: true,
          entities,
          synchronize: true,
          logging: false,
        };
      },
    }),
    ScheduleModule.forRoot(),
    CommonModule,
    UserModule,
    AuthModule,
    SessionModule,
    HonorModule,
    PatrolModule,
    SocialModule,
    NotificationModule,
    TrackModule,
    AdminModule,
    AiConfigModule,
  ],
})
export class AppModule {}
