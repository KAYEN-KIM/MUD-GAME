#!/bin/bash
set -e

echo "데이터베이스 초기화 스크립트 실행 중..."

# 데이터베이스가 이미 존재하는지 확인
if psql -U mud -d mud -c "SELECT 1" > /dev/null 2>&1; then
    echo "데이터베이스가 이미 존재합니다."
else
    echo "데이터베이스 초기화 완료."
fi
