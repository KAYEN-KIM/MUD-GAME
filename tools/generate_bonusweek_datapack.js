#!/usr/bin/env node
/**
 * generate_bonusweek_datapack.js
 * 
 * 시즌 2~10의 보너스주 전용 데이터팩(코스메틱 2종 + 퀘스트 2종)을 자동 생성합니다.
 * 
 * Usage:
 *   pnpm content:gen:bonusweek
 *   또는 node tools/generate_bonusweek_datapack.js
 * 
 * Features:
 *   - Idempotent: 재실행 시 중복 생성하지 않음
 *   - Validation: 필수 필드 검증
 *   - Sorted output: ID 기준 알파벳 정렬
 */

const fs = require('fs');
const path = require('path');

// 프로젝트 루트
const PROJECT_ROOT = path.resolve(__dirname, '..');

// 파일 경로
const CONFIG_PATH = path.join(__dirname, 'bonusweek_config.json');
const ITEMS_PATH = path.join(PROJECT_ROOT, 'apps/server/src/content/items.json');
const QUESTS_PATH = path.join(PROJECT_ROOT, 'apps/server/content/quests.json');

/**
 * JSON 파일 로드
 */
function loadJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`[generate_bonusweek] ERROR: ${label} not found at ${filePath}`);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`[generate_bonusweek] ERROR: Failed to parse ${label}:`, err.message);
    process.exit(1);
  }
}

/**
 * JSON 파일 저장 (pretty print + trailing newline)
 */
function saveJson(filePath, data, label) {
  try {
    const jsonString = JSON.stringify(data, null, 2) + '\n';
    fs.writeFileSync(filePath, jsonString, 'utf8');
    console.log(`[generate_bonusweek] ✓ Saved ${label}`);
  } catch (err) {
    console.error(`[generate_bonusweek] ERROR: Failed to save ${label}:`, err.message);
    process.exit(1);
  }
}

/**
 * 시즌별 아이템 생성 (2개)
 */
function generateSeasonItems(seasonConfig) {
  const { n, theme } = seasonConfig;
  const seasonNum = String(n).padStart(2, '0'); // S02, S03, ...

  return [
    {
      id: `ITEM_ICON_BONUS_S${seasonNum}`,
      name: `보너스 아이콘(S${seasonNum}): ${theme}`,
      type: 'material',
      rarity: 'epic',
      slot: null,
      stackMax: 1,
      atk: 0,
      def: 0,
      hpBonus: 0,
      priceBuy: 0,
      priceSell: 0,
      effectJson: {}
    },
    {
      id: `ITEM_TITLE_BONUS_S${seasonNum}`,
      name: `칭호(S${seasonNum}): ${theme} 러너`,
      type: 'material',
      rarity: 'epic',
      slot: null,
      stackMax: 1,
      atk: 0,
      def: 0,
      hpBonus: 0,
      priceBuy: 0,
      priceSell: 0,
      effectJson: {}
    }
  ];
}

/**
 * 시즌별 퀘스트 생성 (2개)
 */
function generateSeasonQuests(seasonConfig, defaults) {
  const { n, theme, zoneId, wbKill, eliteKill, wbGold, wbExp, eliteGold, eliteExp } = seasonConfig;
  const { potionItemId, potionQty } = defaults;
  const seasonNum = String(n).padStart(2, '0');

  return [
    {
      id: `Q_S${seasonNum}_WB01`,
      title: `[WB] 보너스 주간: ${theme}`,
      description: '보너스 주간 전용 퀘스트입니다. 인장은 지급되지 않습니다.',
      giverRoomId: 'GH_LEDGER_OFFICE',
      turninRoomId: 'GH_LEDGER_OFFICE',
      minLevel: 1,
      repeatable: false,
      objectivesJson: [
        {
          type: 'KILL_IN_ZONE',
          zoneId: zoneId,
          count: wbKill
        }
      ],
      rewardsJson: {
        gold: wbGold,
        exp: wbExp,
        items: [
          { itemId: potionItemId, qty: potionQty },
          { itemId: `ITEM_ICON_BONUS_S${seasonNum}`, qty: 1 }
        ]
      }
    },
    {
      id: `Q_S${seasonNum}_ELITE_01`,
      title: `[ELITE] 보너스 주간: ${theme}`,
      description: '보너스 주간 선택 목표. 파워 인플레는 금지된다.',
      giverRoomId: 'GH_LEDGER_OFFICE',
      turninRoomId: 'GH_LEDGER_OFFICE',
      minLevel: 1,
      repeatable: false,
      objectivesJson: [
        {
          type: 'KILL_IN_ZONE',
          zoneId: zoneId,
          count: eliteKill
        }
      ],
      rewardsJson: {
        gold: eliteGold,
        exp: eliteExp,
        items: [
          { itemId: `ITEM_TITLE_BONUS_S${seasonNum}`, qty: 1 }
        ]
      }
    }
  ];
}

