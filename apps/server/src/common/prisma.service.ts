import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // 데이터베이스 URL을 절대 경로로 변환 (PrismaClient 초기화 전에)
    const dbUrl = process.env.DATABASE_URL || 'file:../data/game.db';
    if (dbUrl.startsWith('file:')) {
      const dbPath = dbUrl.replace('file:', '');
      
      // pkg 환경에서는 process.execPath 기준으로 경로 계산
      let basePath: string;
      if ((process as any).pkg) {
        const execPath = path.dirname(process.execPath);
        // server.exe가 server 폴더에 있으면 한 단계 위로
        basePath = execPath.endsWith('server') ? path.dirname(execPath) : execPath;
      } else {
        basePath = process.cwd();
      }
      
      const absoluteDbPath = path.isAbsolute(dbPath) 
        ? dbPath 
        : path.resolve(basePath, dbPath);
      const dbDir = path.dirname(absoluteDbPath);
      
      // 데이터베이스 디렉토리 생성
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`[INFO] 데이터베이스 디렉토리 생성: ${dbDir}`);
      }
      
      // 데이터베이스 파일이 없으면 빈 파일 생성
      if (!fs.existsSync(absoluteDbPath)) {
        console.log(`[INFO] 데이터베이스 파일이 없습니다. 생성 중: ${absoluteDbPath}`);
        fs.writeFileSync(absoluteDbPath, '');
        console.log(`[INFO] 빈 데이터베이스 파일 생성 완료`);
      }
      
      // DATABASE_URL을 절대 경로로 업데이트 (PrismaClient 초기화 전에)
      process.env.DATABASE_URL = `file:${absoluteDbPath}`;
      console.log(`[INFO] 데이터베이스 경로 설정: ${absoluteDbPath}`);
    }
    
    // pkg로 빌드된 실행 파일의 경우 Prisma 엔진 경로 설정
    if ((process as any).pkg) {
      // pkg 환경에서는 process.execPath가 실행 파일의 실제 파일 시스템 경로를 반환
      // server.exe가 server 폴더에 있으므로, 같은 디렉토리에서 엔진 파일 찾기
      const execDir = path.dirname(process.execPath);
      
      // pkg는 파일 시스템을 가상화하지만, process.execPath는 실제 파일 시스템 경로를 반환
      // 따라서 execDir에서 직접 엔진 파일을 찾을 수 있음
      const enginePath = path.join(execDir, 'query_engine-windows.dll.node');
      
      if (fs.existsSync(enginePath)) {
        // 절대 경로로 변환하여 설정
        const absolutePath = path.resolve(enginePath);
        process.env.PRISMA_QUERY_ENGINE_LIBRARY = absolutePath;
        console.log(`[INFO] Prisma 엔진 경로 설정: ${absolutePath}`);
      } else {
        // 대체 경로 시도
        const altPaths = [
          path.join(path.dirname(execDir), 'query_engine-windows.dll.node'),
          path.join(execDir, 'server', 'query_engine-windows.dll.node'),
        ];
        
        let found = false;
        for (const altPath of altPaths) {
          const absoluteAltPath = path.resolve(altPath);
          if (fs.existsSync(absoluteAltPath)) {
            process.env.PRISMA_QUERY_ENGINE_LIBRARY = absoluteAltPath;
            console.log(`[INFO] Prisma 엔진 경로 설정 (대체): ${absoluteAltPath}`);
            found = true;
            break;
          }
        }
        
        if (!found) {
          console.error('[ERROR] Prisma 엔진 파일을 찾을 수 없습니다.');
          console.error(`[ERROR] 예상 경로: ${enginePath}`);
          console.error(`[ERROR] 실행 파일 경로: ${process.execPath}`);
          console.error('[ERROR] 엔진 파일이 server.exe와 같은 디렉토리에 있는지 확인하세요.');
          // 엔진 파일이 없어도 계속 진행 (런타임 에러 발생 가능)
        }
      }
    }
    
    super();
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ 데이터베이스 연결됨');
      
      // 데이터베이스가 비어있으면 마이그레이션 실행
      try {
        await this.$queryRaw`SELECT 1`;
      } catch (error: any) {
        if (error.message?.includes('no such table') || error.message?.includes('syntax error')) {
          console.log('[INFO] 데이터베이스가 비어있습니다. 마이그레이션을 실행해야 합니다.');
          console.log('[WARN] pkg 빌드에서는 마이그레이션을 자동으로 실행할 수 없습니다.');
          console.log('[WARN] 데이터베이스를 초기화하려면 init-db.js를 실행하세요.');
        }
      }
    } catch (error: any) {
      if (error.message?.includes('Unable to open the database file')) {
        console.error('[ERROR] 데이터베이스 파일을 열 수 없습니다.');
        console.error(`[ERROR] 경로: ${process.env.DATABASE_URL}`);
        console.error('[ERROR] 데이터베이스 디렉토리가 존재하는지 확인하세요.');
        throw error;
      }
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

