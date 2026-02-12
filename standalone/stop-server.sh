#!/bin/bash

echo "========================================"
echo "  MUD 게임 서버 중지"
echo "========================================"
echo ""

cd "$(dirname "$0")"
docker-compose down

echo ""
echo "서버가 중지되었습니다."
