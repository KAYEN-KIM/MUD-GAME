import { plainToInstance } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsBoolean,
  validateSync,
  Min,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(1)
  PORT: number = 3000;

  @IsString()
  TZ: string = 'Asia/Seoul';

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_URL!: string;

  @IsString()
  JWT_SECRET!: string;

  @IsString()
  ADMIN_KEY!: string;

  @IsNumber()
  @Min(0)
  RL_CHAT_PER_SEC: number = 1;

  @IsNumber()
  @Min(0)
  RL_MOVE_PER_SEC: number = 3;

  @IsNumber()
  @Min(0)
  CD_HUNT_MS: number = 2000;

  @IsNumber()
  @Min(0)
  RL_COMBAT_TURN_PER_SEC: number = 2;

  @IsNumber()
  @Min(1)
  TURN_SEC_FAST: number = 6;

  @IsNumber()
  @Min(1)
  TURN_SEC_TACTICAL: number = 9;

  @IsNumber()
  @Min(0)
  TIMEBANK_ADD_SEC: number = 6;

  @IsNumber()
  @Min(0)
  TIMEBANK_PER_ENCOUNTER: number = 1;

  // Season Policy (Production Default: S1 Only)
  @IsNumber()
  @Min(1)
  MAX_UNLOCKED_SEASON: number = 1;

  // Test Mode (allows bypass of season locks)
  @IsBoolean()
  TEST_MODE: boolean = false;
}

export function envValidation(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}

/**
 * 실제로 사용할 시즌 락 값 계산
 * TEST_MODE=true면 99 (모든 시즌 열림)
 * 아니면 MAX_UNLOCKED_SEASON 사용 (기본값 1)
 */
export function getEffectiveMaxUnlockedSeason(): number {
  const testMode = process.env.TEST_MODE === 'true';
  const configValue = parseInt(process.env.MAX_UNLOCKED_SEASON || '1', 10);
  return testMode ? 99 : configValue;
}


