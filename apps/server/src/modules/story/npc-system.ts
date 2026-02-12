// NPC 시스템

export interface NPC {
  id: string;
  name: string;
  title: string;
  roomId: string;
  description: string;
  dialogues: NPCDialogue[];
  quests?: string[];
  shop?: string;
  faction?: string;
}

export interface NPCDialogue {
  id: string;
  condition?: {
    minLevel?: number;
    maxLevel?: number;
    hasQuest?: string;
    completedQuest?: string;
    hasItem?: string;
  };
  text: string[];
  choices?: {
    text: string;
    nextDialogueId?: string;
    action?: {
      type:
        | 'GIVE_QUEST'
        | 'GIVE_ITEM'
        | 'TELEPORT'
        | 'START_CUTSCENE'
        // 기존 코드에서 이미 사용 중인 액션 타입들(타입 안정화)
        | 'SHOP_OPEN'
        | 'REST';
      data: any;
    };
  }[];
}

export const NPCS: Record<string, NPC> = {
  NPC_GUARD_CAPTAIN: {
    id: 'NPC_GUARD_CAPTAIN',
    name: '경비대장 마커스',
    title: '게이트하우스 경비대장',
    roomId: 'GH_GATE',
    description: '경비병들의 리더. 날카로운 눈빛으로 당신을 관찰하고 있다.',
    dialogues: [
      {
        id: 'first_meeting',
        condition: { maxLevel: 1 },
        text: [
          '어이, 당신... 정신이 드나?',
          '이상한 곳에서 쓰러져 있길래 데려왔네.',
          '이름은? 어디서 왔나?',
          '...기억이 없다고? 흠...',
        ],
        choices: [
          {
            text: '도움을 청한다',
            nextDialogueId: 'help_offered',
          },
          {
            text: '혼자 알아서 하겠다',
            nextDialogueId: 'alone',
          },
        ],
      },
      {
        id: 'help_offered',
        text: [
          '좋아, 그럼 마을 경비를 도와주게.',
          '요즘 괴물들이 자주 나타나거든.',
          '도움을 주면 보상도 있을 걸세.',
        ],
        choices: [
          {
            text: '퀘스트를 받는다',
            action: { type: 'GIVE_QUEST', data: { questId: 's1_ep01' } },
          },
        ],
      },
      {
        id: 'after_quest',
        condition: { completedQuest: 'quest_daily_patrol' },
        text: [
          '오, 잘 해냈군!',
          '자네 실력이 괜찮은데?',
          '원로회에서 자네를 찾고 있네.',
        ],
      },
    ],
    quests: ['quest_daily_patrol'],
  },
  NPC_ELDER: {
    id: 'NPC_ELDER',
    name: '원로 세라핀',
    title: '마을 원로회 수장',
    roomId: 'GH_LEDGER_OFFICE',
    description: '지혜로운 눈빛의 노인. 무언가를 알고 있는 것 같다.',
    dialogues: [
      {
        id: 'first_meeting',
        text: [
          '기다리고 있었네, 모험가여.',
          '자네에 대한 소문은 들었네.',
          '우리 마을에 큰 위기가 다가오고 있어.',
          '자네의 도움이 필요하네.',
        ],
        choices: [
          {
            text: '어떤 위기인가요?',
            nextDialogueId: 'explain_crisis',
          },
        ],
      },
      {
        id: 'explain_crisis',
        text: [
          '최근 던전에서 이상한 기운이 감지되고 있네.',
          '고대의 봉인이 약해지고 있는 것 같아.',
          '자네가 조사를 해줄 수 있겠나?',
        ],
        choices: [
          {
            text: '수락한다',
            action: { type: 'GIVE_QUEST', data: { questId: 's1_ep03' } },
          },
          {
            text: '나중에 다시 오겠습니다',
            nextDialogueId: 'first_meeting',
          },
        ],
      },
    ],
    quests: ['s1_ep03'],
  },
  NPC_MYSTERIOUS_WOMAN: {
    id: 'NPC_MYSTERIOUS_WOMAN',
    name: '???',
    title: '정체불명의 여인',
    // NOTE: DB seed 기준 여관 룸 ID는 GH_INN
    roomId: 'GH_INN',
    description: '검은 후드로 얼굴을 가린 여인. 익숙한 느낌이 든다.',
    dialogues: [
      {
        id: 'first_meeting',
        // Season 1 메인라인에 맞춰 조건을 단순화(레벨 10 이상이면 등장)
        condition: { minLevel: 10 },
        text: [
          '드디어 만났군요...',
          '오래 기다렸어요.',
          '당신의 기억... 되찾고 싶지 않나요?',
        ],
        choices: [
          {
            text: '당신은 누구인가요?',
            nextDialogueId: 'reveal_hint',
          },
        ],
      },
      {
        id: 'reveal_hint',
        text: [
          '지금은 말할 수 없어요.',
          '하지만 이건 드릴 수 있죠.',
          '(목걸이를 건넨다)',
          '이게 모든 것의 시작이에요.',
        ],
        choices: [
          {
            text: '목걸이를 받는다',
            action: {
              type: 'GIVE_ITEM',
              data: { itemId: 'ITEM_MYSTERIOUS_PENDANT', qty: 1 },
            },
          },
        ],
      },
    ],
    quests: ['s1_ep05'],
  },
  NPC_GUILD_MASTER: {
    id: 'NPC_GUILD_MASTER',
    name: '케인',
    title: '게이트하우스 길드 마스터',
    // NOTE: DB seed 기준 길드홀 룸 ID는 GH_GUILDHALL
    roomId: 'GH_GUILDHALL',
    description: '길드 홀의 주인. 친절하지만 계산적이며, 이 도시의 “게임”을 잘 안다.',
    dialogues: [
      {
        id: 'greeting',
        condition: { minLevel: 12 },
        text: [
          '어서 와. 혼자서 여기까지 살아남았군.',
          '게이트하우스에선 혼자 오래 못 버텨.',
          '길드, 재단, 그리고 잿불… 어느 쪽이든 선택해야 해.',
        ],
        choices: [
          {
            text: '길드에 대해 묻는다',
            nextDialogueId: 'guild_info',
          },
          {
            text: '일거리를 찾는다',
            action: { type: 'GIVE_QUEST', data: { questId: 's1_ep06' } },
          },
        ],
      },
      {
        id: 'guild_info',
        text: [
          '길드는 사람을 묶고, 사람은 던전을 깨지.',
          '혼자선 운이 필요하고, 여럿이면 실력이 필요해.',
          '너라면… 어느 쪽을 택할래?',
        ],
      },
    ],
    quests: ['s1_ep06'],
  },
  NPC_ARCHMAGE: {
    id: 'NPC_ARCHMAGE',
    name: '마기스터 윤',
    title: '아르카눔 탑 대마기스터',
    // NOTE: 현재 seed 룸 목록에 GH_TOWER가 없을 수 있어, 안전하게 도시 내 존재 룸으로 매핑
    // TODO: 추후 GH_TOWER 룸이 추가되면 원복(또는 새로운 룸 생성)
    roomId: 'GH_APPRAISER',
    description: '룬과 균열을 연구하는 마법사. 봉인의 대가를 알고도 계산한다.',
    dialogues: [
      {
        id: 'intro',
        condition: { minLevel: 20 },
        text: [
          '반지가 널 여기로 끌고 왔나.',
          '룬은 “마력”이 아니라 “선택”으로 안정된다.',
          '네가 가진 공명… 흥미롭군.',
        ],
        choices: [
          {
            text: '룬 시험을 받는다',
            action: { type: 'GIVE_QUEST', data: { questId: 's1_ep09' } },
          },
        ],
      },
      {
        id: 'after',
        condition: { completedQuest: 's1_ep09' },
        text: [
          '좋아. 이제 넌 단순한 모험가가 아니다.',
          '균열은 닫을 수 있다. 하지만… 무엇을 대가로 내걸지?',
        ],
      },
    ],
    quests: ['s1_ep09', 's1_ep16', 's1_ep18'],
  },
  NPC_FOUNDATION_OFFICER: {
    id: 'NPC_FOUNDATION_OFFICER',
    name: '모르트',
    title: '재단 집행관',
    roomId: 'GH_MARKET',
    description: '재단의 질서를 집행한다. 말투는 공손하지만, 모든 것을 “가치”로 환산한다.',
    dialogues: [
      {
        id: 'greeting',
        condition: { minLevel: 26 },
        text: [
          '반지의 주인인가. 흥미롭군.',
          '시장은 거짓말로 굴러가지만, 장부는 거짓말을 싫어하지.',
          '위조 강화석이 돌고 있어. 누가 이득을 보는지… 찾고 싶나?',
        ],
        choices: [
          {
            text: '추적을 수락한다',
            action: { type: 'GIVE_QUEST', data: { questId: 's1_ep11' } },
          },
        ],
      },
    ],
    quests: ['s1_ep11'],
  },
  NPC_BLACKSMITH: {
    id: 'NPC_BLACKSMITH',
    name: '대장장이 볼간',
    title: '마을 대장간',
    // NOTE: DB seed 기준 대장간 룸 ID는 GH_BLACKSMITH
    roomId: 'GH_BLACKSMITH',
    description: '근육질의 드워프 대장장이. 열정적으로 망치를 두드리고 있다.',
    dialogues: [
      {
        id: 'greeting',
        text: [
          '환영하네! 무기가 필요한가?',
          '내 솜씨는 이 지역 최고라네!',
        ],
        choices: [
          {
            text: '상점을 연다',
            action: { type: 'SHOP_OPEN', data: { shopId: 'SHOP_BLACKSMITH' } },
          },
          {
            text: '장비 강화에 대해 묻는다',
            nextDialogueId: 'enhancement_info',
          },
        ],
      },
      {
        id: 'enhancement_info',
        text: [
          '오, 장비 강화에 관심이 있나?',
          '좋은 무기는 강화를 통해 더 강해질 수 있지!',
          '하지만 조심하게. 실패하면 파괴될 수도 있어.',
        ],
      },
    ],
    shop: 'SHOP_BLACKSMITH',
  },
  NPC_INNKEEPER: {
    id: 'NPC_INNKEEPER',
    name: '여관 주인 로지',
    title: '게이트하우스 여관',
    roomId: 'GH_INN',
    description: '친절한 미소의 여관 주인. 항상 소문에 밝다.',
    dialogues: [
      {
        id: 'greeting',
        text: [
          '어서오세요! 피곤하신가요?',
          '따뜻한 식사와 휴식이 필요하시다면 이곳이 최고랍니다!',
        ],
        choices: [
          {
            text: '최근 소문이 있나요?',
            nextDialogueId: 'rumors',
          },
          {
            text: '휴식을 취한다 (무료)',
            action: { type: 'REST', data: {} },
          },
        ],
      },
      {
        id: 'rumors',
        text: [
          '음... 최근에 이상한 일들이 많아요.',
          '밤마다 숲에서 이상한 소리가 들린다는데...',
          '그리고 검은 후드를 쓴 사람들이 마을 주변을 배회한대요.',
          '조심하세요!',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Season 2~10 NPCs (스토리 몰입/대화 트리 확장용)
  //
  // NOTE:
  // - 현재 스토리/퀘스트 완료 연동(completedQuests)은 단계적으로 붙일 예정이라
  //   대화 조건은 "최소 레벨" 중심으로 단순화한다.
  // - 룸 ID는 apps/server/prisma/seed.ts의 실제 룸 ID를 사용한다.
  // ---------------------------------------------------------------------------

  // =========================
  // SEASON 2: 솔트헤이븐(염분의 왕관) - 항구/사제단/무역
  // =========================
  NPC_S2_HARBORMASTER: {
    id: 'NPC_S2_HARBORMASTER',
    name: '유리안',
    title: '부두 항만관리관',
    roomId: 'GH_DOCKS',
    description: '실종된 상선 명단을 들고 초조하게 항구를 바라보는 관리관.',
    dialogues: [
      {
        id: 'greeting',
        condition: { minLevel: 50 },
        text: [
          '배가 또 사라졌습니다. 하루에 한 척씩…',
          '재단은 “보험”을 팔고, 해적은 “통행세”를 올렸죠.',
          '하지만 전… 바다가 무언가를 삼키고 있다고 믿습니다.',
        ],
        choices: [
          { text: '실종선에 대해 더 묻는다', nextDialogueId: 'missing_ships' },
          { text: '염분의 왕관 소문을 묻는다', nextDialogueId: 'salt_crown' },
        ],
      },
      {
        id: 'missing_ships',
        condition: { minLevel: 50 },
        text: [
          '처음엔 해적 짓인 줄 알았죠.',
          '그런데… 항로가 “끊어졌습니다”. 지도 위에서요.',
          '마치 그 구간 자체가 사라진 것처럼.',
        ],
      },
      {
        id: 'salt_crown',
        condition: { minLevel: 50 },
        text: [
          '염분 사제단이 바다를 달래는 성가를 부릅니다.',
          '성가의 가사엔… 이상한 문장이 섞여 있어요.',
          '당신 같은 사람이 필요합니다. 바다가 아니라, “문”을 상대할 사람.',
        ],
        choices: [{ text: '수락한다', action: { type: 'GIVE_QUEST', data: { questId: 's2_ep01' } } }],
      },
    ],
    faction: 'S2_SALTHAVEN',
  },
  NPC_S2_SALT_PRIEST: {
    id: 'NPC_S2_SALT_PRIEST',
    name: '아르논',
    title: '염분 사제',
    roomId: 'GH_TEMPLE',
    description: '소금 향이 나는 향로를 들고 기도하는 사제. 눈빛이 맑지만 무언가를 숨긴다.',
    dialogues: [
      {
        id: 'intro',
        condition: { minLevel: 50 },
        text: [
          '바다는 사람의 약속으로 잠잠해지지 않습니다.',
          '바다는… 문장의 리듬으로 잠잠해지지요.',
          '당신의 반지, 그 문양은 성가의 후렴과 같습니다.',
        ],
        choices: [
          { text: '성가의 뜻을 묻는다', nextDialogueId: 'hymn' },
          { text: '두 번째 문을 묻는다', nextDialogueId: 'second_gate' },
        ],
      },
      {
        id: 'hymn',
        condition: { minLevel: 50 },
        text: [
          '성가는 “달래기”가 아닙니다.',
          '문이 열릴 때, 열리는 방향을 “조율”하는 거죠.',
          '잘못 조율하면… 바다는 배를 삼키고, 사람은 이름을 잃습니다.',
        ],
      },
      {
        id: 'second_gate',
        condition: { minLevel: 50 },
        text: [
          '두 번째 문은 심해에 있지 않습니다.',
          '심해가 두 번째 문입니다.',
          '문은 장소가 아니라 조건… 당신은 이미 그 조건에 가까워졌습니다.',
        ],
      },
    ],
    faction: 'S2_SALTHAVEN',
  },

  // =========================
  // SEASON 3: 아이언우드(철림 전쟁) - 영토/자원/길드전
  // =========================
  NPC_S3_WAR_COMMANDER: {
    id: 'NPC_S3_WAR_COMMANDER',
    name: '브라흐',
    title: '철림 전쟁감독관',
    roomId: 'GH_GUILDHALL',
    description: '지도 위에 깃발을 꽂으며 전선을 계산하는 장교. 길드를 “부대”로 본다.',
    dialogues: [
      {
        id: 'brief',
        condition: { minLevel: 50 },
        text: [
          '철림은 나무가 아니라 무기다.',
          '그리고 세 번째 문은… 영토를 먹는다.',
          '깃발을 꽂는 자가 문을 건드릴 권한을 얻지.',
        ],
        choices: [
          { text: '영토전의 규칙을 묻는다', nextDialogueId: 'rules' },
          { text: '임무를 받는다', action: { type: 'GIVE_QUEST', data: { questId: 's3_ep01' } } },
        ],
      },
      {
        id: 'rules',
        condition: { minLevel: 50 },
        text: [
          '점령은 끝이 아니야. 유지가 전부지.',
          '보급선이 끊기면 깃발은 종이가 된다.',
          '종이가 되는 순간, 문이 웃는다.',
        ],
      },
    ],
    faction: 'S3_IRONWOOD',
  },
  NPC_S3_FOREMAN: {
    id: 'NPC_S3_FOREMAN',
    name: '마에라',
    title: '철림 벌목단 반장',
    roomId: 'GH_BLACKSMITH',
    description: '손에 굳은살이 박힌 기술자. 전쟁이 길어질수록 표정이 무뎌진다.',
    dialogues: [
      {
        id: 'greeting',
        condition: { minLevel: 50 },
        text: [
          '철림은 베면 피처럼 쇳가루가 나와.',
          '그걸 룬각으로 다듬으면… 속도가 생기지.',
          '하지만 속도는 대가를 부른다. 전쟁이든, 사람이든.',
        ],
        choices: [{ text: '룬각에 대해 더 묻는다', nextDialogueId: 'rune_shard' }],
      },
      {
        id: 'rune_shard',
        condition: { minLevel: 50 },
        text: [
          '룬각은 좋은 재료야. 너무 좋아서 문제지.',
          '재단이 끼어들면, 재료가 “규칙”이 된다.',
          '규칙이 되면… 결국 누군가가 죽는다.',
        ],
      },
    ],
    faction: 'S3_IRONWOOD',
  },

  // =========================
  // SEASON 4: 언더크립트(망자의 회계) - 부활/부채/장부
  // =========================
  NPC_S4_MORTICIAN: {
    id: 'NPC_S4_MORTICIAN',
    name: '헤스텔',
    title: '장례 담당자',
    roomId: 'GH_TEMPLE',
    description: '부활의 기도가 아니라, 장례의 문장을 외우는 사람. “부활의 가격”을 안다.',
    dialogues: [
      {
        id: 'intro',
        condition: { minLevel: 50 },
        text: [
          '죽음은 끝이 아니에요.',
          '끝이 아니라… 청구서죠.',
          '언더크립트의 장부엔, 죽은 자의 이름이 이자로 불어납니다.',
        ],
        choices: [{ text: '장부를 묻는다', nextDialogueId: 'ledger' }],
      },
      {
        id: 'ledger',
        condition: { minLevel: 50 },
        text: [
          '누군가는 그 장부를 “관리”라 불러요.',
          '하지만 관리란… 누군가를 계산하겠다는 뜻이죠.',
          '당신이 문을 건드릴수록, 당신도 숫자가 됩니다.',
        ],
      },
    ],
    faction: 'S4_UNDERCRYPT',
  },
  NPC_S4_LEDGER_SCRIBE: {
    id: 'NPC_S4_LEDGER_SCRIBE',
    name: '벨(서기)',
    title: '원장 사무소 서기',
    roomId: 'GH_LEDGER_OFFICE',
    description: '시즌 기록을 정리하는 서기. 장부의 공포를 “서류”로 숨긴다.',
    dialogues: [
      {
        id: 'brief',
        condition: { minLevel: 50 },
        text: [
          '장부가… 스스로 펼쳐집니다.',
          '그리고 어떤 이름들은, 지워도 다시 써져요.',
          '전… 그게 문이라고 생각해요.',
        ],
        choices: [{ text: '서류를 넘겨받는다', action: { type: 'GIVE_QUEST', data: { questId: 's4_ep01' } } }],
      },
    ],
    faction: 'S4_UNDERCRYPT',
  },

  // =========================
  // SEASON 5: 스카이포지(하늘의 단조) - 제작/강화/룬
  // =========================
  NPC_S5_SKYFORGE_EMISSARY: {
    id: 'NPC_S5_SKYFORGE_EMISSARY',
    name: '칼리온',
    title: '스카이포지 특사',
    roomId: 'GH_BLACKSMITH',
    description: '하늘에서 내려온 특사. 장비를 보고 “규칙”을 본다.',
    dialogues: [
      {
        id: 'intro',
        condition: { minLevel: 50 },
        text: [
          '강화는 숫자 놀이가 아닙니다.',
          '강화는… 규칙을 새기는 행위죠.',
          '다섯 번째 문은 “완성된 장비”를 요구합니다.',
        ],
        choices: [{ text: '스카이포지에 대해 묻는다', nextDialogueId: 'about' }],
      },
      {
        id: 'about',
        condition: { minLevel: 50 },
        text: [
          '스카이포지는 하늘에 매달린 단조장이 아닙니다.',
          '문과 이어진 단조장입니다.',
          '당신의 룬 슬롯… 이미 문을 향해 열려 있군요.',
        ],
      },
    ],
    faction: 'S5_SKYFORGE',
  },
  NPC_S5_RUNESMITH: {
    id: 'NPC_S5_RUNESMITH',
    name: '세이렌',
    title: '룬 세공사',
    roomId: 'GH_APPRAISER',
    description: '감정소 구석에서 룬을 쪼개고 이어붙이는 세공사. “빈칸의 대가”를 경고한다.',
    dialogues: [
      {
        id: 'warn',
        condition: { minLevel: 50 },
        text: [
          '룬 슬롯은 빈칸이 아니야.',
          '빈칸은… 무엇이든 먹지.',
          '특히 기억을.',
        ],
        choices: [{ text: '대가를 감수한다', action: { type: 'GIVE_QUEST', data: { questId: 's5_ep02' } } }],
      },
    ],
    faction: 'S5_SKYFORGE',
  },

  // =========================
  // SEASON 6: 미러스(거울바다) - 분기/평행/정체성
  // =========================
  NPC_S6_MIRROR_TRADER: {
    id: 'NPC_S6_MIRROR_TRADER',
    name: '도브',
    title: '거울바다 상인',
    roomId: 'GH_MARKET',
    description: '정체를 알 수 없는 상인. 같은 물건을 두 번 팔지 않는다.',
    dialogues: [
      {
        id: 'intro',
        condition: { minLevel: 50 },
        text: [
          '이건 다른 세계에서 온 재료야.',
          '희귀가 아니라… 유출이지.',
          '선택이 갈라진 자리에서 흘러나온 것.',
        ],
        choices: [{ text: '선택이 갈라진 자리?', nextDialogueId: 'choice' }],
      },
      {
        id: 'choice',
        condition: { minLevel: 50 },
        text: [
          '네가 했던 선택들 중… 기록에서 지워진 게 있지?',
          '누군가 선택을 훔치고 있어.',
          '그리고 여섯 번째 문은 그 훔친 선택으로 열린다.',
        ],
      },
    ],
    faction: 'S6_MIRRUS',
  },
  NPC_S6_REFLECTION: {
    id: 'NPC_S6_REFLECTION',
    name: '거울 속의 너',
    title: '반사된 무명자',
    roomId: 'GH_INN',
    description: '거울에 비친 형상. 말이 없는데도, 대화가 된다.',
    dialogues: [
      {
        id: 'speak',
        condition: { minLevel: 50 },
        text: [
          '…',
          '"난 너다."',
          '"네가 버린 선택의 합."',
        ],
        choices: [{ text: '더 듣는다', nextDialogueId: 'more' }],
      },
      {
        id: 'more',
        condition: { minLevel: 50 },
        text: [
          '"네 이름은, 아직 여기 있다."',
          '"하지만 말을 꺼내면… 또 잃어."',
          '"그래도 듣고 싶어?"',
        ],
      },
    ],
    faction: 'S6_MIRRUS',
  },

  // =========================
  // SEASON 7: 투기장(핏빛 달) - PvP/명성/칭호
  // =========================
  NPC_S7_ARENA_PROMOTER: {
    id: 'NPC_S7_ARENA_PROMOTER',
    name: '라즈',
    title: '투기장 흥행사',
    roomId: 'GH_GUILDHALL',
    description: '사람을 “콘텐츠”로 만드는 자. 웃음이 가볍다.',
    dialogues: [
      {
        id: 'pitch',
        condition: { minLevel: 50 },
        text: [
          '랭크가 열렸어! 칭호가 붙고, 이름이 팔리지.',
          '너 같은 사람은 금방 유명해질 거야.',
          '근데… 유명해지면 표적도 생긴다는 거, 알지?',
        ],
        choices: [{ text: '투기장 소문을 듣는다', nextDialogueId: 'rumor' }],
      },
      {
        id: 'rumor',
        condition: { minLevel: 50 },
        text: [
          '사도가 나타났대. 패배자의 기억을 먹는다고.',
          '관중은 환호하고… 환호는 제물이 되고.',
          '딱 머드답지 않아?',
        ],
      },
    ],
    faction: 'S7_ARENA',
  },
  NPC_S7_BOOKMAKER: {
    id: 'NPC_S7_BOOKMAKER',
    name: '핀치',
    title: '배당 책정자',
    roomId: 'GH_SLUMS',
    description: '빈민가 골목에서 배당표를 돌리는 자. 정보에 돈을 걸게 만든다.',
    dialogues: [
      {
        id: 'odds',
        condition: { minLevel: 50 },
        text: [
          '승부엔 배당이 붙지. 배당엔 피가 붙고.',
          '랭크는 진짜 실력이 아니라… “관리”야.',
          '관리하는 자가 누구냐고? 재단… 혹은 문.',
        ],
      },
    ],
    faction: 'S7_ARENA',
  },

  // =========================
  // SEASON 8: 클록생텀(시계장치 성역) - 시간/루프/퍼즐
  // =========================
  NPC_S8_CLOCKKEEPER: {
    id: 'NPC_S8_CLOCKKEEPER',
    name: '오르도',
    title: '시계지기',
    roomId: 'GH_APPRAISER',
    description: '초침 소리를 들을 수 있다고 말하는 노인. 시간을 “재료”로 다룬다.',
    dialogues: [
      {
        id: 'intro',
        condition: { minLevel: 50 },
        text: [
          '종이 울리지 않지.',
          '그건 네가 시간을 빚졌기 때문이야.',
          '되감기? 좋아. 하지만 빚은 남는다.',
        ],
      },
    ],
    faction: 'S8_CLOCKSANCTUM',
  },
  NPC_S8_LOOP_SCHOLAR: {
    id: 'NPC_S8_LOOP_SCHOLAR',
    name: '에르',
    title: '루프 연구자',
    roomId: 'GH_LEDGER_OFFICE',
    description: '되감은 기록을 수집한다. 실패 로그를 “승리”로 만든다.',
    dialogues: [
      {
        id: 'brief',
        condition: { minLevel: 50 },
        text: [
          '퍼즐의 정답은 하나가 아니야.',
          '하지만 기록은 하나로 수렴하지.',
          '네가 남긴 실패가… 다른 누군가의 길이 돼.',
        ],
      },
    ],
    faction: 'S8_CLOCKSANCTUM',
  },

  // =========================
  // SEASON 9: 폴른스타(추락한 별) - 월드보스/협동/질병
  // =========================
  NPC_S9_STAR_HEALER: {
    id: 'NPC_S9_STAR_HEALER',
    name: '미라',
    title: '별가루 치유사',
    roomId: 'GH_TEMPLE',
    description: '별가루 질병을 다루는 치유사. 치료는 곧 시즌의 루프가 된다.',
    dialogues: [
      {
        id: 'intro',
        condition: { minLevel: 50 },
        text: [
          '별가루는 상처가 아니라… 질문이에요.',
          '사람의 꿈을 깨우고, 꿈속에서 문을 열죠.',
          '치료하려면 협동이 필요해요. 혼자선 못 막아요.',
        ],
      },
    ],
    faction: 'S9_FALLENSTAR',
  },
  NPC_S9_CRATER_SCOUT: {
    id: 'NPC_S9_CRATER_SCOUT',
    name: '케스트',
    title: '크레이터 정찰병',
    roomId: 'GH_RIFT_OUTPOST',
    description: '크레이터 외곽 지도를 들고 있다. 하지만 지도는 매번 틀린다.',
    dialogues: [
      {
        id: 'brief',
        condition: { minLevel: 50 },
        text: [
          '길이 바뀝니다. 지도는 무력해요.',
          '소문이 길이 됩니다. 길드가 공유하지 않으면 전멸합니다.',
          '…그리고 전령들이 늘어나고 있어요.',
        ],
      },
    ],
    faction: 'S9_FALLENSTAR',
  },

  // =========================
  // SEASON 10: 마지막 문 - 최후 협정/결말
  // =========================
  NPC_S10_ORDER_ENVOY: {
    id: 'NPC_S10_ORDER_ENVOY',
    name: '알렌',
    title: '질서의 사절',
    roomId: 'GH_GATE',
    description: '성문 아래에서 협정서를 들고 기다린다. “안정”을 약속한다.',
    dialogues: [
      {
        id: 'offer',
        condition: { minLevel: 50 },
        text: [
          '봉인을 강화하면, 세계는 안정됩니다.',
          '희생은 계속되겠지만… 우리는 살아남죠.',
          '당신은 문지기. 당신의 결정을 사람들은 따를 겁니다.',
        ],
      },
    ],
    faction: 'S10_FINAL',
  },
  NPC_S10_EMBER_ENVOY: {
    id: 'NPC_S10_EMBER_ENVOY',
    name: '리아',
    title: '잿불의 사절',
    roomId: 'GH_INN',
    description: '처음부터 당신을 지켜본 여인. 이제는 숨기지 않는다.',
    dialogues: [
      {
        id: 'offer',
        condition: { minLevel: 50 },
        text: [
          '희생 없이도 봉인은 유지될 수 있어.',
          '규칙을 다시 쓰면 돼. 위험하겠지.',
          '그래도… 누군가는 그 위험을 감수해야 해.',
        ],
      },
    ],
    faction: 'S10_FINAL',
  },
  NPC_S10_FOUNDATION_ENVOY: {
    id: 'NPC_S10_FOUNDATION_ENVOY',
    name: '모르트',
    title: '재단의 최후 집행관',
    roomId: 'GH_MARKET',
    description: '마지막까지 장부를 든다. “관리”는 권력이자 책임이라 말한다.',
    dialogues: [
      {
        id: 'offer',
        condition: { minLevel: 50 },
        text: [
          '강화도 재작성도… 결국 누군가가 관리해야 합니다.',
          '관리 없는 이상은, 피로 끝나죠.',
          '재단은 그 피를… 숫자로 바꿉니다.',
        ],
      },
    ],
    faction: 'S10_FINAL',
  },
};

export function getNPC(npcId: string): NPC | null {
  return NPCS[npcId] || null;
}

export function getNPCsInRoom(roomId: string): NPC[] {
  return Object.values(NPCS).filter((npc) => npc.roomId === roomId);
}

export function getNPCDialogue(
  npcId: string,
  characterLevel: number,
  completedQuests: string[],
  inventory: string[],
): NPCDialogue | null {
  const npc = getNPC(npcId);
  if (!npc) return null;

  for (const dialogue of npc.dialogues) {
    if (!dialogue.condition) return dialogue;

    const cond = dialogue.condition;
    if (cond.minLevel && characterLevel < cond.minLevel) continue;
    if (cond.maxLevel && characterLevel > cond.maxLevel) continue;
    if (cond.completedQuest && !completedQuests.includes(cond.completedQuest)) continue;
    if (cond.hasItem && !inventory.includes(cond.hasItem)) continue;

    return dialogue;
  }

  return npc.dialogues[0] || null;
}

