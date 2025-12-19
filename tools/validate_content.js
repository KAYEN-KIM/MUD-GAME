#!/usr/bin/env node
/**
 * validate_content.js v2
 * 
 * Enhanced content integrity validation with deep scanning
 * 
 * Usage:
 *   pnpm content:validate
 *   또는 node tools/validate_content.js
 * 
 * Checks (v2):
 *   - Items/Quests/Shops: ID uniqueness
 *   - Deep scan: ALL itemId references (rewards, costs, objectives, etc.)
 *   - Deep scan: ALL roomId references (giver, turnin, toRoomId, etc.)
 *   - Reference integrity across all content files
 * 
 * Exit codes:
 *   0 = PASS (no validation errors)
 *   1 = FAIL (validation errors found)
 */

const fs = require('fs');
const path = require('path');

// 프로젝트 루트
const PROJECT_ROOT = path.resolve(__dirname, '..');

// 파일 경로 후보 (순서대로 확인)
const FILE_CANDIDATES = {
  items: [
    'apps/server/src/content/items.json',
    'apps/server/content/items.json',
  ],
  quests: [
    'apps/server/content/quests.json',
    'apps/server/src/content/quests.json',
  ],
  rooms: [
    'apps/server/src/content/rooms.json',
    'apps/server/content/rooms.json',
  ],
  shops: [
    'apps/server/content/shops.json',
    'apps/server/src/content/shops.json',
  ],
  monsters: [
    'apps/server/src/content/monsters.json',
    'apps/server/content/monsters.json',
  ],
  bossSpawns: [
    'apps/server/content/boss_spawns.json',
    'apps/server/src/content/boss_spawns.json',
  ],
};

/**
 * 파일 찾기 (후보 목록에서 첫 번째 존재하는 파일)
 */
function findFile(candidates, label) {
  for (const candidate of candidates) {
    const fullPath = path.join(PROJECT_ROOT, candidate);
    if (fs.existsSync(fullPath)) {
      console.log(`[validate_content] Found ${label}: ${candidate}`);
      return fullPath;
    }
  }
  return null;
}

/**
 * JSON 파일 로드 (optional)
 */
function loadJsonOptional(filePath, label) {
  if (!filePath) {
    console.log(`[validate_content] ⚠️  ${label} not found (skipping related checks)`);
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`[validate_content] ERROR: Failed to parse ${label}:`, err.message);
    process.exit(1);
  }
}

/**
 * ID 중복 검사
 */
function checkDuplicateIds(array, label) {
  if (!array) return { pass: true, issues: [] };

  console.log(`[validate_content] Checking ${label} for duplicate IDs...`);
  
  const idMap = new Map();
  const issues = [];

  array.forEach((item, index) => {
    const id = item.id;
    if (!id) {
      const issue = `Missing 'id' field at index ${index}`;
      console.error(`[validate_content]   ERROR: ${issue}`);
      issues.push(issue);
      return;
    }

    if (idMap.has(id)) {
      const firstIndex = idMap.get(id);
      const issue = `Duplicate ID '${id}' at indices ${firstIndex} and ${index}`;
      console.error(`[validate_content]   ERROR: ${issue}`);
      issues.push(issue);
    } else {
      idMap.set(id, index);
    }
  });

  if (issues.length > 0) {
    console.error(`[validate_content]   ❌ Found ${issues.length} duplicate ID(s) in ${label}`);
    return { pass: false, issues };
  }

  console.log(`[validate_content]   ✓ No duplicate IDs in ${label} (${idMap.size} unique)`);
  return { pass: true, issues: [] };
}

/**
 * 재귀적으로 객체/배열을 순회하며 itemId 참조 추출
 */
function extractItemRefs(obj, path = '', refs = []) {
  if (typeof obj !== 'object' || obj === null) {
    return refs;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      extractItemRefs(item, `${path}[${index}]`, refs);
    });
  } else {
    for (const [key, value] of Object.entries(obj)) {
      const newPath = path ? `${path}.${key}` : key;

      // itemId 참조 패턴 감지
      if (key === 'itemId' || key === 'itemIds') {
        if (typeof value === 'string' && value.startsWith('ITEM_')) {
          refs.push({ path: newPath, itemId: value });
        } else if (Array.isArray(value)) {
          value.forEach((id, idx) => {
            if (typeof id === 'string' && id.startsWith('ITEM_')) {
              refs.push({ path: `${newPath}[${idx}]`, itemId: id });
            }
          });
        }
      }
      // 재귀 탐색
      else if (typeof value === 'object') {
        extractItemRefs(value, newPath, refs);
      }
    }
  }

  return refs;
}

