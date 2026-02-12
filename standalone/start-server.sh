#!/bin/bash

echo "========================================"
echo "  MUD 게임 서버 시작"
echo "========================================"
echo ""

# Docker가 실행 중인지 확인
if ! docker info > /dev/null 2>&1; then
    echo "[오류] Docker가 실행되지 않았습니다."
    echo "Docker Desktop을 시작한 후 다시 시도하세요."
    exit 1
fi

echo "[1/4] Docker 컨테이너 시작 중..."
cd "$(dirname "$0")"
docker-compose up -d

echo ""
echo "[2/4] 데이터베이스 준비 대기 중..."
sleep 5

echo ""
echo "[3/4] 서버 로그 확인 중..."
echo "서버가 시작되는 동안 잠시 기다려주세요..."
echo ""

# 서버 로그 표시
docker-compose logs -f server
