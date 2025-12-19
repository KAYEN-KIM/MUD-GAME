import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RateLimitService } from '../../rate-limit/rate-limit.service';

@Injectable()
export class WorldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitService,
  ) {}

  // 방향 정규화 및 매핑
  private normalizeDirection(dir: string): string {
    const normalized = dir.trim().toUpperCase();
    const mapping: Record<string, string> = {
      'N': 'N',
      'NORTH': 'N',
      '북': 'N',
      'S': 'S',
      'SOUTH': 'S',
      '남': 'S',
      'E': 'E',
      'EAST': 'E',
      '동': 'E',
      'W': 'W',
      'WEST': 'W',
      '서': 'W',
      'U': 'U',
      'UP': 'U',
      'D': 'D',
      'DOWN': 'D',
    };
    return mapping[normalized] || normalized;
  }

  // 방향 코드를 방향명으로 변환
  private directionToLabel(dir: string): string {
    const labels: Record<string, string> = {
      'N': '북',
      'S': '남',
      'E': '동',
      'W': '서',
      'U': '위',
      'D': '아래',
    };
    return labels[dir] || dir;
  }

  async moveByDir(characterId: string, dir: string) {
    // 레이트 리밋 확인
    const rateCheck = await this.rateLimit.checkMoveRateLimit(characterId);
    if (!rateCheck.allowed) {
      throw new Error('이동 속도가 너무 빠릅니다.');
    }

    // 방향 정규화
    const normalizedDir = this.normalizeDirection(dir);
    if (!['N', 'S', 'E', 'W', 'U', 'D'].includes(normalizedDir)) {
      throw new Error(`잘못된 방향입니다: ${dir}`);
    }

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: {
        room: {
          include: {
            exitsFrom: {
              include: {
                toRoom: true,
              },
            },
          },
        },
      },
    });

    if (!character) {
      throw new Error('캐릭터를 찾을 수 없습니다.');
    }

    // label에서 방향 추론 함수
    const labelToDirection = (label: string): string | null => {
      const normalizedLabel = label.trim().toUpperCase();
      if (normalizedLabel.includes('북') || normalizedLabel === 'N' || normalizedLabel === 'NORTH') return 'N';
      if (normalizedLabel.includes('남') || normalizedLabel === 'S' || normalizedLabel === 'SOUTH') return 'S';
      if (normalizedLabel.includes('동') || normalizedLabel === 'E' || normalizedLabel === 'EAST') return 'E';
      if (normalizedLabel.includes('서') || normalizedLabel === 'W' || normalizedLabel === 'WEST') return 'W';
      if (normalizedLabel.includes('위') || normalizedLabel === 'U' || normalizedLabel === 'UP') return 'U';
      if (normalizedLabel.includes('아래') || normalizedLabel === 'D' || normalizedLabel === 'DOWN') return 'D';
      return null;
    };

    // 방향에 맞는 출구 찾기 (label에서 방향 추론)
    const exit = character.room.exitsFrom.find((e) => {
      const exitDir = labelToDirection(e.label);
      return exitDir === normalizedDir;
    });

    const availableExits = character.room.exitsFrom.map((e) => {
      const exitDir = labelToDirection(e.label);
      return { label: e.label, toRoomId: e.toRoomId, dir: exitDir || null };
    });

    if (!exit) {
      const exitsStr = availableExits.map((e) => `{label:"${e.label}",toRoomId:"${e.toRoomId}",dir:${e.dir || 'null'}}`).join(', ');
      console.log(
        `[MOVE 실패] characterId=${characterId}, name=${character.name}, currentRoomId=${character.roomId}, 받은 dir=${dir}, 정규화된 dir=${normalizedDir}, availableExits=[${exitsStr}]`,
      );
      throw new Error('해당 방향으로 갈 수 없습니다.');
    }

    // 디버깅 로그
    const exitsStr = availableExits.map((e) => `{label:"${e.label}",toRoomId:"${e.toRoomId}",dir:${e.dir || 'null'}}`).join(', ');
    console.log(
      `[MOVE] characterId=${characterId}, name=${character.name}, currentRoomId=${character.roomId}, 받은 dir=${dir}, 정규화된 dir=${normalizedDir}, availableExits=[${exitsStr}]`,
    );

    // 이동
    await this.prisma.character.update({
      where: { id: characterId },
      data: { roomId: exit.toRoomId },
    });

    // 파티 멤버 팔로우 처리
    const partyMember = await this.prisma.partyMember.findFirst({
      where: { characterId },
      include: {
        party: {
          include: {
            members: {
              include: {
                character: true,
              },
            },
          },
        },
      },
    });

    if (partyMember && partyMember.party.leaderCharacterId === characterId) {
      // 리더인 경우 follow=true 멤버들 이동
      for (const member of partyMember.party.members) {
        if (member.follow && member.characterId !== characterId) {
          await this.prisma.character.update({
            where: { id: member.characterId },
            data: { roomId: exit.toRoomId },
          });
        }
      }
    }

    return exit.toRoomId;
  }

  async move(characterId: string, toRoomId: string) {
    // 레이트 리밋 확인
    const rateCheck = await this.rateLimit.checkMoveRateLimit(characterId);
    if (!rateCheck.allowed) {
      throw new Error('이동 속도가 너무 빠릅니다.');
    }

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: {
        room: {
          include: {
            exitsFrom: true,
          },
        },
      },
    });

    if (!character) {
      throw new Error('캐릭터를 찾을 수 없습니다.');
    }

    // label에서 방향 추론 함수 (로깅용)
    const labelToDirection = (label: string): string | null => {
      const normalizedLabel = label.trim().toUpperCase();
      if (normalizedLabel.includes('북') || normalizedLabel === 'N' || normalizedLabel === 'NORTH') return 'N';
      if (normalizedLabel.includes('남') || normalizedLabel === 'S' || normalizedLabel === 'SOUTH') return 'S';
      if (normalizedLabel.includes('동') || normalizedLabel === 'E' || normalizedLabel === 'EAST') return 'E';
      if (normalizedLabel.includes('서') || normalizedLabel === 'W' || normalizedLabel === 'WEST') return 'W';
      if (normalizedLabel.includes('위') || normalizedLabel === 'U' || normalizedLabel === 'UP') return 'U';
      if (normalizedLabel.includes('아래') || normalizedLabel === 'D' || normalizedLabel === 'DOWN') return 'D';
      return null;
    };

    // 출구 확인 (anti-cheat: 현재 방 exits에 있는 목적지로만 허용)
    const exit = character.room.exitsFrom.find((e) => e.toRoomId === toRoomId);
    
    const availableExits = character.room.exitsFrom.map((e) => {
      const exitDir = labelToDirection(e.label);
      return { label: e.label, toRoomId: e.toRoomId, dir: exitDir || null, minLevel: e.minLevel };
    });

    if (!exit) {
      const exitsStr = availableExits.map((e) => `{label:"${e.label}",toRoomId:"${e.toRoomId}",dir:${e.dir || 'null'},minLevel:${e.minLevel || 'null'}}`).join(', ');
      console.log(
        `[MOVE 실패] characterId=${characterId}, name=${character.name}, currentRoomId=${character.roomId}, 받은 toRoomId=${toRoomId}, availableExits=[${exitsStr}]`,
      );
      throw new Error('해당 방향으로 갈 수 없습니다.');
    }

    // 게이트 확인 (레벨 제한)
    if (exit.minLevel && character.level < exit.minLevel) {
      console.log(`[GATE] characterId=${characterId}, level=${character.level}, required=${exit.minLevel}, toRoomId=${toRoomId}`);
      throw new Error(`레벨이 부족합니다. 권장 레벨: ${exit.minLevel}`);
    }

    // 디버깅 로그
    const exitsStr = availableExits.map((e) => `{label:"${e.label}",toRoomId:"${e.toRoomId}",dir:${e.dir || 'null'}}`).join(', ');
    console.log(
      `[MOVE] characterId=${characterId}, name=${character.name}, currentRoomId=${character.roomId}, 받은 toRoomId=${toRoomId}, availableExits=[${exitsStr}]`,
    );

    // 이동
    await this.prisma.character.update({
      where: { id: characterId },
      data: { roomId: toRoomId },
    });

    // 파티 멤버 팔로우 처리
    const partyMember = await this.prisma.partyMember.findFirst({
      where: { characterId },
      include: {
        party: {
          include: {
            members: {
              include: {
                character: true,
              },
            },
          },
        },
      },
    });

    if (partyMember && partyMember.party.leaderCharacterId === characterId) {
      // 리더인 경우 follow=true 멤버들 이동
      for (const member of partyMember.party.members) {
        if (member.follow && member.characterId !== characterId) {
          await this.prisma.character.update({
            where: { id: member.characterId },
            data: { roomId: toRoomId },
          });
        }
      }
    }

    return toRoomId;
  }

  async hunt(characterId: string) {
    // 쿨다운 확인
    const cdCheck = await this.rateLimit.checkHuntCooldown(characterId);
    if (!cdCheck) {
      throw new Error('아직 사냥할 수 없습니다. 잠시 후 다시 시도하세요.');
    }

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: {
        room: {
          include: {
            spawns: {
              include: {
                monster: true,
              },
            },
          },
        },
      },
    });

    if (!character) {
      throw new Error('캐릭터를 찾을 수 없습니다.');
    }

    if (character.room.spawns.length === 0) {
      throw new Error('이 방에서는 몬스터를 찾을 수 없습니다.');
    }

    // dangerLevel 로깅
    const dangerLevel = character.room.dangerLevel || 0;
    console.log(`[HUNT] characterId=${characterId}, roomId=${character.roomId}, dangerLevel=${dangerLevel}, spawns=${character.room.spawns.length}`);

    // 가중치 기반 랜덤 선택
    const totalWeight = character.room.spawns.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedSpawn = character.room.spawns[0];

    for (const spawn of character.room.spawns) {
      random -= spawn.weight;
      if (random <= 0) {
        selectedSpawn = spawn;
        break;
      }
    }

    console.log(`[HUNT] Selected monster=${selectedSpawn.monster.name}, level=${selectedSpawn.monster.level}`);
    return selectedSpawn.monster;
  }

  async getCharacterState(characterId: string) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: {
        room: {
          include: {
            exitsFrom: true,
          },
        },
      },
    });

    if (!character) return null;

    // label에서 방향 추론 함수
    const labelToDirection = (label: string): string | null => {
      const normalizedLabel = label.trim().toUpperCase();
      if (normalizedLabel.includes('북') || normalizedLabel === 'N' || normalizedLabel === 'NORTH') return 'N';
      if (normalizedLabel.includes('남') || normalizedLabel === 'S' || normalizedLabel === 'SOUTH') return 'S';
      if (normalizedLabel.includes('동') || normalizedLabel === 'E' || normalizedLabel === 'EAST') return 'E';
      if (normalizedLabel.includes('서') || normalizedLabel === 'W' || normalizedLabel === 'WEST') return 'W';
      if (normalizedLabel.includes('위') || normalizedLabel === 'U' || normalizedLabel === 'UP') return 'U';
      if (normalizedLabel.includes('아래') || normalizedLabel === 'D' || normalizedLabel === 'DOWN') return 'D';
      return null;
    };

    // Room tags 정규화 (null → [])
    const roomTags = Array.isArray(character.room.tags) ? character.room.tags : [];

    // exits 정보 추가 (label trim 적용)
    const exits = character.room.exitsFrom.map((e) => ({
      label: e.label.trim(),
      toRoomId: e.toRoomId,
      dir: labelToDirection(e.label),
    }));

    return {
      ...character,
      exits,
      roomTags, // roomTags 추가
    };
  }
}

