// 메인 스토리 시스템

export interface StoryChapter {
  id: string;
  chapterNumber: number;
  title: string;
  description: string;
  requiredLevel: number;
  requiredQuests?: string[];
  startNpc: string;
  startRoomId: string;
  rewards: {
    exp: number;
    gold: number;
    items?: { itemId: string; qty: number }[];
    unlocksFeature?: string;
  };
  cinematicText?: string[];
}

export const MAIN_STORY_CHAPTERS: Record<string, StoryChapter> = {
  // Season 1 (Lv 1~50): 첫 균열: 게이트하우스의 밤
  //
  // NOTE:
  // - 서버는 챕터(StoryChapter) 단위로만 리스트를 내려주므로,
  //   Season 1의 핵심 메인라인을 "길고 촘촘하게" 분해해 제공한다.
  // - 실제 2~3주 분량은 "일일/주간 루프(사냥/던전/평판/제작/강화/이벤트)"에 의해 채워지며,
  //   본 챕터들은 그 루프를 열어주는 '서사/언락/어튜먼트' 역할을 한다.

  s1_ep01: {
    id: 's1_ep01',
    chapterNumber: 1,
    title: '[S1] EP01 게이트하우스의 이방인',
    description:
      '비에 젖은 흙바닥에서 깨어난 당신. 기억은 없고, 손가락에는 십문 문양의 반지 하나. 경비대는 당신을 경계하면서도 필요로 한다.',
    requiredLevel: 1,
    startNpc: 'NPC_GUARD_CAPTAIN',
    startRoomId: 'GH_GATE',
    rewards: {
      exp: 120,
      gold: 300,
      items: [{ itemId: 'ITEM_POTION_HP_M', qty: 3 }],
      unlocksFeature: 'BASIC_COMBAT',
    },
    cinematicText: [
      '차가운 비가 얼굴을 때린다.',
      '손가락의 반지가 번쩍인다.',
      '"여긴… 어디지?"',
      '횃불의 행렬이 다가온다.',
      '낮고 오래된 목소리가 속삭인다: "문이 열렸다."',
    ],
  },

  s1_ep02: {
    id: 's1_ep02',
    chapterNumber: 2,
    title: '[S1] EP02 소문과 장부',
    description:
      '여관의 소문, 대장간의 불꽃, 시장의 속삭임. 게이트하우스의 안전은 “정보” 위에 세워져 있다.',
    requiredLevel: 3,
    requiredQuests: ['s1_ep01'],
    startNpc: 'NPC_INNKEEPER',
    startRoomId: 'GH_INN',
    rewards: {
      exp: 180,
      gold: 500,
      items: [{ itemId: 'ITEM_POTION_HP_S', qty: 5 }],
      unlocksFeature: 'BASIC_TRADE',
    },
    cinematicText: [
      '술잔이 부딪히는 소리.',
      '사람들은 당신을 보며 말을 줄인다.',
      '"그 반지… 어디서 났어?"',
      '재단 서기가 장부를 꽉 쥔다.',
    ],
  },

  s1_ep03: {
    id: 's1_ep03',
    chapterNumber: 3,
    title: '[S1] EP03 잿가루 흔적',
    description:
      '숲 가장자리의 잿가루 표식. 괴물은 단순히 늘어난 것이 아니라… “조율”되고 있다.',
    requiredLevel: 5,
    requiredQuests: ['s1_ep02'],
    startNpc: 'NPC_ELDER',
    startRoomId: 'GH_LEDGER_OFFICE',
    rewards: {
      exp: 350,
      gold: 900,
      items: [{ itemId: 'ITEM_POTION_HP_M', qty: 3 }],
      unlocksFeature: 'PARTY_SYSTEM',
    },
    cinematicText: [
      '원로회 회의실의 공기가 무겁다.',
      '"우린 지금, 문 근처에 서 있다네."',
      '지도 위에 붉은 표시가 늘어난다.',
      '창밖에서 멀리 울음이 들린다.',
    ],
  },

  s1_ep04: {
    id: 's1_ep04',
    chapterNumber: 4,
    title: '[S1] EP04 고블린 굴의 문양',
    description:
      '고블린 굴 깊은 곳에서 발견한 낯익은 문양. 십문 인장과 같은 선이, 벽에 그려져 있다.',
    requiredLevel: 7,
    requiredQuests: ['s1_ep03'],
    startNpc: 'NPC_GUARD_CAPTAIN',
    startRoomId: 'GH_GATE',
    rewards: {
      exp: 450,
      gold: 1200,
      items: [{ itemId: 'ITEM_SWORD_WOOD', qty: 1 }],
      unlocksFeature: 'DUNGEON_SYSTEM',
    },
    cinematicText: [
      '굴 안쪽이 이상하게 따뜻하다.',
      '벽면에 그려진 문양이 숨을 쉬듯 흔들린다.',
      '당신의 반지가 공명한다.',
      '고블린의 눈이 검게 변한다.',
    ],
  },

  s1_ep05: {
    id: 's1_ep05',
    chapterNumber: 5,
    title: '[S1] EP05 검은 후드의 여인',
    description:
      '여관 구석. 검은 후드의 여인이 당신을 “무명자”라 부른다. 그녀가 건넨 목걸이는 반지와 같은 인장을 품고 있다.',
    requiredLevel: 10,
    requiredQuests: ['s1_ep04'],
    startNpc: 'NPC_MYSTERIOUS_WOMAN',
    startRoomId: 'GH_INN',
    rewards: {
      exp: 700,
      gold: 2000,
      items: [{ itemId: 'ITEM_ARMOR_LEATHER', qty: 1 }],
      unlocksFeature: 'SKILL_SYSTEM',
    },
    cinematicText: [
      '"드디어… 찾았네요."',
      '"당신은 이 세계가 지워버린 존재예요."',
      '목걸이가 차가운 빛을 낸다.',
      '머릿속에 단편이 튄다: ‘문지기’… ‘희생’… ‘공허’.',
    ],
  },

  s1_ep06: {
    id: 's1_ep06',
    chapterNumber: 6,
    title: '[S1] EP06 길드의 문턱',
    description:
      '혼자서는 오래 못 버틴다. 게이트하우스 길드 홀에서 “케인”이 말한다: 머드의 세계는, 결국 사람의 전쟁이라고.',
    requiredLevel: 12,
    requiredQuests: ['s1_ep05'],
    startNpc: 'NPC_GUILD_MASTER',
    startRoomId: 'GH_GUILDHALL',
    rewards: {
      exp: 900,
      gold: 3500,
      items: [{ itemId: 'ITEM_ARMOR_CHAIN', qty: 1 }],
      unlocksFeature: 'GUILD_SYSTEM',
    },
    cinematicText: [
      '길드 홀의 깃발이 펄럭인다.',
      '"이 도시엔 규칙이 세 개다."',
      '"길드, 재단, 그리고 잿불."',
      '"어느 편이든… 너는 선택하게 될 거야."',
    ],
  },

  s1_ep07: {
    id: 's1_ep07',
    chapterNumber: 7,
    title: '[S1] EP07 잿불 맹약의 제안',
    description:
      '그림자 길드는 “잿불 맹약”이라는 이름으로 스스로를 부른다. 그들은 봉인의 희생을 끝내자고 속삭인다.',
    requiredLevel: 15,
    requiredQuests: ['s1_ep06'],
    startNpc: 'NPC_MYSTERIOUS_WOMAN',
    startRoomId: 'GH_INN',
    rewards: {
      exp: 1200,
      gold: 5000,
      items: [{ itemId: 'ITEM_POTION_HP_M', qty: 10 }],
      unlocksFeature: 'FACTION_REPUTATION',
    },
    cinematicText: [
      '"우린 악이 아니에요."',
      '"봉인은 누군가의 기억을 먹고 유지돼."',
      '"그 대가가 네 기억을 삼켰지."',
      '밖에서 종이 세 번 울린다. 경비의 신호.',
    ],
  },

  s1_ep08: {
    id: 's1_ep08',
    chapterNumber: 8,
    title: '[S1] EP08 균열의 첫 비명',
    description:
      '하늘이 갈라지고, 괴물들이 “쏟아진다”. 게이트하우스는 첫 월드 이벤트를 맞이한다.',
    requiredLevel: 18,
    requiredQuests: ['s1_ep07'],
    startNpc: 'NPC_GUARD_CAPTAIN',
    startRoomId: 'GH_GATE',
    rewards: {
      exp: 1800,
      gold: 7000,
      items: [{ itemId: 'ITEM_POTION_HP_M', qty: 10 }],
      unlocksFeature: 'WORLD_EVENT',
    },
    cinematicText: [
      '하늘이 찢어진다.',
      '검은 바람이 내려앉는다.',
      '"방어선 유지! 민간인 후퇴!"',
      '당신의 반지가 뜨겁게 달아오른다.',
    ],
  },

  s1_ep09: {
    id: 's1_ep09',
    chapterNumber: 9,
    title: '[S1] EP09 아르카눔의 시험',
    description:
      '아르카눔 탑은 균열을 “봉합”할 룬을 만든다. 하지만 룬은 사람의 의지를 먹고 안정된다.',
    requiredLevel: 20,
    requiredQuests: ['s1_ep08'],
    startNpc: 'NPC_ARCHMAGE',
    // NOTE: seed 룸 기준, 현재 GH_TOWER가 없을 수 있어 안전 룸으로 매핑
    startRoomId: 'GH_APPRAISER',
    rewards: {
      exp: 2200,
      gold: 10000,
      items: [{ itemId: 'ITEM_MP_POTION', qty: 5 }],
      unlocksFeature: 'ENHANCEMENT_CRAFTING',
    },
    cinematicText: [
      '탑 내부는 조용하고 차갑다.',
      '"룬은 숫자가 아니라, 선택이네."',
      '유리관 속 결정이 울린다.',
      '당신의 손끝에서 빛이 새어 나온다.',
    ],
  },

  s1_ep10: {
    id: 's1_ep10',
    chapterNumber: 10,
    title: '[S1] EP10 침투: 잿불의 지하회랑',
    description:
      '잿불 맹약의 거점으로 이어지는 지하회랑. 침투할지, 협상할지—선택은 당신의 평판을 바꾼다.',
    requiredLevel: 23,
    requiredQuests: ['s1_ep09'],
    startNpc: 'NPC_GUILD_MASTER',
    startRoomId: 'GH_GUILDHALL',
    rewards: {
      exp: 2600,
      gold: 12000,
      items: [{ itemId: 'ITEM_ELIXIR', qty: 1 }],
    },
    cinematicText: [
      '돌계단 아래로 냉기가 흐른다.',
      '벽에 새겨진 잿불의 표식.',
      '"뒤로 돌아갈 수도 있어."',
      '하지만 반지가 한 번 더 뜨겁게 울린다.',
    ],
  },

  s1_ep11: {
    id: 's1_ep11',
    chapterNumber: 11,
    title: '[S1] EP11 거래의 피',
    description:
      '재단의 시장에는 위조 강화석이 돈다. 누군가는 균열을 “돈”으로 바꾸고 있다.',
    requiredLevel: 26,
    requiredQuests: ['s1_ep10'],
    startNpc: 'NPC_FOUNDATION_OFFICER',
    startRoomId: 'GH_MARKET',
    rewards: {
      exp: 3000,
      gold: 15000,
      items: [{ itemId: 'ITEM_MAT_ORE_IRON', qty: 10 }],
      unlocksFeature: 'TRADE_SYSTEM',
    },
    cinematicText: [
      '시장 골목에서 피비린내가 난다.',
      '"이건 단순한 사기가 아니지."',
      '"누가 균열의 부산물을 유통시켜."',
      '장부에 적힌 숫자가, 사람 이름과 겹친다.',
    ],
  },

  s1_ep12: {
    id: 's1_ep12',
    chapterNumber: 12,
    title: '[S1] EP12 야수왕의 심장',
    description:
      '숲 심부의 야수들은 “왕”을 섬긴다. 그 심장은 봉인석을 공명시키는 핵이 될 수 있다.',
    requiredLevel: 30,
    requiredQuests: ['s1_ep11'],
    startNpc: 'NPC_ELDER',
    startRoomId: 'GH_LEDGER_OFFICE',
    rewards: {
      exp: 3800,
      gold: 20000,
      items: [{ itemId: 'ITEM_SWORD_IRON', qty: 1 }],
    },
    cinematicText: [
      '숲이 숨을 멈춘다.',
      '뿔피리 소리가 울린다.',
      '거대한 그림자가 나무 사이로 지나간다.',
      '"왕이 온다."',
    ],
  },

  s1_ep13: {
    id: 's1_ep13',
    chapterNumber: 13,
    title: '[S1] EP13 첫 문지기의 기록',
    description:
      '문지기는 봉인을 지키는 관리자가 아니라, “희생의 규칙”을 기록하는 자였다. 기록은 다섯 조각으로 흩어졌다.',
    requiredLevel: 33,
    requiredQuests: ['s1_ep12'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: {
      exp: 4200,
      gold: 24000,
      items: [{ itemId: 'ITEM_MAT_BONE', qty: 10 }],
    },
    cinematicText: [
      '고서의 페이지가 저절로 넘겨진다.',
      '"희생은 봉인의 대가. 대가는 규칙."',
      '"규칙은 바꿀 수 있다—그러나 누군가의 손이 필요하다."',
      '반지가 잠깐, 차갑게 식는다.',
    ],
  },

  s1_ep14: {
    id: 's1_ep14',
    chapterNumber: 14,
    title: '[S1] EP14 균열 폭주: 게이트하우스 공성',
    description:
      '균열이 폭주한다. 게이트하우스는 공성을 치르며, 길드의 힘이 없으면 도시가 무너진다.',
    requiredLevel: 35,
    requiredQuests: ['s1_ep13'],
    startNpc: 'NPC_GUILD_MASTER',
    startRoomId: 'GH_GUILDHALL',
    rewards: {
      exp: 5200,
      gold: 30000,
      items: [{ itemId: 'ITEM_POTION_HP_M', qty: 20 }],
      unlocksFeature: 'SIEGE_EVENT',
    },
    cinematicText: [
      '성문이 흔들린다.',
      '비명과 함성이 겹친다.',
      '"길드들! 방어선 합류!"',
      '하늘의 균열이, 눈처럼 깜박인다.',
    ],
  },

  s1_ep15: {
    id: 's1_ep15',
    chapterNumber: 15,
    title: '[S1] EP15 잿불 맹약의 진실',
    description:
      '잿불은 봉인을 깨려는 게 아니다. 봉인을 “재작성”하려 한다. 희생 없이 유지되는 규칙을.',
    requiredLevel: 38,
    requiredQuests: ['s1_ep14'],
    startNpc: 'NPC_MYSTERIOUS_WOMAN',
    startRoomId: 'GH_INN',
    rewards: {
      exp: 6000,
      gold: 35000,
      items: [{ itemId: 'ITEM_ELIXIR', qty: 2 }],
    },
    cinematicText: [
      '"너는 네 기억이 왜 사라졌는지 알고 싶지?"',
      '"문은… 기억을 먹고 닫혀."',
      '"우린 그 식성을 바꿀 거야."',
      '당신은 처음으로, 잿불이 “악”이 아닐 수 있다고 생각한다.',
    ],
  },

  s1_ep16: {
    id: 's1_ep16',
    chapterNumber: 16,
    title: '[S1] EP16 용골 회랑',
    description:
      '용의 뼈가 묻힌 회랑에서 봉인석 공명 재료를 모아라. 오래전 이곳에도 “문”이 열렸었다.',
    requiredLevel: 42,
    requiredQuests: ['s1_ep15'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: {
      exp: 7500,
      gold: 45000,
      items: [{ itemId: 'ITEM_ARMOR_PLATE', qty: 1 }],
    },
    cinematicText: [
      '뼈가 울린다. 바람이 아니라, 기억이.',
      '바닥의 흑재가 발목에 달라붙는다.',
      '어둠 속 눈동자들이 켜진다.',
      '"아슈드라…" 누군가 이름을 부른다.',
    ],
  },

  s1_ep17: {
    id: 's1_ep17',
    chapterNumber: 17,
    title: '[S1] EP17 문 앞의 어튜먼트',
    description:
      '봉인을 다룰 준비가 된 자만이 문 앞에 설 수 있다. 평판, 재료, 참여—모두가 자격이다.',
    requiredLevel: 45,
    requiredQuests: ['s1_ep16'],
    startNpc: 'NPC_ELDER',
    startRoomId: 'GH_LEDGER_OFFICE',
    rewards: {
      exp: 9000,
      gold: 60000,
      items: [{ itemId: 'ITEM_AMULET_HP', qty: 1 }],
      unlocksFeature: 'SEASON_RAID_ATTUNEMENT',
    },
    cinematicText: [
      '원로가 손을 떤다.',
      '"우린… 이 대가를 너무 오래 치렀네."',
      '"하지만 다른 길이 있다면…"',
      '문양이 적힌 돌판이 당신 앞에 놓인다.',
    ],
  },

  s1_ep18: {
    id: 's1_ep18',
    chapterNumber: 18,
    title: '[S1] EP18 첫 봉인: 검은 재의 용',
    description:
      '균열의 심장부에서 “검은 재의 용, 아슈드라”가 깨어난다. 봉인을 강화할 것인가, 재작성할 것인가, 관리할 것인가.',
    requiredLevel: 50,
    requiredQuests: ['s1_ep17'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: {
      exp: 15000,
      gold: 120000,
      items: [{ itemId: 'ITEM_ELIXIR', qty: 3 }],
      unlocksFeature: 'SEASON_1_COMPLETE',
    },
    cinematicText: [
      '하늘이 붉게 물든다.',
      '검은 재가 눈처럼 내린다.',
      '용의 심장이 땅을 울린다.',
      '"문지기여… 돌아왔구나."',
      '당신의 반지가 마지막으로 빛난다.',
    ],
  },

  // ---------------------------------------------------------------------------
  // Season 2~10 (Lv cap 50): 시즌 명성/장비 티어/세력 평판 중심 진행
  // 서버 스토리 목록에서도 “실제 분량”이 보이도록, 각 시즌을 9개 에피소드(주차별 3개)로 제공.
  //
  // 규칙:
  // - requiredLevel은 50으로 고정(시즌 성장축은 별도 시스템으로 확장 예정)
  // - requiredQuests는 "이전 시즌 마지막 에피소드"를 요구해 시즌을 체인으로 연결
  // - startNpc/startRoomId는 현재 존재하는 NPC/룸만 사용해 클라이언트에서 깨지지 않게 함
  // ---------------------------------------------------------------------------

  // =========================
  // SEASON 2: 염분의 왕관 (솔트헤이븐)
  // =========================
  s2_ep01: {
    id: 's2_ep01',
    chapterNumber: 19,
    title: '[S2] EP01 솔트헤이븐의 실종선',
    description:
      '해안도시 솔트헤이븐으로 향하는 상선들이 연달아 사라진다. 바다 아래 “두 번째 문”이 숨 쉰다는 소문이 번진다.',
    requiredLevel: 50,
    requiredQuests: ['s1_ep18'],
    startNpc: 'NPC_INNKEEPER',
    startRoomId: 'GH_INN',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['바다 냄새가 바람에 실린다.', '장부엔 사라진 배의 이름이 늘어선다.', '"염분의 왕관이 깨어난다."'],
  },
  s2_ep02: {
    id: 's2_ep02',
    chapterNumber: 20,
    title: '[S2] EP02 재단의 보험, 해적의 세금',
    description:
      '재단은 보험을 팔고, 해적은 통행세를 매긴다. 배가 사라지는 이유는 “도둑”이 아니라 “문”일지도 모른다.',
    requiredLevel: 50,
    requiredQuests: ['s2_ep01'],
    startNpc: 'NPC_FOUNDATION_OFFICER',
    startRoomId: 'GH_MARKET',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['"돈은 위험을 사랑하지 않지."', '해적 깃발이 지평선에 걸린다.', '당신의 반지가 짠내처럼 따갑다.'],
  },
  s2_ep03: {
    id: 's2_ep03',
    chapterNumber: 21,
    title: '[S2] EP03 염분 사제단의 성가',
    description:
      '솔트헤이븐의 사제단은 바다를 달래는 성가를 부른다. 그러나 성가의 가사엔 “문”을 여는 문장이 섞여 있다.',
    requiredLevel: 50,
    requiredQuests: ['s2_ep02'],
    startNpc: 'NPC_ELDER',
    startRoomId: 'GH_LEDGER_OFFICE',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['낮은 합창이 파도 위로 번진다.', '가사 속 단어가 반지와 공명한다.', '"바다 아래, 관문이 있다."'],
  },
  s2_ep04: {
    id: 's2_ep04',
    chapterNumber: 22,
    title: '[S2] EP04 침몰한 항로(Week 1 던전)',
    description:
      '침몰한 항로의 잔해 속에서 “문 조각”이 발견된다. 해저의 어둠은 물이 아니라 기억으로 흐른다.',
    requiredLevel: 50,
    requiredQuests: ['s2_ep03'],
    startNpc: 'NPC_GUILD_MASTER',
    startRoomId: 'GH_GUILDHALL',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['썩은 나무가 삐걱인다.', '물속에서 목소리가 들린다.', '당신은 숨을 쉬는데, 폐가 아니라 반지가.'],
  },
  s2_ep05: {
    id: 's2_ep05',
    chapterNumber: 23,
    title: '[S2] EP05 염분의 룬, 유통의 전쟁(Week 2 준비)',
    description:
      '염분의 룬은 장비를 부식시키기도, 강화시키기도 한다. 누가 룬을 독점하는지가 곧 시즌의 전쟁이다.',
    requiredLevel: 50,
    requiredQuests: ['s2_ep04'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['결정이 소금처럼 부서진다.', '"염분은 금속의 기억을 깎아."', '"깎인 자리에 새 규칙을 새기지."'],
  },
  s2_ep06: {
    id: 's2_ep06',
    chapterNumber: 24,
    title: '[S2] EP06 난파선 경매장(Week 2 던전)',
    description:
      '해적들은 난파선의 잔해를 경매한다. 경매장 지하에는 “두 번째 문”의 지도 조각이 숨겨져 있다.',
    requiredLevel: 50,
    requiredQuests: ['s2_ep05'],
    startNpc: 'NPC_FOUNDATION_OFFICER',
    startRoomId: 'GH_MARKET',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['망치 소리와 웃음소리.', '피가 바닥에 떨어진다.', '지도 조각이 손끝에서 차갑게 운다.'],
  },
  s2_ep07: {
    id: 's2_ep07',
    chapterNumber: 25,
    title: '[S2] EP07 심해의 문고리(Week 3 어튜먼트)',
    description:
      '두 번째 문은 “문고리”를 요구한다. 문고리는 물건이 아니라—약속이다. 세력의 약속, 길드의 약속, 당신의 약속.',
    requiredLevel: 50,
    requiredQuests: ['s2_ep06'],
    startNpc: 'NPC_GUILD_MASTER',
    startRoomId: 'GH_GUILDHALL',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['바다가 깊어질수록 조용해진다.', '조용함 속에 심장 소리가 겹친다.', '"문은 조건을 먹는다."'],
  },
  s2_ep08: {
    id: 's2_ep08',
    chapterNumber: 26,
    title: '[S2] EP08 염분의 왕관(레이드 전야)',
    description:
      '심해에서 왕관이 떠오른다. 염분은 금속을 갉고, 기억을 갉고, 관계를 갉는다. 길드가 흔들린다.',
    requiredLevel: 50,
    requiredQuests: ['s2_ep07'],
    startNpc: 'NPC_INNKEEPER',
    startRoomId: 'GH_INN',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['술잔이 깨진다.', '누군가 이름을 잃고 운다.', '왕관의 그림자가 물 위에 드리운다.'],
  },
  s2_ep09: {
    id: 's2_ep09',
    chapterNumber: 27,
    title: '[S2] EP09 봉인 2/10: 심해왕 “염관”',
    description:
      '두 번째 문 앞에서 “심해왕 염관”이 모습을 드러낸다. 봉인을 강화할지, 재작성할지, 관리할지—결과는 다음 시즌의 경제를 바꾼다.',
    requiredLevel: 50,
    requiredQuests: ['s2_ep08'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0, unlocksFeature: 'SEASON_2_COMPLETE' },
    cinematicText: ['검푸른 물이 하늘처럼 열린다.', '"문지기여… 또 왔나."', '왕관이 당신을 바라본다.'],
  },

  // =========================
  // SEASON 3: 철림 전쟁 (아이언우드)
  // =========================
  s3_ep01: {
    id: 's3_ep01',
    chapterNumber: 28,
    title: '[S3] EP01 철림의 깃발',
    description:
      '아이언우드에선 나무가 철처럼 단단하다. 세력들은 그 자원을 두고 전쟁을 시작한다. 세 번째 문은 “영토”를 먹는다.',
    requiredLevel: 50,
    requiredQuests: ['s2_ep09'],
    startNpc: 'NPC_GUILD_MASTER',
    startRoomId: 'GH_GUILDHALL',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['깃발이 불타고, 다시 세워진다.', '나무결에서 금속 소리가 난다.', '"숲이 전쟁을 배운다."'],
  },
  s3_ep02: {
    id: 's3_ep02',
    chapterNumber: 29,
    title: '[S3] EP02 자원전: 목재가 아닌 “규칙”',
    description:
      '철림의 자원은 단순한 재료가 아니다. 강화/제작의 규칙을 바꾸는 “결정”이다. 재단이 움직인다.',
    requiredLevel: 50,
    requiredQuests: ['s3_ep01'],
    startNpc: 'NPC_FOUNDATION_OFFICER',
    startRoomId: 'GH_MARKET',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['장부에 “전리품”이 찍힌다.', '가격표가 사람 목숨을 대신한다.', '당신의 반지가 금속 냄새를 풍긴다.'],
  },
  s3_ep03: {
    id: 's3_ep03',
    chapterNumber: 30,
    title: '[S3] EP03 잿불의 사절, 불씨의 계약',
    description:
      '잿불은 전쟁을 “끝”내려 하지 않는다. 전쟁을 “자기 편”으로 만들려 한다. 불씨의 계약이 당신에게 제안된다.',
    requiredLevel: 50,
    requiredQuests: ['s3_ep02'],
    startNpc: 'NPC_MYSTERIOUS_WOMAN',
    startRoomId: 'GH_INN',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['"전쟁은 봉인의 도구야."', '"도구를 쥐는 손을 바꾸면 돼."', '촛불이 바람 없이 흔들린다.'],
  },
  s3_ep04: {
    id: 's3_ep04',
    chapterNumber: 31,
    title: '[S3] EP04 전초기지 붕괴(Week 1 던전)',
    description:
      '전초기지 지하에서 “세 번째 문”의 울림이 감지된다. 병사들은 악몽을 꾸고, 꿈에서 깨어나지 못한다.',
    requiredLevel: 50,
    requiredQuests: ['s3_ep03'],
    startNpc: 'NPC_GUARD_CAPTAIN',
    startRoomId: 'GH_GATE',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['땅이 꺼지고, 함성이 삼켜진다.', '꿈이 현실이 된다.', '반지가 당신을 앞으로 끌고 간다.'],
  },
  s3_ep05: {
    id: 's3_ep05',
    chapterNumber: 32,
    title: '[S3] EP05 철림 룬각(Week 2 티어업)',
    description:
      '철림의 룬각은 장비를 “가볍게” 만든다. 빠른 전투, 빠른 죽음. PvP의 그림자가 드리운다.',
    requiredLevel: 50,
    requiredQuests: ['s3_ep04'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['칼이 공기를 찢는다.', '"속도가 곧 생존이다."', '룬각이 손바닥에 살을 파고든다.'],
  },
  s3_ep06: {
    id: 's3_ep06',
    chapterNumber: 33,
    title: '[S3] EP06 전쟁의 재단(Week 2 던전)',
    description:
      '재단은 전쟁을 관리한다. 관리의 이름으로—봉인을 부른다. 장부의 마지막 페이지는 피로 쓰였다.',
    requiredLevel: 50,
    requiredQuests: ['s3_ep05'],
    startNpc: 'NPC_FOUNDATION_OFFICER',
    startRoomId: 'GH_MARKET',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['금고가 열리고, 동시에 관이 닫힌다.', '"이건 손실이 아니야."', '"필요 비용이지."'],
  },
  s3_ep07: {
    id: 's3_ep07',
    chapterNumber: 34,
    title: '[S3] EP07 영토의 서약(Week 3 어튜먼트)',
    description:
      '세 번째 문은 “땅의 이름”을 요구한다. 누가 영토를 소유하느냐가 곧 문을 여닫는 권한이 된다.',
    requiredLevel: 50,
    requiredQuests: ['s3_ep06'],
    startNpc: 'NPC_GUILD_MASTER',
    startRoomId: 'GH_GUILDHALL',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['깃발 아래에서 맹세가 오간다.', '서약은 칼보다 무겁다.', '땅이 당신의 이름을 기억한다.'],
  },
  s3_ep08: {
    id: 's3_ep08',
    chapterNumber: 35,
    title: '[S3] EP08 철림 공성전(레이드 전야)',
    description:
      '공성은 전투가 아니라 “결정”이다. 누가 승리하느냐가 아니라, 누가 규칙을 갖느냐가.',
    requiredLevel: 50,
    requiredQuests: ['s3_ep07'],
    startNpc: 'NPC_GUARD_CAPTAIN',
    startRoomId: 'GH_GATE',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['성벽이 부서진다.', '사람들이 아니라 규칙이 무너진다.', '문이 웃는 소리가 들린다.'],
  },
  s3_ep09: {
    id: 's3_ep09',
    chapterNumber: 36,
    title: '[S3] EP09 봉인 3/10: 철림군주 “철각”',
    description:
      '세 번째 문 앞에서 “철각”이 나타난다. 봉인은 전쟁을 먹고 강해진다. 당신의 선택이 다음 시즌의 평화를 결정한다.',
    requiredLevel: 50,
    requiredQuests: ['s3_ep08'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0, unlocksFeature: 'SEASON_3_COMPLETE' },
    cinematicText: ['숲이 갑옷을 입는다.', '"문지기… 전쟁을 가져왔군."', '철각이 땅을 두드린다.'],
  },

  // =========================
  // SEASON 4: 망자의 회계 (언더크립트)
  // =========================
  s4_ep01: {
    id: 's4_ep01',
    chapterNumber: 37,
    title: '[S4] EP01 죽은 자의 장부',
    description:
      '언더크립트의 장부엔 “죽은 자의 부채”가 적혀 있다. 네 번째 문은 죽음을 끝내지 않고, 이자를 붙인다.',
    requiredLevel: 50,
    requiredQuests: ['s3_ep09'],
    startNpc: 'NPC_FOUNDATION_OFFICER',
    startRoomId: 'GH_MARKET',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['장부가 스스로 펼쳐진다.', '이름 옆에 “미납”이 찍혀 있다.', '당신의 이름도—잠깐 보인다.'],
  },
  s4_ep02: {
    id: 's4_ep02',
    chapterNumber: 38,
    title: '[S4] EP02 유골 경매와 칭호',
    description:
      '망자의 유골이 경매된다. 칭호와 업적마저도 거래된다. 누군가는 죽음을 “콘텐츠”로 만든다.',
    requiredLevel: 50,
    requiredQuests: ['s4_ep01'],
    startNpc: 'NPC_INNKEEPER',
    startRoomId: 'GH_INN',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['촛불이 꺼졌다 켜진다.', '누군가 웃으며 관을 두드린다.', '"죽음은 값이 싸."'],
  },
  s4_ep03: {
    id: 's4_ep03',
    chapterNumber: 39,
    title: '[S4] EP03 문지기의 세금',
    description:
      '문지기는 봉인을 “관리”하고, 관리에는 세금이 따른다. 네 번째 문은 당신에게 “납부”를 요구한다.',
    requiredLevel: 50,
    requiredQuests: ['s4_ep02'],
    startNpc: 'NPC_ELDER',
    startRoomId: 'GH_LEDGER_OFFICE',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['원로가 한숨 쉰다.', '"우린 너무 오래 세금을 냈네."', '반지가 차갑게 식는다.'],
  },
  s4_ep04: {
    id: 's4_ep04',
    chapterNumber: 40,
    title: '[S4] EP04 언더크립트의 문지기(Week 1 던전)',
    description:
      '무덤 아래, 기록이 잠들어 있다. 기록은 읽히는 순간—읽는 이를 기록한다.',
    requiredLevel: 50,
    requiredQuests: ['s4_ep03'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['돌문이 닫힌다.', '글자가 벽을 기어 다닌다.', '당신의 발소리가, 당신의 이름이 된다.'],
  },
  s4_ep05: {
    id: 's4_ep05',
    chapterNumber: 41,
    title: '[S4] EP05 부활의 가격(Week 2 티어업)',
    description:
      '부활은 은혜가 아니라 계약이다. 계약서엔 작은 글씨로 “기억”이 적혀 있다.',
    requiredLevel: 50,
    requiredQuests: ['s4_ep04'],
    startNpc: 'NPC_FOUNDATION_OFFICER',
    startRoomId: 'GH_MARKET',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['서명란이 비어 있다.', '"네가 잊는 만큼, 네가 산다."', '잉크가 피처럼 흐른다.'],
  },
  s4_ep06: {
    id: 's4_ep06',
    chapterNumber: 42,
    title: '[S4] EP06 망자의 합창단(Week 2 던전)',
    description:
      '언더크립트의 합창단은 숨이 없다. 그러나 노래한다. 노래는 네 번째 문의 “열쇠”다.',
    requiredLevel: 50,
    requiredQuests: ['s4_ep05'],
    startNpc: 'NPC_ELDER',
    startRoomId: 'GH_LEDGER_OFFICE',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['노래가 귀가 아니라 뼈에 닿는다.', '관들이 떨린다.', '반지가 박자를 맞춘다.'],
  },
  s4_ep07: {
    id: 's4_ep07',
    chapterNumber: 43,
    title: '[S4] EP07 미납자 명단(Week 3 어튜먼트)',
    description:
      '네 번째 문은 “미납자”를 추적하라 명한다. 미납자는 남이 아니라—너 자신일 수도 있다.',
    requiredLevel: 50,
    requiredQuests: ['s4_ep06'],
    startNpc: 'NPC_MYSTERIOUS_WOMAN',
    startRoomId: 'GH_INN',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['"네 이름이 적혀 있더라."', '"무명자… 너도 빚을 졌어."', '당신의 기억이 한 줄 지워진다.'],
  },
  s4_ep08: {
    id: 's4_ep08',
    chapterNumber: 44,
    title: '[S4] EP08 장부의 끝(레이드 전야)',
    description:
      '장부의 마지막 페이지엔 “문을 닫는 방법”이 아닌 “문을 유지하는 비용”이 적혀 있다. 사람들은 그걸 읽고 미쳐간다.',
    requiredLevel: 50,
    requiredQuests: ['s4_ep07'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['책장이 타들어 간다.', '"이게… 진실인가."', '진실이 공포가 된다.'],
  },
  s4_ep09: {
    id: 's4_ep09',
    chapterNumber: 45,
    title: '[S4] EP09 봉인 4/10: 회계자 “코덱스”',
    description:
      '네 번째 문 앞, “회계자 코덱스”는 모든 생명을 숫자로 본다. 선택에 따라 다음 시즌의 강화/부활 규칙이 달라진다.',
    requiredLevel: 50,
    requiredQuests: ['s4_ep08'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0, unlocksFeature: 'SEASON_4_COMPLETE' },
    cinematicText: ['거대한 깃펜이 하늘을 긋는다.', '"지불해."', '숫자가 칼이 된다.'],
  },

  // =========================
  // SEASON 5: 하늘의 단조 (스카이포지)
  // =========================
  s5_ep01: {
    id: 's5_ep01',
    chapterNumber: 46,
    title: '[S5] EP01 스카이포지의 불꽃',
    description:
      '하늘에 매달린 단조장, 스카이포지. 다섯 번째 문은 “장비”를 통해서만 열린다. 규칙을 두드려 새기는 시즌.',
    requiredLevel: 50,
    requiredQuests: ['s4_ep09'],
    startNpc: 'NPC_BLACKSMITH',
    startRoomId: 'GH_BLACKSMITH',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['망치 소리가 번개처럼 울린다.', '불꽃이 하늘로 솟는다.', '"강화는 기도야."'],
  },
  s5_ep02: {
    id: 's5_ep02',
    chapterNumber: 47,
    title: '[S5] EP02 룬 슬롯의 진실',
    description:
      '룬 슬롯은 “빈칸”이 아니다. 그 빈칸은 무엇이든 먹는다—특히 기억을.',
    requiredLevel: 50,
    requiredQuests: ['s5_ep01'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['빈칸이 당신을 바라본다.', '"넣는 만큼 잃는다."', '반지 문양이 잠깐 흐려진다.'],
  },
  s5_ep03: {
    id: 's5_ep03',
    chapterNumber: 48,
    title: '[S5] EP03 부서진 천공선',
    description:
      '하늘길을 잇는 천공선이 추락한다. 누군가 다섯 번째 문으로 “물건”을 실어 나르려 했다.',
    requiredLevel: 50,
    requiredQuests: ['s5_ep02'],
    startNpc: 'NPC_FOUNDATION_OFFICER',
    startRoomId: 'GH_MARKET',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['금속 파편이 비처럼 떨어진다.', '사람들이 하늘을 저주한다.', '"문이 물류가 됐다."'],
  },
  s5_ep04: {
    id: 's5_ep04',
    chapterNumber: 49,
    title: '[S5] EP04 공중 제련장(Week 1 던전)',
    description:
      '공중 제련장의 심장부엔 다섯 번째 문과 연결된 “단조 룬”이 있다. 접근엔 파티/길드 협력이 필요하다.',
    requiredLevel: 50,
    requiredQuests: ['s5_ep03'],
    startNpc: 'NPC_GUILD_MASTER',
    startRoomId: 'GH_GUILDHALL',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['바닥이 없다.', '불꽃이 떨어지지 않고 떠오른다.', '당신의 발밑에서 하늘이 열린다.'],
  },
  s5_ep05: {
    id: 's5_ep05',
    chapterNumber: 50,
    title: '[S5] EP05 강화를 둘러싼 길드전(Week 2)',
    description:
      '강화 재료를 누가 갖느냐가 권력이다. 길드전이 “콘텐츠”가 아닌 “서사”가 되는 시즌.',
    requiredLevel: 50,
    requiredQuests: ['s5_ep04'],
    startNpc: 'NPC_GUILD_MASTER',
    startRoomId: 'GH_GUILDHALL',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['깃발이 불꽃 속에서 흔들린다.', '"강화석을 내놔."', '협정이 깨진다.'],
  },
  s5_ep06: {
    id: 's5_ep06',
    chapterNumber: 51,
    title: '[S5] EP06 천공의 대장간(Week 2 던전)',
    description:
      '스카이포지 내부는 룬으로 짜인 미로다. 다섯 번째 문은 “완성된 장비”를 요구한다.',
    requiredLevel: 50,
    requiredQuests: ['s5_ep05'],
    startNpc: 'NPC_BLACKSMITH',
    startRoomId: 'GH_BLACKSMITH',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['미로가 스스로 재배열된다.', '칼날이 노래한다.', '장비가 한 번, 심장처럼 뛴다.'],
  },
  s5_ep07: {
    id: 's5_ep07',
    chapterNumber: 52,
    title: '[S5] EP07 단조의 서약(Week 3 어튜먼트)',
    description:
      '다섯 번째 문 앞에서, 당신은 “어떤 규칙을 새길지” 선택해야 한다. 강화는 선택의 각인이다.',
    requiredLevel: 50,
    requiredQuests: ['s5_ep06'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['룬이 피부 위로 흐른다.', '"네 선택을 장비에 새겨."', '그 선택이 너를 바꾼다.'],
  },
  s5_ep08: {
    id: 's5_ep08',
    chapterNumber: 53,
    title: '[S5] EP08 하늘의 불꽃(레이드 전야)',
    description:
      '하늘의 불꽃이 폭주한다. 스카이포지 아래의 도시들이 불타기 시작한다. 레이드 준비가 필수가 된다.',
    requiredLevel: 50,
    requiredQuests: ['s5_ep07'],
    startNpc: 'NPC_GUARD_CAPTAIN',
    startRoomId: 'GH_GATE',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['하늘에서 불이 내린다.', '사람들이 신을 욕한다.', '문은 웃고 있다.'],
  },
  s5_ep09: {
    id: 's5_ep09',
    chapterNumber: 54,
    title: '[S5] EP09 봉인 5/10: 단조왕 “포지핸드”',
    description:
      '다섯 번째 문 앞, “포지핸드”는 규칙을 망치로 두드린다. 선택에 따라 다음 시즌의 제작/강화 메타가 바뀐다.',
    requiredLevel: 50,
    requiredQuests: ['s5_ep08'],
    startNpc: 'NPC_BLACKSMITH',
    startRoomId: 'GH_BLACKSMITH',
    rewards: { exp: 0, gold: 0, unlocksFeature: 'SEASON_5_COMPLETE' },
    cinematicText: ['거대한 망치가 하늘을 가른다.', '"새겨라."', '금속이 아니라 규칙이 휘어진다.'],
  },

  // =========================
  // SEASON 6: 거울바다 (미러스)
  // =========================
  s6_ep01: {
    id: 's6_ep01',
    chapterNumber: 55,
    title: '[S6] EP01 거울바다의 파편',
    description:
      '거울바다 미러스에선 물이 현실을 비춘다. 여섯 번째 문은 “분기”로 열린다. 선택이 세계를 나눈다.',
    requiredLevel: 50,
    requiredQuests: ['s5_ep09'],
    startNpc: 'NPC_INNKEEPER',
    startRoomId: 'GH_INN',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['물 위에 다른 하늘이 떠 있다.', '당신의 얼굴이… 낯설다.', '"네가 누구였는지 보게 될 거야."'],
  },
  s6_ep02: {
    id: 's6_ep02',
    chapterNumber: 56,
    title: '[S6] EP02 사라진 선택지',
    description:
      '당신이 했던 선택들이 기록에서 사라져 있다. 누군가 선택을 훔친다. 훔친 선택은 여섯 번째 문의 열쇠가 된다.',
    requiredLevel: 50,
    requiredQuests: ['s6_ep01'],
    startNpc: 'NPC_ELDER',
    startRoomId: 'GH_LEDGER_OFFICE',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['기록이 비어 있다.', '원로가 떤다.', '"선택이… 도둑맞았네."'],
  },
  s6_ep03: {
    id: 's6_ep03',
    chapterNumber: 57,
    title: '[S6] EP03 무명자의 그림자',
    description:
      '거울 속에서 “당신의 다른 버전”이 나타난다. 그는 당신보다 더 많은 것을 기억한다.',
    requiredLevel: 50,
    requiredQuests: ['s6_ep02'],
    startNpc: 'NPC_MYSTERIOUS_WOMAN',
    startRoomId: 'GH_INN',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['거울이 웃는다.', '"난 너다."', '"네가 버린 선택의 합."'],
  },
  s6_ep04: {
    id: 's6_ep04',
    chapterNumber: 58,
    title: '[S6] EP04 반전의 해안(Week 1 던전)',
    description:
      '거울바다의 해안선은 계속 바뀐다. 던전은 지도 대신 “결정 로그”로 공략된다. 머드의 탐색이 폭발한다.',
    requiredLevel: 50,
    requiredQuests: ['s6_ep03'],
    startNpc: 'NPC_GUILD_MASTER',
    startRoomId: 'GH_GUILDHALL',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['길이 바뀐다.', '표지판이 거짓말을 한다.', '당신의 반지가 북쪽을 가리킨다.'],
  },
  s6_ep05: {
    id: 's6_ep05',
    chapterNumber: 59,
    title: '[S6] EP05 평행의 거래(Week 2)',
    description:
      '다른 세계의 재료가 유입된다. 경제가 흔들리고, 재단은 이를 “상품”으로 고정하려 한다.',
    requiredLevel: 50,
    requiredQuests: ['s6_ep04'],
    startNpc: 'NPC_FOUNDATION_OFFICER',
    startRoomId: 'GH_MARKET',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['가격이 하루에 세 번 바뀐다.', '"이건 희귀가 아니야."', '"다른 세계의 잔여지."'],
  },
  s6_ep06: {
    id: 's6_ep06',
    chapterNumber: 60,
    title: '[S6] EP06 거울심연(Week 2 던전)',
    description:
      '거울심연에선 공격이 반사되고, 치유가 독이 된다. 파티 조합이 곧 퍼즐이다.',
    requiredLevel: 50,
    requiredQuests: ['s6_ep05'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['너의 주문이 너를 때린다.', '아군이 적처럼 보인다.', '"거울은 진실을 싫어해."'],
  },
  s6_ep07: {
    id: 's6_ep07',
    chapterNumber: 61,
    title: '[S6] EP07 선택의 낙인(Week 3 어튜먼트)',
    description:
      '여섯 번째 문은 “후회”를 먹는다. 후회를 바치면 길이 열린다. 후회를 남기면, 길은 닫힌다.',
    requiredLevel: 50,
    requiredQuests: ['s6_ep06'],
    startNpc: 'NPC_ELDER',
    startRoomId: 'GH_LEDGER_OFFICE',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['당신은 과거를 본다.', '그리고 다시 선택한다.', '반지가 뜨겁게 울린다.'],
  },
  s6_ep08: {
    id: 's6_ep08',
    chapterNumber: 62,
    title: '[S6] EP08 무명자의 이름(레이드 전야)',
    description:
      '당신의 “진짜 이름”이 드러날 조짐. 이름은 힘이고, 문은 그 힘을 원한다.',
    requiredLevel: 50,
    requiredQuests: ['s6_ep07'],
    startNpc: 'NPC_MYSTERIOUS_WOMAN',
    startRoomId: 'GH_INN',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['리아가 입술을 깨문다.', '"말하면… 넌 바뀌어."', '당신은 이름을 듣고 싶다.'],
  },
  s6_ep09: {
    id: 's6_ep09',
    chapterNumber: 63,
    title: '[S6] EP09 봉인 6/10: 거울왕 “리플렉터”',
    description:
      '여섯 번째 문 앞, “리플렉터”는 당신의 선택을 당신에게 돌려준다. 선택에 따라 시즌 7 PvP 규칙이 변한다.',
    requiredLevel: 50,
    requiredQuests: ['s6_ep08'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0, unlocksFeature: 'SEASON_6_COMPLETE' },
    cinematicText: ['거울이 산산이 부서진다.', '"네가 만든 세계를 봐."', '파편 속에서 눈이 깜박인다.'],
  },

  // =========================
  // SEASON 7: 핏빛 달의 투기장 (PvP/랭크)
  // =========================
  s7_ep01: {
    id: 's7_ep01',
    chapterNumber: 64,
    title: '[S7] EP01 핏빛 달의 초대장',
    description:
      '투기장이 열리고, 랭크가 생긴다. 일곱 번째 문은 “패배”를 먹고 강해진다.',
    requiredLevel: 50,
    requiredQuests: ['s6_ep09'],
    startNpc: 'NPC_GUILD_MASTER',
    startRoomId: 'GH_GUILDHALL',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['붉은 달이 떠오른다.', '현판에 이름이 새겨진다.', '"서열은 진실보다 강하다."'],
  },
  s7_ep02: {
    id: 's7_ep02',
    chapterNumber: 65,
    title: '[S7] EP02 칭호는 칼이 된다',
    description:
      '칭호는 장식이 아니다. 버프다. 그리고 표적이다. PvP는 단순한 싸움이 아니라 정치가 된다.',
    requiredLevel: 50,
    requiredQuests: ['s7_ep01'],
    startNpc: 'NPC_FOUNDATION_OFFICER',
    startRoomId: 'GH_MARKET',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['칭호가 붙는 순간 표적이 된다.', '사람들이 미소로 협박한다.', '장부가 랭킹표로 바뀐다.'],
  },
  s7_ep03: {
    id: 's7_ep03',
    chapterNumber: 66,
    title: '[S7] EP03 사도의 첫 공개',
    description:
      '공허의 “사도”가 공개적으로 등장한다. 그는 패배자의 기억을 먹는다.',
    requiredLevel: 50,
    requiredQuests: ['s7_ep02'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['관중이 환호한다.', '그 환호가 비명으로 변한다.', '"패배는 내 식사다."'],
  },
  s7_ep04: {
    id: 's7_ep04',
    chapterNumber: 67,
    title: '[S7] EP04 투기장 하부(Week 1 던전)',
    description:
      '투기장 하부엔 승부조작의 증거와, 일곱 번째 문의 흔적이 있다. PvE로 PvP의 진실을 파헤친다.',
    requiredLevel: 50,
    requiredQuests: ['s7_ep03'],
    startNpc: 'NPC_GUILD_MASTER',
    startRoomId: 'GH_GUILDHALL',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['피가 바닥의 홈을 따라 흐른다.', '누군가의 이름이 지워져 있다.', '문양이 붉게 달아오른다.'],
  },
  s7_ep05: {
    id: 's7_ep05',
    chapterNumber: 68,
    title: '[S7] EP05 랭크의 거래(Week 2)',
    description:
      '랭크를 사는 사람, 팔아넘기는 사람. 재단은 이를 “시장”으로 만든다. 잿불은 이를 “무너뜨릴” 구실로 삼는다.',
    requiredLevel: 50,
    requiredQuests: ['s7_ep04'],
    startNpc: 'NPC_FOUNDATION_OFFICER',
    startRoomId: 'GH_MARKET',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['랭크표가 경매장으로 옮겨진다.', '"이건 게임이야."', '게임이 현실을 찢는다.'],
  },
  s7_ep06: {
    id: 's7_ep06',
    chapterNumber: 69,
    title: '[S7] EP06 사도의 사냥터(Week 2 던전)',
    description:
      '사도는 패배자만 먹지 않는다. 그는 “희망”을 먹는다. 던전은 플레이어의 심리를 시험한다.',
    requiredLevel: 50,
    requiredQuests: ['s7_ep05'],
    startNpc: 'NPC_MYSTERIOUS_WOMAN',
    startRoomId: 'GH_INN',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['문이 열리고, 너의 약점이 나온다.', '"도망쳐."', '도망친 자리에서 사도가 웃는다.'],
  },
  s7_ep07: {
    id: 's7_ep07',
    chapterNumber: 70,
    title: '[S7] EP07 패배의 맹세(Week 3 어튜먼트)',
    description:
      '일곱 번째 문은 “패배를 인정한 자”에게 열린다. 이상하게 들리지만… 인정은 곧 규칙을 바꾸는 시작이다.',
    requiredLevel: 50,
    requiredQuests: ['s7_ep06'],
    startNpc: 'NPC_ELDER',
    startRoomId: 'GH_LEDGER_OFFICE',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['당신은 한 번 진다.', '그리고 다시 선다.', '반지가 조용해진다.'],
  },
  s7_ep08: {
    id: 's7_ep08',
    chapterNumber: 71,
    title: '[S7] EP08 붉은 달의 결투장(레이드 전야)',
    description:
      '붉은 달이 가장 높이 뜨는 밤, 투기장은 문이 된다. 관중은 제물이고, 환호는 주문이다.',
    requiredLevel: 50,
    requiredQuests: ['s7_ep07'],
    startNpc: 'NPC_GUARD_CAPTAIN',
    startRoomId: 'GH_GATE',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['달빛이 피처럼 번진다.', '관중의 눈이 검게 변한다.', '당신은 링 위에 선다.'],
  },
  s7_ep09: {
    id: 's7_ep09',
    chapterNumber: 72,
    title: '[S7] EP09 봉인 7/10: 투기장왕 “블러드문”',
    description:
      '일곱 번째 문 앞, “블러드문”은 승리도 패배도 먹는다. 선택에 따라 시즌 8의 시간 규칙이 달라진다.',
    requiredLevel: 50,
    requiredQuests: ['s7_ep08'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0, unlocksFeature: 'SEASON_7_COMPLETE' },
    cinematicText: ['링이 문으로 변한다.', '"경기를 계속해."', '달이 당신의 이름을 부른다.'],
  },

  // =========================
  // SEASON 8: 시계장치 성역 (클록생텀)
  // =========================
  s8_ep01: {
    id: 's8_ep01',
    chapterNumber: 73,
    title: '[S8] EP01 멈춘 종소리',
    description:
      '시계장치 성역에선 시간이 멈춘다. 여덟 번째 문은 “되감기”로 열린다. 실패가 곧 자원이 된다.',
    requiredLevel: 50,
    requiredQuests: ['s7_ep09'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['종이 울리지 않는다.', '초가 타지 않는다.', '당신의 심장만이 시간을 센다.'],
  },
  s8_ep02: {
    id: 's8_ep02',
    chapterNumber: 74,
    title: '[S8] EP02 루프의 대가',
    description:
      '루프는 편의가 아니다. 루프는 빚이다. 되감은 시간만큼—무언가를 갚아야 한다.',
    requiredLevel: 50,
    requiredQuests: ['s8_ep01'],
    startNpc: 'NPC_ELDER',
    startRoomId: 'GH_LEDGER_OFFICE',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['"시간은 공짜가 아니야."', '장부에 “시간”이 적힌다.', '반지가 무겁게 내려앉는다.'],
  },
  s8_ep03: {
    id: 's8_ep03',
    chapterNumber: 75,
    title: '[S8] EP03 문지기의 초상',
    description:
      '여덟 번째 문 근처에서 “문지기”의 초상이 발견된다. 그 얼굴은… 당신과 닮았다.',
    requiredLevel: 50,
    requiredQuests: ['s8_ep02'],
    startNpc: 'NPC_MYSTERIOUS_WOMAN',
    startRoomId: 'GH_INN',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['리아가 시선을 피한다.', '"보지 마."', '초상화가 미소 짓는다.'],
  },
  s8_ep04: {
    id: 's8_ep04',
    chapterNumber: 76,
    title: '[S8] EP04 클록생텀 전실(Week 1 던전)',
    description:
      '퍼즐 던전의 전실. 시간 기믹이 본격화된다. 머드의 “공략 공유”가 시즌의 문화가 된다.',
    requiredLevel: 50,
    requiredQuests: ['s8_ep03'],
    startNpc: 'NPC_GUILD_MASTER',
    startRoomId: 'GH_GUILDHALL',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['레버를 당기면 과거가 열린다.', '문이 닫히면 기억이 닫힌다.', '정답은 한 개가 아니다.'],
  },
  s8_ep05: {
    id: 's8_ep05',
    chapterNumber: 77,
    title: '[S8] EP05 시간의 제작법(Week 2)',
    description:
      '시간을 재료로 쓰는 제작법이 등장한다. 강화는 시간, 수리는 과거, 재련은 미래를 깎는다.',
    requiredLevel: 50,
    requiredQuests: ['s8_ep04'],
    startNpc: 'NPC_BLACKSMITH',
    startRoomId: 'GH_BLACKSMITH',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['망치가 내려칠 때마다 초침이 튄다.', '"이건 금속이 아니야."', '"시간이지."'],
  },
  s8_ep06: {
    id: 's8_ep06',
    chapterNumber: 78,
    title: '[S8] EP06 시계장치 심연(Week 2 던전)',
    description:
      '시계장치 심연은 “반복”을 강제한다. 루프를 통제하는 자만이 던전을 통과한다.',
    requiredLevel: 50,
    requiredQuests: ['s8_ep05'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['같은 방을 세 번 지난다.', '세 번째에서만 문이 열린다.', '당신의 선택이 시간을 찢는다.'],
  },
  s8_ep07: {
    id: 's8_ep07',
    chapterNumber: 79,
    title: '[S8] EP07 되감기의 증인(Week 3 어튜먼트)',
    description:
      '여덟 번째 문은 “증인”을 요구한다. 되감은 시간의 증인. 누군가는 그 증인이 되길 거부한다.',
    requiredLevel: 50,
    requiredQuests: ['s8_ep06'],
    startNpc: 'NPC_ELDER',
    startRoomId: 'GH_LEDGER_OFFICE',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['서명이 필요하다.', '그러나 서명은 곧 희생이다.', '원로의 손이 떤다.'],
  },
  s8_ep08: {
    id: 's8_ep08',
    chapterNumber: 80,
    title: '[S8] EP08 문지기의 탄생(레이드 전야)',
    description:
      '문지기는 태어나는 게 아니라 만들어진다. 그리고… 당신은 그 공정을 본 적이 있다.',
    requiredLevel: 50,
    requiredQuests: ['s8_ep07'],
    startNpc: 'NPC_MYSTERIOUS_WOMAN',
    startRoomId: 'GH_INN',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['리아의 목소리가 떨린다.', '"너는… 한 번 문지기였어."', '기억이 폭발한다.'],
  },
  s8_ep09: {
    id: 's8_ep09',
    chapterNumber: 81,
    title: '[S8] EP09 봉인 8/10: 시간군주 “클록하트”',
    description:
      '여덟 번째 문 앞, “클록하트”는 시간을 심장처럼 뛴다. 선택에 따라 시즌 9 월드보스 주기가 바뀐다.',
    requiredLevel: 50,
    requiredQuests: ['s8_ep08'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0, unlocksFeature: 'SEASON_8_COMPLETE' },
    cinematicText: ['초침이 검이 된다.', '"되감아."', '되감은 끝에 공허가 기다린다.'],
  },

  // =========================
  // SEASON 9: 추락한 별 (폴른스타 크레이터)
  // =========================
  s9_ep01: {
    id: 's9_ep01',
    chapterNumber: 82,
    title: '[S9] EP01 별이 떨어진 자리',
    description:
      '하늘에서 별이 떨어지고, 크레이터가 생긴다. 아홉 번째 문은 “우주”의 틈이다. 월드보스가 주기적으로 깨어난다.',
    requiredLevel: 50,
    requiredQuests: ['s8_ep09'],
    startNpc: 'NPC_GUARD_CAPTAIN',
    startRoomId: 'GH_GATE',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['밤이 낮처럼 밝아진다.', '땅이 유리처럼 녹는다.', '별빛이 검게 변한다.'],
  },
  s9_ep02: {
    id: 's9_ep02',
    chapterNumber: 83,
    title: '[S9] EP02 별가루 질병',
    description:
      '별가루가 사람의 정신을 갉는다. 던전도, 시장도, 길드도—전염된다. 치료는 곧 시즌 루프가 된다.',
    requiredLevel: 50,
    requiredQuests: ['s9_ep01'],
    startNpc: 'NPC_INNKEEPER',
    startRoomId: 'GH_INN',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['사람들이 꿈에서 깨어나지 못한다.', '꿈속에서만 문이 열린다.', '당신의 반지가 별가루를 끌어당긴다.'],
  },
  s9_ep03: {
    id: 's9_ep03',
    chapterNumber: 84,
    title: '[S9] EP03 사도의 군락',
    description:
      '사도들이 늘어난다. 그들은 공허의 “병사”가 아니라 “전령”이다. 마지막 문이 가까워진다.',
    requiredLevel: 50,
    requiredQuests: ['s9_ep02'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['하늘에 검은 점이 늘어난다.', '"이제 숨길 필요가 없다."', '전령이 웃는다.'],
  },
  s9_ep04: {
    id: 's9_ep04',
    chapterNumber: 85,
    title: '[S9] EP04 크레이터 외곽(Week 1 던전)',
    description:
      '크레이터 외곽은 방사형으로 변형된 지형. 탐색/파티/길드 공유가 강제되는 구간.',
    requiredLevel: 50,
    requiredQuests: ['s9_ep03'],
    startNpc: 'NPC_GUILD_MASTER',
    startRoomId: 'GH_GUILDHALL',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['길이 계속 바뀐다.', '지도는 무력해진다.', '소문이 곧 길이다.'],
  },
  s9_ep05: {
    id: 's9_ep05',
    chapterNumber: 86,
    title: '[S9] EP05 별철(Week 2 티어업)',
    description:
      '별철은 현실의 재료가 아니다. 그러나 장비 티어를 한 단계 끌어올린다. 강화/제작이 시즌의 핵심.',
    requiredLevel: 50,
    requiredQuests: ['s9_ep04'],
    startNpc: 'NPC_BLACKSMITH',
    startRoomId: 'GH_BLACKSMITH',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['금속이 아니라 빛을 두드린다.', '"이건 별의 뼈야."', '망치가 울 때 하늘이 울린다.'],
  },
  s9_ep06: {
    id: 's9_ep06',
    chapterNumber: 87,
    title: '[S9] EP06 크레이터 심부(Week 2 던전)',
    description:
      '심부에선 중력이 비뚤어진다. 전투 규칙이 흔들린다. 공허가 “현실”을 삼키기 시작한다.',
    requiredLevel: 50,
    requiredQuests: ['s9_ep05'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['바닥이 벽이 된다.', '스킬이 뒤집힌다.', '당신의 반지가 한 번 더 “문”을 그린다.'],
  },
  s9_ep07: {
    id: 's9_ep07',
    chapterNumber: 88,
    title: '[S9] EP07 별의 증언(Week 3 어튜먼트)',
    description:
      '아홉 번째 문은 “별의 증언”을 요구한다. 증언은 유물 조각 9개로 완성된다(주간 루프).',
    requiredLevel: 50,
    requiredQuests: ['s9_ep06'],
    startNpc: 'NPC_FOUNDATION_OFFICER',
    startRoomId: 'GH_MARKET',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['조각이 맞춰질 때마다 하늘이 갈라진다.', '증언은 빛이 아니라 문장이다.', '문장이 당신을 부른다.'],
  },
  s9_ep08: {
    id: 's9_ep08',
    chapterNumber: 89,
    title: '[S9] EP08 공허의 전령, 마지막 열쇠(레이드 전야)',
    description:
      '전령이 마지막 열쇠를 가진다. 그 열쇠는 “봉인석 9개를 한 줄로 잇는 규칙”이다.',
    requiredLevel: 50,
    requiredQuests: ['s9_ep07'],
    startNpc: 'NPC_MYSTERIOUS_WOMAN',
    startRoomId: 'GH_INN',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['리아가 고개를 든다.', '"이제 끝을 봐야 해."', '전령이 박수 친다.'],
  },
  s9_ep09: {
    id: 's9_ep09',
    chapterNumber: 90,
    title: '[S9] EP09 봉인 9/10: 추락성 “폴른스타”',
    description:
      '아홉 번째 문 앞, “폴른스타”는 우주를 삼킨다. 봉인 9개가 정렬되고, 마지막 문이 모습을 드러낸다.',
    requiredLevel: 50,
    requiredQuests: ['s9_ep08'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0, unlocksFeature: 'SEASON_9_COMPLETE' },
    cinematicText: ['별이 검게 탄다.', '"마지막 문."', '당신의 반지가 10번째 선을 그린다.'],
  },

  // =========================
  // SEASON 10: 무의 왕좌 (마지막 문)
  // =========================
  s10_ep01: {
    id: 's10_ep01',
    chapterNumber: 91,
    title: '[S10] EP01 마지막 문의 좌표',
    description:
      '마지막 문은 “장소”가 아니다. 조건이 맞춰진 순간, 어디서든 열린다. 당신의 선택이 좌표가 된다.',
    requiredLevel: 50,
    requiredQuests: ['s9_ep09'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['지도에서 마지막 점이 사라진다.', '"좌표는 네 안에 있다."', '반지가 공허를 향해 울린다.'],
  },
  s10_ep02: {
    id: 's10_ep02',
    chapterNumber: 92,
    title: '[S10] EP02 문지기의 회수',
    description:
      '공허는 문지기를 회수하려 한다. 문지기는 도구였다. 그리고 너는—그 도구였던 적이 있다.',
    requiredLevel: 50,
    requiredQuests: ['s10_ep01'],
    startNpc: 'NPC_MYSTERIOUS_WOMAN',
    startRoomId: 'GH_INN',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['리아가 말한다: "미안해."', '기억이 돌아온다.', '돌아온 기억이 칼이 된다.'],
  },
  s10_ep03: {
    id: 's10_ep03',
    chapterNumber: 93,
    title: '[S10] EP03 세력의 최후 협정',
    description:
      '질서/재단/잿불—모든 세력이 마지막 협정을 들고 온다. 협정은 곧 결말의 분기다.',
    requiredLevel: 50,
    requiredQuests: ['s10_ep02'],
    startNpc: 'NPC_GUILD_MASTER',
    startRoomId: 'GH_GUILDHALL',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['협정서가 테이블 위에 놓인다.', '서명은 전쟁보다 무겁다.', '당신의 손이 떤다.'],
  },
  s10_ep04: {
    id: 's10_ep04',
    chapterNumber: 94,
    title: '[S10] EP04 공허의 전초(Week 1 던전)',
    description:
      '공허가 현실에 박은 전초. 전투 규칙이 붕괴한다. 지금까지의 빌드가 시험대에 오른다.',
    requiredLevel: 50,
    requiredQuests: ['s10_ep03'],
    startNpc: 'NPC_GUARD_CAPTAIN',
    startRoomId: 'GH_GATE',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['빛이 먹힌다.', '소리가 사라진다.', '스킬이 공허에 닿아 찢어진다.'],
  },
  s10_ep05: {
    id: 's10_ep05',
    chapterNumber: 95,
    title: '[S10] EP05 규칙 재작성(Week 2)',
    description:
      '여기서부터는 “싸움”이 아니라 “규칙”의 싸움. 제작/강화/경제/세력 선택이 전부 결말로 들어간다.',
    requiredLevel: 50,
    requiredQuests: ['s10_ep04'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['룬이 하늘에 떠오른다.', '"다시 써."', '당신이 문장을 만든다.'],
  },
  s10_ep06: {
    id: 's10_ep06',
    chapterNumber: 96,
    title: '[S10] EP06 무의 회랑(Week 2 던전)',
    description:
      '무의 회랑에선 보상이 없다. 오직 “남는 것”만 있다. 남는 것이 곧 너다.',
    requiredLevel: 50,
    requiredQuests: ['s10_ep05'],
    startNpc: 'NPC_MYSTERIOUS_WOMAN',
    startRoomId: 'GH_INN',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['텅 빈 방이 끝없이 이어진다.', '"포기해."', '포기하지 않는 자만이 앞으로 간다.'],
  },
  s10_ep07: {
    id: 's10_ep07',
    chapterNumber: 97,
    title: '[S10] EP07 마지막 어튜먼트: 이름을 바칠 것인가',
    description:
      '마지막 문은 “이름”을 요구한다. 너의 이름, 길드의 이름, 세계의 이름. 무엇을 바치면 무엇이 남는가.',
    requiredLevel: 50,
    requiredQuests: ['s10_ep06'],
    startNpc: 'NPC_ELDER',
    startRoomId: 'GH_LEDGER_OFFICE',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['서명란에 잉크가 맺힌다.', '이름을 쓰면 사라진다.', '쓰지 않으면 문이 닫힌다.'],
  },
  s10_ep08: {
    id: 's10_ep08',
    chapterNumber: 98,
    title: '[S10] EP08 왕좌로 가는 문(레이드 전야)',
    description:
      '문이 열린다. 왕좌가 보인다. 공허는 승리를 약속하고, 패배를 위로한다. 둘 다 거짓말일 수 있다.',
    requiredLevel: 50,
    requiredQuests: ['s10_ep07'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0 },
    cinematicText: ['왕좌가 그림자로 떠오른다.', '"어서 와."', '반지가 마지막으로 빛난다.'],
  },
  s10_ep09: {
    id: 's10_ep09',
    chapterNumber: 99,
    title: '[S10] EP09 봉인 10/10: 공허의 왕좌',
    description:
      '최종 결전. 봉인을 강화할 것인가(희생 유지), 재작성할 것인가(규칙 변경), 관리할 것인가(권력화). 선택은 세계를 바꾼다.',
    requiredLevel: 50,
    requiredQuests: ['s10_ep08'],
    startNpc: 'NPC_ARCHMAGE',
    startRoomId: 'GH_APPRAISER',
    rewards: { exp: 0, gold: 0, unlocksFeature: 'SEASON_10_COMPLETE' },
    cinematicText: ['공허가 왕관을 쓴다.', '"문지기여, 네가 내 열쇠다."', '당신이 결말을 쓴다.'],
  },
};

export function getStoryChapter(chapterId: string): StoryChapter | null {
  return MAIN_STORY_CHAPTERS[chapterId] || null;
}

export function getAllStoryChapters(): StoryChapter[] {
  return Object.values(MAIN_STORY_CHAPTERS).sort((a, b) => a.chapterNumber - b.chapterNumber);
}

export function getNextChapter(characterLevel: number, completedChapters: string[]): StoryChapter | null {
  const allChapters = getAllStoryChapters();
  
  for (const chapter of allChapters) {
    if (completedChapters.includes(chapter.id)) continue;
    if (characterLevel < chapter.requiredLevel) continue;
    
    if (chapter.requiredQuests) {
      const hasAllRequiredQuests = chapter.requiredQuests.every((q) => completedChapters.includes(q));
      if (!hasAllRequiredQuests) continue;
    }
    
    return chapter;
  }
  
  return null;
}