/**
 * 재귀적으로 객체/배열을 순회하며 roomId 참조 추출
 */
function extractRoomRefs(obj, path = '', refs = []) {
  if (typeof obj !== 'object' || obj === null) {
    return refs;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      extractRoomRefs(item, `${path}[${index}]`, refs);
    });
  } else {
    for (const [key, value] of Object.entries(obj)) {
      const newPath = path ? `${path}.${key}` : key;

      // roomId 참조 패턴 감지
      if (key === 'roomId' || key === 'toRoomId' || key === 'giverRoomId' || 
          key === 'turninRoomId' || key === 'currentRoomId' || key.endsWith('RoomId')) {
        if (typeof value === 'string') {
          refs.push({ path: newPath, roomId: value });
        }
      }
      // 재귀 탐색
      else if (typeof value === 'object') {
        extractRoomRefs(value, newPath, refs);
      }
    }
  }

  return refs;
}

/**
 * Deep scan: itemId 참조 검증
 */
function checkItemReferences(documents, itemIds, label) {
  if (!documents) return { pass: true, issues: [] };

  console.log(`[validate_content] Deep scanning ${label} for itemId references...`);

  const issues = [];

  documents.forEach((doc) => {
    const refs = extractItemRefs(doc, doc.id || 'unknown');
    
    refs.forEach(({ path, itemId }) => {
      if (!itemIds.has(itemId)) {
        const issue = `${label} '${doc.id}' at ${path}: references non-existent item '${itemId}'`;
        console.error(`[validate_content]   ERROR: ${issue}`);
        issues.push(issue);
      }
    });
  });

  if (issues.length > 0) {
    console.error(`[validate_content]   ❌ Found ${issues.length} missing itemId reference(s) in ${label}`);
    return { pass: false, issues };
  }

  console.log(`[validate_content]   ✓ All itemId references valid in ${label}`);
  return { pass: true, issues: [] };
}

/**
 * Deep scan: roomId 참조 검증
 */
function checkRoomReferences(documents, roomIds, label) {
  if (!documents || !roomIds) return { pass: true, issues: [] };

  console.log(`[validate_content] Deep scanning ${label} for roomId references...`);

  const issues = [];

  documents.forEach((doc) => {
    const refs = extractRoomRefs(doc, doc.id || 'unknown');
    
    refs.forEach(({ path, roomId }) => {
      if (!roomIds.has(roomId)) {
        const issue = `${label} '${doc.id}' at ${path}: references non-existent room '${roomId}'`;
        console.error(`[validate_content]   ERROR: ${issue}`);
        issues.push(issue);
      }
    });
  });

  if (issues.length > 0) {
    console.error(`[validate_content]   ❌ Found ${issues.length} missing roomId reference(s) in ${label}`);
    return { pass: false, issues };
  }

  console.log(`[validate_content]   ✓ All roomId references valid in ${label}`);
  return { pass: true, issues: [] };
}

/**
 * Exit 무결성 검사 (rooms.json exits 필드 또는 seed.ts 기반)
 */
