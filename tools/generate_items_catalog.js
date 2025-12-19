#!/usr/bin/env node
/**
 * generate_items_catalog.js
 * 
 * 서버의 items.json에서 클라이언트용 경량 카탈로그를 자동 생성합니다.
 * 
 * Usage:
 *   node tools/generate_items_catalog.js
 *   또는 pnpm catalog:sync
 * 
 * Input:  apps/server/src/content/items.json (또는 여러 후보 경로)
 * Output: mud_client/assets/catalog/items_catalog.json
 */

const fs = require('fs');
const path = require('path');

// 프로젝트 루트 (tools/의 상위 디렉터리)
const PROJECT_ROOT = path.resolve(__dirname, '..');

// items.json 후보 경로 (순서대로 확인)
const ITEMS_JSON_CANDIDATES = [
  'apps/server/src/content/items.json',
  'apps/server/content/items.json',
  'server/src/content/items.json',
];

// 출력 경로
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'mud_client/assets/catalog/items_catalog.json');

/**
 * items.json 파일 찾기
 */
function findItemsJson() {
  for (const candidate of ITEMS_JSON_CANDIDATES) {
    const fullPath = path.join(PROJECT_ROOT, candidate);
    if (fs.existsSync(fullPath)) {
      console.log(`[generate_items_catalog] Found items.json at: ${candidate}`);
      return fullPath;
    }
  }
  
  console.error('[generate_items_catalog] ERROR: items.json not found in any candidate path:');
  ITEMS_JSON_CANDIDATES.forEach(c => console.error(`  - ${c}`));
  process.exit(1);
}

/**
 * items.json 읽기 및 검증
 */
function loadItemsJson(filePath) {
  let rawData;
  try {
    rawData = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`[generate_items_catalog] ERROR: Failed to read ${filePath}:`, err.message);
    process.exit(1);
  }

  let items;
  try {
    items = JSON.parse(rawData);
  } catch (err) {
    console.error(`[generate_items_catalog] ERROR: Invalid JSON in ${filePath}:`, err.message);
    process.exit(1);
  }

  if (!Array.isArray(items)) {
    console.error(`[generate_items_catalog] ERROR: items.json must be an array`);
    process.exit(1);
  }

  return items;
}

/**
 * 카탈로그 생성 (id + name만 추출, 알파벳 정렬)
 */
function generateCatalog(items) {
  const catalog = {};

  items.forEach((item, index) => {
    const itemId = item.id || item.itemId;
    const itemName = item.name;

    if (!itemId) {
      console.error(`[generate_items_catalog] ERROR: Item at index ${index} is missing 'id' or 'itemId' field`);
      process.exit(1);
    }

    if (!itemName) {
      console.error(`[generate_items_catalog] ERROR: Item '${itemId}' is missing 'name' field`);
      process.exit(1);
    }

    catalog[itemId] = { name: itemName };
  });

  // 알파벳 순으로 정렬
  const sortedCatalog = {};
  Object.keys(catalog)
    .sort()
    .forEach(key => {
      sortedCatalog[key] = catalog[key];
    });

  return sortedCatalog;
}

/**
 * 카탈로그 저장
 */
function saveCatalog(catalog, outputPath) {
  const outputDir = path.dirname(outputPath);
  
  // 디렉터리 생성 (없으면)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`[generate_items_catalog] Created directory: ${outputDir}`);
  }

  const jsonString = JSON.stringify(catalog, null, 2) + '\n';

  try {
    fs.writeFileSync(outputPath, jsonString, 'utf8');
    console.log(`[generate_items_catalog] ✓ Generated catalog: ${path.relative(PROJECT_ROOT, outputPath)}`);
    console.log(`[generate_items_catalog] ✓ Total items: ${Object.keys(catalog).length}`);
  } catch (err) {
    console.error(`[generate_items_catalog] ERROR: Failed to write ${outputPath}:`, err.message);
    process.exit(1);
  }
}

/**
 * 메인 실행
 */
function main() {
  console.log('[generate_items_catalog] Starting catalog generation...');
  
  const itemsJsonPath = findItemsJson();
  const items = loadItemsJson(itemsJsonPath);
  const catalog = generateCatalog(items);
  saveCatalog(catalog, OUTPUT_PATH);
  
  console.log('[generate_items_catalog] Done!');
}

main();

