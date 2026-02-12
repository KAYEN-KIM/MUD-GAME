# 🧪 MUD 게임 테스트 체크리스트

클라이언트 실행 후 로그인하여 테스트할 수 있는 모든 기능 목록입니다.

---

## 📋 기본 테스트 순서

1. **회원가입/로그인**
2. **기본 게임플레이**
3. **소셜 시스템**
4. **컬렉션 시스템**
5. **경제 시스템 확장**
6. **기존 시스템 확인**

---

## 1️⃣ 회원가입/로그인

### 테스트 항목
- [ ] 회원가입: 새 계정 생성
- [ ] 로그인: 기존 계정으로 로그인
- [ ] 캐릭터 생성: 캐릭터 이름 설정
- [ ] 기본 장비 자동 지급 확인 (인벤토리 확인)

### 명령어
```
회원가입: 앱 UI에서 회원가입
로그인: 앱 UI에서 로그인
```

---

## 2️⃣ 기본 게임플레이

### 이동 및 탐험
- [ ] `look` 또는 `l` - 현재 방 묘사 확인
- [ ] `exits` - 출구 목록 확인
- [ ] `n`/`s`/`e`/`w` - 방향 이동
- [ ] `who` - 같은 방에 있는 플레이어 확인
- [ ] `monsters` - 현재 방의 몬스터 확인
- [ ] `search` 또는 `scavenge` - 탐색 (골드/아이템 발견 가능)

### 전투
- [ ] `hunt` - 사냥 시작 (몬스터 스폰)
- [ ] `attack <monster>` 또는 `kill <monster>` - 몬스터 공격
- [ ] `cast <spell> [target]` - 주문 시전
- [ ] `flee` - 도망 (전투 중)

### 인벤토리 및 장비
- [ ] `inv` 또는 `i` - 인벤토리 확인
- [ ] `eq` 또는 `equipment` - 장착 장비 확인
- [ ] `equip <item>` - 아이템 장착
- [ ] `unequip <slot>` - 장비 해제
- [ ] `enhance <slot>` - 장비 강화 (0~15강)
- [ ] `use <item> [qty]` - 소비 아이템 사용

### 아이템 관리
- [ ] `items` 또는 `loot` - 바닥 아이템 확인
- [ ] `get <item>` 또는 `get all` - 아이템 획득
- [ ] `drop <item>` 또는 `drop all` - 아이템 버리기

### 스탯 및 정보
- [ ] `stats` - 캐릭터 스탯 확인 (레벨, 경험치, 골드, HP/MP 등)

---

## 3️⃣ 소셜 시스템 (신규)

### 친구 시스템
- [ ] `friends` - 친구 목록 조회
- [ ] `friend add <플레이어이름>` - 친구 추가 요청
- [ ] `friend accept <requestId>` - 친구 요청 수락
- [ ] `friend remove <friendId>` - 친구 삭제

**테스트 시나리오:**
1. 두 개의 계정으로 로그인
2. 계정 A에서 계정 B에게 친구 요청
3. 계정 B에서 요청 수락
4. 양쪽 모두에서 친구 목록 확인

### 블랙리스트 시스템
- [ ] `blacklist` - 차단 목록 조회
- [ ] `blacklist add <플레이어이름> [사유]` - 차단 추가
- [ ] `blacklist remove <blockedId>` - 차단 해제

**테스트 시나리오:**
1. 특정 플레이어 차단
2. 차단 목록 확인
3. 차단 해제 후 확인

### 메일 시스템
- [ ] `mail` - 메일 목록 조회
- [ ] `mail send <받는사람> <제목> <내용>` - 메일 전송
- [ ] `mail read <mailId>` - 메일 읽기
- [ ] `mail claim <mailId>` - 메일 보상 수령 (골드/아이템 포함 시)
- [ ] `mail delete <mailId>` - 메일 삭제

**테스트 시나리오:**
1. 계정 A에서 계정 B에게 메일 전송
2. 계정 B에서 메일 확인 및 읽기
3. 골드/아이템 포함 메일 전송 후 보상 수령 테스트

---

## 4️⃣ 컬렉션 시스템 (신규)

### 도감 시스템
- [ ] `bestiary` - 도감 조회
- [ ] 몬스터 처치 후 도감 자동 업데이트 확인

**테스트 시나리오:**
1. 여러 종류의 몬스터 처치
2. `bestiary` 명령으로 처치 기록 확인
3. 첫 처치/마지막 처치 시간 확인
4. 처치 횟수 확인

### 칭호 시스템
- [ ] `titles` - 칭호 목록 조회
- [ ] `title equip <titleId>` - 칭호 장착

**테스트 시나리오:**
1. 칭호 목록 확인 (초기에는 비어있을 수 있음)
2. 업적 완료 등으로 칭호 획득 후 장착

### 수집품 시스템
- [ ] `collectibles` - 수집품 목록 조회

