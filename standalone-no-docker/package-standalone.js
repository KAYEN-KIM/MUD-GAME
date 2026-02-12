// 독립 실행형 패키지 생성 스크립트 (Docker 불필요)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('========================================');
console.log('  독립 실행형 패키지 생성 (Docker 불필요)');
console.log('========================================\n');

const packageDir = path.join(__dirname, '../dist/mud-game-standalone-no-docker');

// 기존 패키지 삭제
if (fs.existsSync(packageDir)) {
  console.log('[1/7] 기존 패키지 삭제 중...');
  fs.rmSync(packageDir, { recursive: true, force: true });
}

// 패키지 디렉토리 생성
console.log('[2/7] 패키지 디렉토리 생성 중...');
fs.mkdirSync(packageDir, { recursive: true });
fs.mkdirSync(path.join(packageDir, 'server'), { recursive: true });
fs.mkdirSync(path.join(packageDir, 'client'), { recursive: true });
fs.mkdirSync(path.join(packageDir, 'data'), { recursive: true });

// SQLite 스키마 변환
console.log('[3/7] SQLite 스키마 변환 중...');
execSync('node convert-to-sqlite.js', { cwd: __dirname, stdio: 'inherit' });

// 서버 빌드 (pkg로 실행 파일 생성)
console.log('[4/7] 서버 빌드 중...');
// TODO: pkg로 서버 패키징

// 클라이언트 복사
console.log('[5/7] 클라이언트 파일 복사 중...');
const clientSource = path.join(__dirname, '../dist/mud_client');
if (fs.existsSync(clientSource)) {
  copyRecursiveSync(clientSource, path.join(packageDir, 'client'));
}

// 시작 스크립트 생성
console.log('[6/7] 시작 스크립트 생성 중...');
const startScript = `@echo off
chcp 65001 >nul
echo ========================================
echo   MUD 게임 시작
echo ========================================
echo.

cd /d "%~dp0"

REM 서버 시작
echo [1/2] 서버 시작 중...
start /B node server\\server.exe

REM 서버 준비 대기
timeout /t 5 /nobreak >nul

REM 클라이언트 실행
echo [2/2] 클라이언트 실행 중...
start client\\mud_client.exe

echo.
echo 게임이 시작되었습니다!
echo 서버를 중지하려면 작업 관리자에서 node 프로세스를 종료하세요.
pause
`;

fs.writeFileSync(path.join(packageDir, 'start-game.bat'), startScript);

// README 생성
console.log('[7/7] README 생성 중...');
const readme = `# MUD 게임 독립 실행형 패키지 (Docker 불필요)

## 🚀 빠른 시작

1. \`start-game.bat\` 더블클릭
2. 게임 시작!

## 📋 필요 사항

- **Node.js** (서버 실행용)
  - 다운로드: https://nodejs.org/
  - 버전: 20.x 이상

## 📁 구조

- \`server/\` - 게임 서버
- \`client/\` - 게임 클라이언트
- \`data/\` - 게임 데이터 (SQLite 데이터베이스)

## 🔧 문제 해결

### 서버가 시작되지 않음
- Node.js가 설치되어 있는지 확인
- 포트 3000이 사용 중인지 확인

### 데이터베이스 오류
- \`data/\` 폴더를 삭제하고 다시 시작

## 📝 참고

- 모든 데이터는 \`data/\` 폴더에 저장됩니다
- 서버는 백그라운드에서 실행됩니다
- 서버를 중지하려면 작업 관리자에서 node 프로세스를 종료하세요
`;

fs.writeFileSync(path.join(packageDir, 'README.md'), readme);

console.log('\n✅ 패키지 생성 완료!');
console.log(`위치: ${packageDir}`);

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}