/**
 * Idempotent 병합: 기존 배열에 신규 항목 추가 (중복 시 skip)
 */
function mergeIdempotent(existingArray, newItems, label) {
  const existingIds = new Set(existingArray.map(item => item.id));
  let addedCount = 0;
  let skippedCount = 0;

  newItems.forEach(newItem => {
    if (existingIds.has(newItem.id)) {
      skippedCount++;
    } else {
      existingArray.push(newItem);
      existingIds.add(newItem.id);
      addedCount++;
    }
  });

  console.log(`[generate_bonusweek] ${label}: added=${addedCount}, skipped=${skippedCount}`);
  return { addedCount, skippedCount };
}

/**
 * ID 기준 알파벳 정렬
 */
function sortById(array) {
  return array.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * 메인 실행
 */
function main() {
  console.log('[generate_bonusweek] Starting bonus week datapack generation...\n');

  // 1) Config 로드
  console.log('[generate_bonusweek] Loading config...');
  const config = loadJson(CONFIG_PATH, 'bonusweek_config.json');
  const { seasons, defaults } = config;

  if (!Array.isArray(seasons) || seasons.length === 0) {
    console.error('[generate_bonusweek] ERROR: No seasons found in config');
    process.exit(1);
  }

  console.log(`[generate_bonusweek] Found ${seasons.length} seasons in config`);

  // 2) 기존 content 로드
  console.log('[generate_bonusweek] Loading existing content...');
  const items = loadJson(ITEMS_PATH, 'items.json');
  const quests = loadJson(QUESTS_PATH, 'quests.json');

  if (!Array.isArray(items) || !Array.isArray(quests)) {
    console.error('[generate_bonusweek] ERROR: items.json or quests.json is not an array');
    process.exit(1);
  }

  console.log(`[generate_bonusweek] Existing: ${items.length} items, ${quests.length} quests\n`);

  // 3) 시즌별 데이터 생성 및 병합
  let totalItemsAdded = 0;
  let totalItemsSkipped = 0;
  let totalQuestsAdded = 0;
  let totalQuestsSkipped = 0;

  seasons.forEach(seasonConfig => {
    console.log(`[generate_bonusweek] Processing Season ${seasonConfig.n} (${seasonConfig.theme})...`);

    // 아이템 생성
    const newItems = generateSeasonItems(seasonConfig);
    const itemStats = mergeIdempotent(items, newItems, `  Items (S${String(seasonConfig.n).padStart(2, '0')})`);
    totalItemsAdded += itemStats.addedCount;
    totalItemsSkipped += itemStats.skippedCount;

    // 퀘스트 생성
    const newQuests = generateSeasonQuests(seasonConfig, defaults);
    const questStats = mergeIdempotent(quests, newQuests, `  Quests (S${String(seasonConfig.n).padStart(2, '0')})`);
    totalQuestsAdded += questStats.addedCount;
    totalQuestsSkipped += questStats.skippedCount;

    console.log('');
  });

  // 4) 정렬
  console.log('[generate_bonusweek] Sorting by ID...');
  sortById(items);
  sortById(quests);

  // 5) 저장
  console.log('[generate_bonusweek] Saving files...');
  saveJson(ITEMS_PATH, items, 'items.json');
  saveJson(QUESTS_PATH, quests, 'quests.json');

  // 6) 요약
  console.log('\n[generate_bonusweek] ========== SUMMARY ==========');
  console.log(`[generate_bonusweek] Seasons processed: ${seasons.length}`);
  console.log(`[generate_bonusweek] Items: ${totalItemsAdded} added, ${totalItemsSkipped} skipped`);
  console.log(`[generate_bonusweek] Quests: ${totalQuestsAdded} added, ${totalQuestsSkipped} skipped`);
  console.log(`[generate_bonusweek] Total items: ${items.length}`);
  console.log(`[generate_bonusweek] Total quests: ${quests.length}`);
  console.log('[generate_bonusweek] Done!');
}

main();