**테스트 시나리오:**
1. 수집품 목록 확인
2. 게임 진행 중 수집품 획득 확인

---

## 5️⃣ 경제 시스템 확장 (신규)

### 은행 시스템
- [ ] `bank` 또는 `bank info` - 은행 정보 조회
- [ ] `bank deposit <금액>` - 골드 입금
- [ ] `bank withdraw <금액>` - 골드 출금
- [ ] `bank history` - 거래 내역 조회

**테스트 시나리오:**
1. 은행 계좌 생성 확인 (자동 생성)
2. 골드 입금 후 잔액 확인
3. 이자 계산 확인 (1일 후)
4. 출금 후 인벤토리 골드 확인
5. 거래 내역 확인 (DEPOSIT, WITHDRAW, INTEREST)

### 거래소 시스템
- [ ] `exchange` 또는 `exchange list` - 거래소 목록 조회
- [ ] `exchange sell <itemId> <수량> <가격>` - 아이템 판매 등록
- [ ] `exchange buy <listingId> [수량]` - 아이템 구매
- [ ] `exchange cancel <listingId>` - 판매 취소

**테스트 시나리오:**
1. 계정 A에서 아이템 판매 등록
2. 계정 B에서 거래소 목록 확인
3. 계정 B에서 구매
4. 계정 A에서 골드 수령 확인
5. 판매 취소 테스트

---

## 6️⃣ 기존 시스템 확인

### 파티 시스템
- [ ] `party create` - 파티 생성
- [ ] `party join <코드>` - 파티 참가
- [ ] `party leave` - 파티 나가기
- [ ] `party info` - 파티 정보 확인

### 길드 시스템
- [ ] `guilds` - 길드 목록
- [ ] `guild create <이름> [설명]` - 길드 생성
- [ ] `guild join <guildId>` - 길드 가입
- [ ] `guild leave` - 길드 탈퇴
- [ ] `g <메시지>` - 길드 채팅
- [ ] `vault` - 길드 금고 확인
- [ ] `vault deposit gold <금액>` - 골드 기부
- [ ] `vault withdraw gold <금액>` - 골드 인출

### 퀘스트 시스템
- [ ] `quests` 또는 `quest` - 퀘스트 목록
- [ ] `quest accept <questId>` - 퀘스트 수락
- [ ] `quest turnin <questId>` - 퀘스트 제출

### 상점 시스템
- [ ] `shop` - 상점 목록 (상점 방에서)
- [ ] `shop buy <itemId>` - 아이템 구매
- [ ] `shop sell <itemId>` - 아이템 판매

### 스킬/주문 시스템
- [ ] `skills` - 스킬 목록
- [ ] `skill learn <skillId>` - 스킬 학습
- [ ] `skill use <skillId> [target]` - 스킬 사용
- [ ] `spells` - 주문 목록 (서버에서 제공)
- [ ] `cast <spell> [target]` - 주문 시전

### 던전/레이드 시스템
- [ ] `dungeons` - 던전 목록
- [ ] `dungeon enter <dungeonId> [difficulty]` - 던전 입장
- [ ] `dungeon status` - 던전 진행 상태
- [ ] `raids` - 레이드 목록
- [ ] `raid enter <raidId>` - 레이드 입장
- [ ] `raid status` - 레이드 진행 상태

### 펫 시스템
- [ ] `pets` - 펫 목록
- [ ] `pet summon <petId>` - 펫 소환
- [ ] `pet dismiss` - 펫 해제

### 주택/농장 시스템
- [ ] `house` - 주택 정보
- [ ] `house create <이름>` - 주택 구매 (1000G)
- [ ] `house storage deposit <item> [qty]` - 저장소 보관
- [ ] `house storage withdraw <item> [qty]` - 저장소 인출
- [ ] `farm plant <plotIndex> <cropId>` - 작물 심기
- [ ] `farm harvest <plotIndex>` - 작물 수확

### 이벤트 시스템
- [ ] `events` - 이벤트 목록
- [ ] `event join <eventId>` - 이벤트 참가
- [ ] `event progress <eventId> <progress>` - 이벤트 진행도 업데이트

### 랭킹 시스템
- [ ] `ranking dungeon [dungeonId] [difficulty]` - 던전 랭킹
- [ ] `ranking raid [raidId]` - 레이드 랭킹
- [ ] `pvp ranking` - PVP 랭킹

### 제작 시스템
- [ ] `recipes` - 제작 레시피 목록
- [ ] `craft <recipeId>` - 아이템 제작

### 업적 시스템
- [ ] `ach` 또는 `achievements` - 업적 목록
- [ ] `ach claim <achievementId>` - 업적 보상 수령

### 거래 시스템
- [ ] `trade <플레이어이름> [gold]` - 거래 제안
- [ ] `trade accept <offerId>` - 거래 수락
- [ ] `trade reject <offerId>` - 거래 거절

