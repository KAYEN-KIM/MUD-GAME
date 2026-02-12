// PostgreSQL 스키마를 SQLite로 완전 변환하는 스크립트
// enum → String, Json → String 변환

const fs = require('fs');
const path = require('path');

const postgresSchemaPath = path.join(__dirname, '../apps/server/prisma/schema.prisma');
const sqliteSchemaPath = path.join(__dirname, '../apps/server/prisma/schema.sqlite.prisma');

console.log('SQLite 스키마 완전 변환 시작...');

let schema = fs.readFileSync(postgresSchemaPath, 'utf8');

// 1. provider 변경
schema = schema.replace(/provider = "postgresql"/g, 'provider = "sqlite"');

// 2. @db.Text 제거 (SQLite는 자동 처리)
schema = schema.replace(/@db\.Text/g, '');

// 3. Json 타입을 String으로 변환 (모든 경우)
schema = schema.replace(/Json\?/g, 'String?');
schema = schema.replace(/Json /g, 'String ');
schema = schema.replace(/Json\n/g, 'String\n');
schema = schema.replace(/Json$/gm, 'String');

// 4. enum 정의 찾기 및 enum 이름과 값 추출
const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
const enumMap = new Map();
const enumNames = [];

let enumMatch;
while ((enumMatch = enumRegex.exec(schema)) !== null) {
  const enumName = enumMatch[1];
  const enumBody = enumMatch[2];
  const enumValues = enumBody.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//'))
    .map(line => line.replace(/,$/, '').trim())
    .filter(v => v);
  
  enumMap.set(enumName, enumValues);
  enumNames.push(enumName);
}

console.log(`발견된 enum 개수: ${enumNames.length}`);

// 5. 먼저 enum 정의를 제거 (주석으로 대체)
enumNames.forEach((enumName) => {
  // enum 정의 전체를 제거
  const enumDefRegex = new RegExp(`enum\\s+${enumName}\\s*\\{[^}]+\\}\\s*\\n?`, 'g');
  schema = schema.replace(enumDefRegex, `// enum ${enumName} removed (SQLite doesn't support enums, use String instead)\n`);
});

// 6. 이제 enum 타입 사용 부분을 String으로 변환
enumNames.forEach((enumName) => {
  // 모델 필드에서 enum 타입 사용: fieldName EnumName -> fieldName String
  // 주의: enum 정의는 이미 제거되었으므로 이제 안전하게 변환 가능
  const fieldTypeRegex = new RegExp(`(\\s+)(\\w+)\\s+${enumName}(\\s|\\?|\\[|@|,|\\n)`, 'g');
  schema = schema.replace(fieldTypeRegex, '$1$2 String$3');
});

// 7. @default 값도 문자열로 감싸기
enumMap.forEach((values, enumName) => {
  values.forEach((enumValue) => {
    // @default(ENUM_VALUE) -> @default("ENUM_VALUE")
    // 이미 문자열로 감싸진 경우는 제외
    const defaultRegex = new RegExp(`@default\\(${enumValue}\\)`, 'g');
    schema = schema.replace(defaultRegex, `@default("${enumValue}")`);
  });
});

// 8. BOM 제거
schema = schema.replace(/^\uFEFF/, '');

// 9. 파일 저장
fs.writeFileSync(sqliteSchemaPath, schema, 'utf8');

console.log('✅ SQLite 스키마 변환 완료!');
console.log(`변환된 enum 개수: ${enumNames.length}`);
console.log(`출력 파일: ${sqliteSchemaPath}`);