function checkExitIntegrity(rooms, roomIds) {
  if (!rooms || !roomIds) return { pass: true, issues: [] };

  console.log('[validate_content] Checking exit integrity (from/to room existence)...');
  
  const issues = [];
  let totalExits = 0;
  let roomsWithExits = 0;

  rooms.forEach((room, roomIndex) => {
    if (!room.exits || !Array.isArray(room.exits) || room.exits.length === 0) {
      return; // exits 필드 없으면 스킵
    }

    roomsWithExits++;

    room.exits.forEach((exit, exitIndex) => {
      totalExits++;
      const fromRoomId = room.id;
      const toRoomId = exit.toRoomId;

      // fromRoomId 검증 (이미 roomIds에 있어야 함)
      if (!roomIds.has(fromRoomId)) {
        const issue = `rooms[${roomIndex}].exits[${exitIndex}]: fromRoomId="${fromRoomId}" not in rooms set`;
        console.error(`[validate_content]   ERROR: ${issue}`);
        issues.push(issue);
      }

      // toRoomId 검증
      if (!toRoomId) {
        const issue = `rooms[${roomIndex}].exits[${exitIndex}]: missing toRoomId`;
        console.error(`[validate_content]   ERROR: ${issue}`);
        issues.push(issue);
      } else if (!roomIds.has(toRoomId)) {
        const issue = `rooms[${roomIndex}].exits[${exitIndex}]: toRoomId="${toRoomId}" references non-existent room`;
        console.error(`[validate_content]   ERROR: ${issue}`);
        issues.push(issue);
      }
    });
  });

  if (roomsWithExits === 0) {
    console.log(`[validate_content]   ⚠️  No rooms have exits field (exits may be managed in seed.ts)`);
    console.log(`[validate_content]   ℹ️  Skipping exit integrity check\n`);
    return { pass: true, issues: [] };
  }

  const pass = issues.length === 0;
  if (pass) {
    console.log(`[validate_content]   ✓ All ${totalExits} exits are valid (${roomsWithExits} rooms)\n`);
  } else {
    console.error(`[validate_content]   ❌ Found ${issues.length} broken exit(s)\n`);
  }

  return { pass, issues };
}

/**
 * 필수 경로 검사 (Required Paths - BFS 연결성)
 * Note: rooms.json에 exits가 없으면 스킵 (seed.ts에서만 관리하는 경우)
 */
