// 환경 변수 로드를 가장 먼저 수행 (AppModule 로드 전)
import * as path from 'path';
import * as fs from 'fs';

// pkg로 빌드된 실행 파일의 경우 .env 파일 경로 찾기
if ((process as any).pkg) {
  // pkg 실행 파일의 디렉토리
  const execPath = path.dirname(process.execPath);
  const envPaths = [
    path.join(execPath, '.env'),
    path.join(execPath, 'server', '.env'),
    path.join(execPath, '..', '.env'),
    path.join(execPath, '..', 'server', '.env'),
  ];
  
  let envLoaded = false;
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const dotenv = require('dotenv');
      const result = dotenv.config({ path: envPath });
      if (!result.error) {
        console.log(`[INFO] .env 파일 로드: ${envPath}`);
        envLoaded = true;
        break;
      }
    }
  }
  
  if (!envLoaded) {
    console.log('[WARN] .env 파일을 찾을 수 없습니다. 기본값을 사용합니다.');
  }
} else {
  // 일반 Node.js 실행 시
  require('dotenv').config();
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 정적 파일 서빙 (웹 클라이언트)
  const webClientPath = join(__dirname, '../../../../web-client');
  app.useStaticAssets(webClientPath, {
    prefix: '/web',
  });

  // WebSocket 어댑터 설정
  app.useWebSocketAdapter(new WsAdapter(app));

  // 전역 Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS 설정
  app.enableCors({
    origin: '*',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 서버 시작: http://localhost:${port}`);
  console.log(`🎮 WebSocket: ws://localhost:${port}`);
  console.log(`🌐 웹 클라이언트: http://localhost:${port}/web/index.html`);
}

bootstrap();

