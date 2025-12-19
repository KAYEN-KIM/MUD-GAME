# MUD Client - Flutter MVP

NestJS MUD 게임 서버에 연결되는 Flutter 클라이언트 앱입니다.

## 기능

- ✅ 서버 엔드포인트 설정 (REST/WS URL)
- ✅ 회원가입 / 로그인 (JWT 인증)
- ✅ WebSocket 자동 연결 및 AUTH
- ✅ 실시간 로그 피드 (LOG_APPEND, COMBAT 등)
- ✅ 게임 액션 버튼 (파티, 이동, 사냥, 전투, 채팅)
- ✅ 상태바 (캐릭터, 룸, 파티, 전투 상태)

## 실행 방법

### 1. 의존성 설치

```bash
cd mud_client
flutter pub get
```

### 2. 서버 URL 설정

앱을 실행하면 자동으로 플랫폼에 맞는 기본 URL이 설정됩니다.
설정을 변경하려면 앱 내 설정 화면(⚙️)에서 수정할 수 있습니다.

#### Android 에뮬레이터

- REST API: `http://10.0.2.2:3000`
- WebSocket: `ws://10.0.2.2:3000`

> **Android 에뮬레이터는 10.0.2.2 사용**: Android 에뮬레이터에서는 `localhost`가 에뮬레이터 자체를 가리키므로, 호스트 머신의 localhost에 접근하려면 `10.0.2.2`를 사용해야 합니다.

#### Android 실기기

네트워크의 서버 IP를 사용:

- REST API: `http://192.168.x.x:3000`
- WebSocket: `ws://192.168.x.x:3000`

서버 IP 확인:
```bash
# Windows
ipconfig

# macOS/Linux
ifconfig
```

#### Desktop (Windows/macOS/Linux)

- REST API: `http://localhost:3000`
- WebSocket: `ws://localhost:3000`

### 3. 앱 실행

#### Android 에뮬레이터/실기기

```bash
flutter run
```

#### Desktop (Windows)

```bash
flutter run -d windows
```

#### Desktop (macOS)

```bash
flutter run -d macos
```

#### Desktop (Linux)

```bash
flutter run -d linux
```

## 테스트 시나리오

### 1. 회원가입 & 로그인

1. 앱 실행
2. "회원가입하기" 탭 선택
3. 이메일, 비밀번호, 캐릭터 이름 입력
4. "회원가입" 버튼 클릭

### 2. WebSocket 연결

1. 홈 화면에서 상단 우측 링크 아이콘(🔗) 클릭
2. "WebSocket 연결됨" 로그 확인
3. "✅ 인증 성공" 로그 확인

### 3. 파티 생성

1. 하단 "파티 생성" 버튼 클릭
2. 파티 생성 로그 확인

### 4. 이동

1. "이동" 버튼 클릭
2. 룸 ID 입력 (예: `R1_00`)
3. 확인
4. 이동 로그 확인

### 5. 사냥 & 전투

1. "사냥" 버튼 클릭
2. "⚔️ 전투 시작!" 로그 확인
3. 자동으로 턴이 진행됨 (FAST 모드 6초)
4. "📊 턴 X 해결됨" 로그 확인
5. "🏁 전투 종료: WIN" 로그 확인
6. "💰 보상: EXP +XX, GOLD +XX" 로그 확인

### 6. 전투 행동 (선택사항)

전투 중일 때:

1. "전투" 버튼 클릭
2. 행동 선택 (공격/방어/후퇴)
3. 해당 행동이 다음 턴에 반영됨

### 7. 채팅

1. "채팅" 버튼 클릭
2. 메시지 입력
3. "전송" 버튼 클릭
4. 채팅 로그 확인

## 주요 파일 구조

```
lib/
├── main.dart              # 앱 진입점
├── app.dart               # MaterialApp 설정
├── core/
│   ├── models.dart        # 데이터 모델
│   ├── storage.dart       # Secure Storage (JWT, URLs)
│   ├── endpoints.dart     # 기본 URL 설정
│   ├── api_client.dart    # REST API 클라이언트
│   └── ws_client.dart     # WebSocket 클라이언트
├── state/
│   └── session_state.dart # 전역 상태 관리
└── features/
    ├── settings/
    │   └── settings_screen.dart    # 설정 화면
    ├── auth/
    │   └── auth_screen.dart        # 로그인/회원가입
    └── home/
        ├── home_screen.dart        # 메인 화면
        └── widgets/
            ├── log_view.dart       # 로그 뷰
            └── action_bar.dart     # 액션 버튼 바
```

## WebSocket 프로토콜

### 클라이언트 → 서버

```json
{
  "t": "MESSAGE_TYPE",
  "reqId": "req_1234567890",
  "ts": 1234567890000,
  "p": { /* payload */ }
}
```

### 서버 → 클라이언트

동일한 포맷으로 수신:

- `AUTH_OK` / `AUTH_FAIL`: 인증 결과
- `LOG_APPEND`: 게임 로그
- `STATE_SYNC`: 게임 상태 동기화
- `ENCOUNTER_START`: 전투 시작
- `COMBAT_RESOLVE`: 턴 해결
- `COMBAT_END`: 전투 종료 (rewardsJson 포함)
- `ERROR`: 오류 메시지

## 문제 해결

### Android 에뮬레이터에서 연결 실패

- URL이 `10.0.2.2`로 설정되었는지 확인
- 서버가 `localhost:3000`에서 실행 중인지 확인
- 방화벽 설정 확인

### 실기기에서 연결 실패

- 같은 네트워크(Wi-Fi)에 연결되어 있는지 확인
- 서버 IP 주소 확인 (`ipconfig` / `ifconfig`)
- 서버가 외부 접속을 허용하는지 확인 (`0.0.0.0` 바인딩)

### WebSocket 연결이 자주 끊김

- 네트워크 상태 확인
- 재연결 버튼(🔗) 클릭하여 수동 재연결

## 라이선스

MIT