function checkRequiredPaths(rooms, roomIds) {
  if (!rooms || !roomIds) return { pass: true, issues: [] };

  console.log('[validate_content] Checking required paths (connectivity via BFS)...');
  
  // 1. adjacency list 구축
  const adjacency = new Map();
  let roomsWithExits = 0;
  
  rooms.forEach(room => {
    if (!room.exits || !Array.isArray(room.exits) || room.exits.length === 0) return;
    
    roomsWithExits++;
    
    if (!adjacency.has(room.id)) {
      adjacency.set(room.id, []);
    }
    
    room.exits.forEach(exit => {
      if (exit.toRoomId && roomIds.has(exit.toRoomId)) {
        adjacency.get(room.id).push(exit.toRoomId);
      }
    });
  });

  // exits가 없으면 스킵
  if (roomsWithExits === 0) {
    console.log(`[validate_content]   ⚠️  No rooms have exits field (exits may be managed in seed.ts)`);
    console.log(`[validate_content]   ℹ️  Skipping required paths check\n`);
    return { pass: true, issues: [] };
  }

  // 2. BFS reachability 함수
  function isReachable(start, target) {
    if (start === target) return true;
    if (!adjacency.has(start)) return false;

    const visited = new Set();
    const queue = [start];
    visited.add(start);

    while (queue.length > 0) {
      const current = queue.shift();
      
      const neighbors = adjacency.get(current) || [];
      for (const neighbor of neighbors) {
        if (neighbor === target) return true;
        
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    return false;
  }

  // 3. 필수 경로 정의
  const REQUIRED_PATHS = [
    ['START_TOWN', 'GH_SLUMS'],
    ['GH_SLUMS', 'GH_GATE'],
    ['GH_GATE', 'GH_RIFT_OUTPOST'],
    ['GH_RIFT_OUTPOST', 'R1_00'],
    ['R1_00', 'R1_BOSS_RESIDUE'],
    ['START_TOWN', 'GH_GATE'], // 직접 연결
    ['START_TOWN', 'R1_00'], // 직접 연결
  ];

  // 4. 검증
  const issues = [];

  REQUIRED_PATHS.forEach(([start, target]) => {
    if (!roomIds.has(start)) {
      const issue = `Required path start room "${start}" does not exist`;
      console.error(`[validate_content]   ERROR: ${issue}`);
      issues.push(issue);
      return;
    }

    if (!roomIds.has(target)) {
      const issue = `Required path target room "${target}" does not exist`;
      console.error(`[validate_content]   ERROR: ${issue}`);
      issues.push(issue);
      return;
    }

    const reachable = isReachable(start, target);
    if (!reachable) {
      const issue = `Required path MISSING: ${start} -> ${target}`;
      console.error(`[validate_content]   ERROR: ${issue}`);
      issues.push(issue);
    } else {
      console.log(`[validate_content]   ✓ ${start} -> ${target}`);
    }
  });

  const pass = issues.length === 0;
  if (pass) {
    console.log(`[validate_content]   ✓ All ${REQUIRED_PATHS.length} required paths are connected\n`);
  } else {
    console.error(`[validate_content]   ❌ Found ${issues.length} missing required path(s)\n`);
  }

  return { pass, issues };
}

/**
 * boss_spawns.json 검증 (roomId, bossId, rewardItemsGuaranteed 참조)
 */
function checkBossSpawns(spawns, roomIds, monsterIds, itemIds) {
  console.log('[validate_content] Checking boss_spawns.json references...');
  
  const issues = [];

  spawns.forEach((spawn, index) => {
    // roomId 참조 검증
    if (spawn.roomId && roomIds && !roomIds.has(spawn.roomId)) {
      const issue = `boss_spawns[${index}].roomId="${spawn.roomId}" references non-existent room`;
      console.error(`[validate_content]   ERROR: ${issue}`);
      issues.push(issue);
    }

    // bossId 참조 검증
    if (spawn.bossId && monsterIds && !monsterIds.has(spawn.bossId)) {
      const issue = `boss_spawns[${index}].bossId="${spawn.bossId}" references non-existent monster`;
      console.error(`[validate_content]   ERROR: ${issue}`);
      issues.push(issue);
    }

    // rewardItemsGuaranteed 참조 검증
    if (spawn.rewardItemsGuaranteed && Array.isArray(spawn.rewardItemsGuaranteed)) {
      spawn.rewardItemsGuaranteed.forEach((rewardItem, rewardIndex) => {
        if (rewardItem.itemId && itemIds && !itemIds.has(rewardItem.itemId)) {
          const issue = `boss_spawns[${index}].rewardItemsGuaranteed[${rewardIndex}].itemId="${rewardItem.itemId}" references non-existent item`;
          console.error(`[validate_content]   ERROR: ${issue}`);
          issues.push(issue);
        }
      });
    }
  });

  const pass = issues.length === 0;
  if (pass) {
    console.log(`[validate_content]   ✓ All ${spawns.length} boss spawn references are valid\n`);
  } else {
    console.error(`[validate_content]   ❌ Found ${issues.length} invalid boss spawn reference(s)\n`);
  }

  return { pass, issues };
}

/**
 * 코어 상점 비우기 금지 체크 (루프 회귀 방지)
 */
function checkCoreShopsNotEmpty(shops) {
  console.log('[validate_content] Checking core shops are not empty...');
  
  const NON_EMPTY_SHOP_IDS = [
    'SHOP_S1_LEDGER_EXCHANGE', // S1 인장 교환소 (코어 진행 상점)
  ];

  const issues = [];

  NON_EMPTY_SHOP_IDS.forEach(shopId => {
    const shop = shops.find(s => s.id === shopId);
    if (!shop) {
      const issue = `Core shop '${shopId}' not found in shops.json`;
      console.error(`[validate_content]   ERROR: ${issue}`);
      issues.push(issue);
      return;
    }

    if (!shop.items || shop.items.length === 0) {
      const issue = `Shop '${shopId}' must not be empty (core progression shop)`;
      console.error(`[validate_content]   ERROR: ${issue}`);
      issues.push(issue);
    }
  });

  const pass = issues.length === 0;
  if (pass) {
    console.log(`[validate_content]   ✓ All ${NON_EMPTY_SHOP_IDS.length} core shop(s) have items\n`);
  } else {
    console.error(`[validate_content]   ❌ Found ${issues.length} empty core shop(s)\n`);
  }

  return { pass, issues };
}

/**
 * 필수 퀘스트 존재 검증 (smoke test 의존성)
 */
function checkRequiredQuests(quests) {
  console.log('[validate_content] Checking required quests existence...');
  
  const REQUIRED_QUEST_IDS = [
    'Q_S01_D02', // Daily smoke test depends on it
  ];

  const issues = [];
  const questIds = new Set(quests.map(q => q.id));

  REQUIRED_QUEST_IDS.forEach(questId => {
    if (!questIds.has(questId)) {
      const issue = `Required quest missing: '${questId}' (daily smoke depends on it)`;
      console.error(`[validate_content]   ERROR: ${issue}`);
      issues.push(issue);
    }
  });

  const pass = issues.length === 0;
  if (pass) {
    console.log(`[validate_content]   ✓ All ${REQUIRED_QUEST_IDS.length} required quest(s) exist\n`);
  } else {
    console.error(`[validate_content]   ❌ Found ${issues.length} missing required quest(s)\n`);
  }

  return { pass, issues };
}

/**
 * 메인 실행
 */
function main() {
  console.log('[validate_content] Starting content validation v2 (deep scan)...\n');

  // 1) 파일 탐색 및 로드
  console.log('[validate_content] Searching for content files...');
  const itemsPath = findFile(FILE_CANDIDATES.items, 'items.json');
  const questsPath = findFile(FILE_CANDIDATES.quests, 'quests.json');
  const roomsPath = findFile(FILE_CANDIDATES.rooms, 'rooms.json');
  const shopsPath = findFile(FILE_CANDIDATES.shops, 'shops.json');
  const monstersPath = findFile(FILE_CANDIDATES.monsters, 'monsters.json');
  const bossSpawnsPath = findFile(FILE_CANDIDATES.bossSpawns, 'boss_spawns.json');

  const items = loadJsonOptional(itemsPath, 'items.json');
  const quests = loadJsonOptional(questsPath, 'quests.json');
  const rooms = loadJsonOptional(roomsPath, 'rooms.json');
  const shops = loadJsonOptional(shopsPath, 'shops.json');
  const monsters = loadJsonOptional(monstersPath, 'monsters.json');
  const bossSpawns = loadJsonOptional(bossSpawnsPath, 'boss_spawns.json');

  if (!items || !quests) {
    console.error('[validate_content] ERROR: items.json and quests.json are required');
    process.exit(1);
  }

  console.log(`[validate_content] Loaded: ${items.length} items, ${quests.length} quests` + 
              (rooms ? `, ${rooms.length} rooms` : '') + 
              (shops ? `, ${shops.length} shops` : '') +
              (monsters ? `, ${monsters.length} monsters` : '') +
              (bossSpawns ? `, ${bossSpawns.spawns?.length || 0} boss spawns` : '') + '\n');

  // 2) ID 세트 구축
  const itemIds = new Set(items.map(item => item.id));
  const roomIds = rooms ? new Set(rooms.map(room => room.id)) : null;
  const monsterIds = monsters ? new Set(monsters.map(monster => monster.id)) : null;

  // 3) 검증 실행
  const results = [];

  // ID 중복 검사
  results.push(checkDuplicateIds(items, 'items.json'));
  results.push(checkDuplicateIds(quests, 'quests.json'));
  if (shops) results.push(checkDuplicateIds(shops, 'shops.json'));

  // itemId 참조 검증 (deep scan)
  results.push(checkItemReferences(quests, itemIds, 'quests.json'));
  if (shops) results.push(checkItemReferences(shops, itemIds, 'shops.json'));

  // roomId 참조 검증 (deep scan)
  if (roomIds) {
    results.push(checkRoomReferences(quests, roomIds, 'quests.json'));
    if (shops) results.push(checkRoomReferences(shops, roomIds, 'shops.json'));
  }

  // Exit 무결성 + 필수 경로 검증 (rooms.json)
  if (rooms && roomIds) {
    results.push(checkExitIntegrity(rooms, roomIds));
    results.push(checkRequiredPaths(rooms, roomIds));
  }

  // boss_spawns 검증 (roomId & bossId & rewardItemsGuaranteed 참조)
  if (bossSpawns && bossSpawns.spawns) {
    results.push(checkBossSpawns(bossSpawns.spawns, roomIds, monsterIds, itemIds));
  }

  // 코어 상점 비우기 금지 체크
  if (shops) {
    results.push(checkCoreShopsNotEmpty(shops));
  }

  // 필수 퀘스트 존재 검증
  results.push(checkRequiredQuests(quests));

  // 4) 결과 요약
  console.log('\n[validate_content] ========== VALIDATION SUMMARY (v2) ==========');
  const passedCount = results.filter(r => r.pass).length;
  const failedCount = results.length - passedCount;
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);

  console.log(`[validate_content] Checks passed: ${passedCount}/${results.length}`);
  console.log(`[validate_content] Checks failed: ${failedCount}/${results.length}`);
  console.log(`[validate_content] Total issues: ${totalIssues}`);

  if (totalIssues > 0) {
    console.log('[validate_content] ❌ VALIDATION FAILED');
    process.exit(1);
  }

  console.log('[validate_content] ✅ VALIDATION PASSED');
  process.exit(0);
}

main();
