import { User } from './user.entity';
import { RefreshToken } from './refresh-token.entity';
import { FocusSession } from './focus-session.entity';
import { PatrolRecord } from './patrol-record.entity';
import { ViolationSnapshot } from './violation-snapshot.entity';
import { HonorLevel } from './honor-level.entity';
import { Achievement } from './achievement.entity';
import { UserAchievement } from './user-achievement.entity';
import { Friendship } from './friendship.entity';
import { Notification } from './notification.entity';
import { AiConfig } from './ai-config.entity';
import { SpotCheck } from './spot-check.entity';
import { IpBinding } from './ip-binding.entity';
import { AiUsage } from './ai-usage.entity';

export const entities = [
  User,
  RefreshToken,
  FocusSession,
  PatrolRecord,
  ViolationSnapshot,
  HonorLevel,
  Achievement,
  UserAchievement,
  Friendship,
  Notification,
  AiConfig,
  SpotCheck,
  IpBinding,
  AiUsage,
];