### 마켓플레이스 시스템
- [ ] `market` 또는 `market list [itemId]` - 경매장 목록
- [ ] `market sell <item> <qty> <startPrice> [buyNowPrice]` - 경매 등록
- [ ] `market bid <listingId> <amount>` - 입찰
- [ ] `market buy <listingId>` - 즉시 구매
- [ ] `market cancel <listingId>` - 경매 취소

### PVP 시스템
- [ ] `pvp challenge <플레이어이름> [betGold]` - PVP 도전
- [ ] `pvp accept <matchId>` - PVP 수락
- [ ] `pvp ranking` - PVP 랭킹

### 수집 시스템
- [ ] `nodes` - 리소스 노드 목록
- [ ] `gather <nodeId>` - 리소스 수집

### 기타 명령어
- [ ] `rest` - 휴식 (HP/MP 회복)
- [ ] `roll [sides]` - 주사위 굴리기
- [ ] `coin` - 동전 던지기
- [ ] `help` 또는 `?` - 도움말

---

## 7️⃣ 관리자 도구 (신규)

### WebSocket 명령어
- [ ] `admin stats` - 관리자 통계 조회

### REST API 테스트 (Postman/curl)
- [ ] `GET /admin/stats` - 게임 통계 (x-admin-key 헤더 필요)
- [ ] `GET /admin/logs?limit=100` - 관리자 로그
- [ ] `GET /admin/game-stats/:key?limit=100` - 게임 통계 조회
- [ ] `POST /admin/game-stats` - 게임 통계 기록

**테스트 방법:**
```bash
# PowerShell에서
$headers = @{ "x-admin-key" = "your-admin-key" }
Invoke-RestMethod -Uri "http://localhost:3000/admin/stats" -Headers $headers
```

---

## 8️⃣ 통합 테스트 시나리오

### 시나리오 1: 소셜 + 경제 시스템 통합
1. 계정 A 생성 및 로그인
2. 계정 B 생성 및 로그인
3. 계정 A에서 계정 B에게 친구 추가
4. 계정 A에서 은행에 골드 입금
5. 계정 A에서 거래소에 아이템 판매 등록
6. 계정 B에서 거래소에서 구매
7. 계정 A에서 메일로 골드 전송
8. 계정 B에서 메일 확인 및 보상 수령

### 시나리오 2: 컬렉션 + 전투 시스템 통합
1. 여러 종류의 몬스터 처치
2. 도감에서 처치 기록 확인
3. 칭호 획득 (업적 완료 시)
4. 칭호 장착
5. 수집품 획득 확인

### 시나리오 3: 던전 + 랭킹 시스템 통합
1. 파티 생성
2. 던전 입장
3. 던전 클리어
4. 랭킹 확인
5. 완료 보상 확인

---

## 9️⃣ 버그 체크리스트

### 일반적인 버그 확인
- [ ] 명령어 오타 시 적절한 에러 메시지 표시
- [ ] 존재하지 않는 아이템/플레이어 조회 시 에러 처리
- [ ] 권한 없는 작업 시 에러 처리
- [ ] 동시 접속 시 데이터 일관성 확인
- [ ] 서버 재시작 후 데이터 유지 확인

### 성능 확인
- [ ] 명령어 응답 속도 (1초 이내)
- [ ] 다중 명령어 연속 실행 시 안정성
- [ ] 대량 데이터 조회 시 성능 (랭킹, 목록 등)

---

## 🔟 우선순위 테스트 항목

### 필수 테스트 (높은 우선순위)
1. ✅ 회원가입/로그인
2. ✅ 기본 이동 및 전투
3. ✅ 소셜 시스템 (친구, 메일)
4. ✅ 경제 시스템 확장 (은행, 거래소)
5. ✅ 컬렉션 시스템 (도감)

### 권장 테스트 (중간 우선순위)
6. ✅ 기존 시스템 동작 확인
7. ✅ 관리자 도구
8. ✅ 통합 시나리오 테스트

### 선택 테스트 (낮은 우선순위)
9. ✅ 모든 명령어 개별 테스트
10. ✅ 엣지 케이스 테스트

---

## 📝 테스트 결과 기록

테스트 중 발견한 버그나 개선사항을 기록하세요:

### 버그 리포트
- [ ] 버그 1: [설명]
- [ ] 버그 2: [설명]

### 개선 제안
- [ ] 개선 1: [설명]
- [ ] 개선 2: [설명]

---

## 🎯 빠른 테스트 가이드 (5분)

가장 중요한 기능만 빠르게 테스트:

1. **로그인** → `look` → `exits` → `n` (이동)
2. **소셜**: `friends` → `friend add <이름>`
3. **경제**: `bank` → `bank deposit 100`
4. **컬렉션**: `bestiary`
5. **거래소**: `exchange`

이 5가지만 테스트해도 주요 신규 기능이 정상 작동하는지 확인할 수 있습니다!

