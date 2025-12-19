# 퀘스트 데이터 팩 통합 계획

## 작업 일시
2025-12-17

## 목표
프롤로그 + 시즌 1-10 메인 퀘스트 (총 85개)를 서버/클라에 반영하여 플레이 가능 상태로 만든다.

---

## 📊 전체 범위

### 퀘스트 (85개)
- 프롤로그: 5개 (Q_PRO_001~005)
- 시즌 1: 8개 (Q_S01_001~008)
- 시즌 2: 8개 (Q_S02_001~008)
- 시즌 3: 8개 (Q_S03_001~008)
- 시즌 4: 8개 (Q_S04_001~008)
- 시즌 5: 8개 (Q_S05_001~008)
- 시즌 6: 8개 (Q_S06_001~008)
- 시즌 7: 8개 (Q_S07_001~008)
- 시즌 8: 8개 (Q_S08_001~008)
- 시즌 9: 8개 (Q_S09_001~008)
- 시즌 10: 8개 (Q_S10_001~008)

### 신규 콘텐츠 ID
**Rooms**: GH_LEDGER_OFFICE, GH_LEDGER_VAULT, GH_GATE_STABILIZER, SR1_00~03, MEM1_00~03, LGR_00, LGR_BOSS_SCRIBE, BH_GATE, BH_MARKET, BH_LEDGER_HALL, BH_BOSS_PACT, ARC_00~02, ARC_BOSS_HAND, ARC_FIRST_ENTRY, CV_00, CV_03, CV_BOSS_CONFLUENCE, ARC_CORE_00~02, ARC_BOSS_CURATOR

**Bosses**: BOSS_RESIDUE_BROKER, BOSS_SHARD_WARDEN, BOSS_DIRECTOR_PROXY, BOSS_SCRIBE_NO_EYES, BOSS_PACT_MAKER, BOSS_CURATOR_HAND, BOSS_CONFLUENCE_BEAST, BOSS_CURATOR

**Items**: ITEM_CLEANSE_KIT_T1, ITEM_MAP_SCRAP_S1/S2, ITEM_RESEARCH_PASS, ITEM_SIGIL_FRAGMENT_S3, ITEM_WARDEN_CORE, ITEM_SEALRUN_PERMIT, ITEM_STABILIZER_CORE, ITEM_STABILIZATION_MARK, ITEM_ECHO_SHARD, ITEM_ANCHOR_CLUE, ITEM_RULES_NOTE_S5, ITEM_REVERSED_PAGE, ITEM_TERMINAL_KEY_S6, ITEM_SIGIL_NOTE_S2, ITEM_CONTRACT_SHARD, ITEM_HANDWRITING_PROOF, ITEM_ARCHIVE_COORDS, ITEM_CATALOG_TAG, ITEM_CONVERGENCE_WARNING, ITEM_FIRST_ENTRY_CLUE, ITEM_FIRST_NAME_MEMORY, ITEM_POTION_HP_L, ITEM_CORE_SHARD, ITEM_LEDGER_REWRITE_SIGIL

---

## 🎯 단계별 실행 계획

### Phase 1: 기초 인프라 (즉시 실행)
1. ✅ Quest 기반 안정화 (이미 완료: Seed/트리거/Smoke)
2. 🔄 Content 폴더 생성 + 초기 데이터
3. 🔄 Quest 로직 확장 (KILL_BOSS 추가)
4. 🔄 프롤로그 + 시즌 1-2 데이터 주입

### Phase 2: 중반 확장 (시간 허용 시)
5. ⏳ 시즌 3-5 데이터
6. ⏳ 보스 스폰/쿨다운 시스템
7. ⏳ 파티 보너스

### Phase 3: 후반 완성 (별도 PR)
8. ⏳ 시즌 6-10 데이터
9. ⏳ 클라이언트 Quest UI
10. ⏳ 엔딩 분기 (exclusiveGroupId)

---

## 📝 현재 작업: Phase 1 집중

### 작업 1: Content 폴더 구조 생성
```
apps/server/content/
├── balance.json
├── rooms.json
├── monsters.json
├── items.json
├── shops.json
└── quests.json
```

### 작업 2: Quest 로직 확장
- KILL_BOSS objective 타입 추가
- onCombatEnd에서 bossId 매칭
- quest.types.ts / quest.service.ts 업데이트

### 작업 3: 초기 퀘스트 데이터 (프롤로그 + S1-2)
- 총 21개 퀘스트
- 보스 2종 (Residue Broker, Shard Warden)
- 신규 방 10개+
- 신규 아이템 15개+

---

## ⚠️ 주의사항
- STATE_SYNC 경량 유지 (퀘스트 전체 포함 금지)
- TEST_MODE 가드 유지
- 트리거 중복 호출 방지
- 모든 보상은 Prisma transaction

---

## 📊 예상 소요
- Phase 1: 1-2시간 (집중 진행)
- Phase 2: 1시간 (구조만)
- Phase 3: 별도 세션

**현재 우선순위**: Phase 1 완료 후 보고

