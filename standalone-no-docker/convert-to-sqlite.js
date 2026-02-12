// PostgreSQL 스키마를 SQLite로 변환하는 스크립트
const fs = require('fs');
const path = require('path');

const postgresSchemaPath = path.join(__dirname, '../apps/server/prisma/schema.prisma');
const sqliteSchemaPath = path.join(__dirname, '../apps/server/prisma/schema.sqlite.prisma');

let schema = fs.readFileSync(postgresSchemaPath, 'utf8');

// PostgreSQL -> SQLite 변환
schema = schema.replace(/provider = "postgresql"/, 'provider = "sqlite"');
schema = schema.replace(/@db\.Text/g, ''); // SQLite는 TEXT 자동 처리
schema = schema.replace(/Json\?/g, 'String?'); // JSON을 String으로
schema = schema.replace(/Json /g, 'String '); // JSON을 String으로

// SQLite는 일부 타입을 자동 변환하므로 추가 변환 불필요

fs.writeFileSync(sqliteSchemaPath, schema);
console.log('✅ SQLite 스키마 생성 완료:', sqliteSchemaPath);
