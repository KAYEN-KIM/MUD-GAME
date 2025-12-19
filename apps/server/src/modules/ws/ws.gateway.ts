import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { AuthService } from '../auth/auth.service';
import { WorldService } from '../world/world.service';
import { PartyService } from '../party/party.service';
import { CombatService } from '../combat/combat.service';
import { ChatService } from '../chat/chat.service';
import { QuestService } from '../quest/quest.service';
import { ShopService } from '../shop/shop.service';
import { SeasonService } from '../season/season.service';
import { BossService } from '../boss/boss.service';
import { PrismaService } from '../../common/prisma.service';
import { WSMessage, LogAppendPayload, StateSyncPayload, ErrorPayload } from './dto';
import { getMaxUnlockedSeason, isUnlockedId } from '../../utils/season_lock';

type WSClient = WebSocket & {
  userId?: string;
  characterId?: string;
};

@WebSocketGateway()
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private clients = new Map<WSClient, { userId?: string; characterId?: string }>();
  private encounterTimers = new Map<string, NodeJS.Timeout>();
  private questTrackThrottle = new Map<string, { lastSentAtMs: number; lastHash: string }>();

  constructor(
    private readonly authService: AuthService,
    private readonly worldService: WorldService,
    private readonly partyService: PartyService,
    private readonly combatService: CombatService,
    private readonly chatService: ChatService,
    private readonly questService: QuestService,
    private readonly shopService: ShopService,
    private readonly seasonService: SeasonService,
    private readonly bossService: BossService,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(client: WSClient) {
    console.log('✅ WebSocket 연결됨');
    this.clients.set(client, {});

    client.on('message', async (data: Buffer | string | ArrayBuffer) => {
      try {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
        const message: WSMessage = JSON.parse(buffer.toString());
        await this.handleMessage(client, message);
      } catch (error: any) {
        this.sendError(client, undefined, 'INVALID_STATE', error.message || '메시지 처리 실패');
      }
    });
  }

  handleDisconnect(client: WSClient) {
    console.log('❌ WebSocket 연결 종료');
    const clientData = this.clients.get(client);
    if (clientData?.characterId) {
      // Quest track throttle 정리
      this.questTrackThrottle.delete(clientData.characterId);
    }
    this.clients.delete(client);
  }

  private async handleMessage(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);

    // 인증 확인 (AUTH 제외)
    if (message.t !== 'AUTH' && (!clientData?.characterId)) {
      this.sendError(client, message.reqId, 'FORBIDDEN', '인증이 필요합니다.');
      return;
    }

    try {
      switch (message.t) {
        case 'AUTH':
          await this.handleAuth(client, message);
          break;
        case 'MOVE':
          await this.handleMove(client, message);
          break;
        case 'HUNT':
          await this.handleHunt(client, message);
          break;
        case 'PARTY_CREATE':
          await this.handlePartyCreate(client, message);
          break;
        case 'PARTY_INVITE':
          await this.handlePartyInvite(client, message);
          break;
        case 'PARTY_JOIN':
          await this.handlePartyJoin(client, message);
          break;
        case 'PARTY_LEAVE':
          await this.handlePartyLeave(client, message);
          break;
        case 'PARTY_FOLLOW_SET':
          await this.handlePartyFollowSet(client, message);
          break;
        case 'PARTY_SPEED_SET':
          await this.handlePartySpeedSet(client, message);
          break;
        case 'PARTY_PRESET_SET':
          await this.handlePartyPresetSet(client, message);
          break;
        case 'COMBAT_TURN':
          await this.handleCombatTurn(client, message);
          break;
        case 'COMBAT_TIMEBANK_USE':
          await this.handleCombatTimebankUse(client, message);
          break;
        case 'CHAT_SEND':
          await this.handleChatSend(client, message);
          break;
        case 'REPORT_CREATE':
          await this.handleReportCreate(client, message);
          break;
        case 'INVENTORY_LIST':
          await this.handleInventoryList(client, message);
          break;
        case 'EQUIPMENT_GET':
          await this.handleEquipmentGet(client, message);
          break;
        case 'EQUIP':
          await this.handleEquip(client, message);
          break;
        case 'UNEQUIP':
          await this.handleUnequip(client, message);
          break;
        case 'SHOP_LIST':
          await this.handleShopList(client, message);
          break;
        case 'SHOP_BUY':
          await this.handleShopBuy(client, message);
          break;
        case 'SHOP_SELL':
          await this.handleShopSell(client, message);
          break;
        case 'REST':
          await this.handleRest(client, message);
          break;
        case 'QUEST_LIST':
          await this.handleQuestList(client, message);
          break;
        case 'QUEST_ACCEPT':
          await this.handleQuestAccept(client, message);
          break;
        case 'QUEST_TURNIN':
          await this.handleQuestTurnin(client, message);
          break;
        case 'USE_ITEM':
          await this.handleUseItem(client, message);
          break;
        case 'SHOP_LIST':
          await this.handleShopList(client, message);
          break;
        case 'SHOP_BUY':
          await this.handleShopBuy(client, message);
          break;
        case 'SEASON_STATUS':
          await this.handleSeasonStatus(client, message);
          break;
        case 'PARTY_CREATE':
          await this.handlePartyCreate(client, message);
          break;
        case 'PARTY_JOIN':
          await this.handlePartyJoin(client, message);
          break;
        case 'PARTY_LEAVE':
          await this.handlePartyLeave(client, message);
          break;
        case 'PARTY_INFO':
          await this.handlePartyInfo(client, message);
          break;
        // TEST_MODE 전용 디버그 이벤트
        case 'DEBUG_GRANT_GOLD':
        case 'DEBUG_SET_HP':
        case 'DEBUG_APPLY_DEATH':
        case 'DEBUG_GRANT_ITEM':
          await this.handleDebugCommand(client, message);
          break;
        default:
          this.sendError(client, message.reqId, 'INVALID_STATE', `알 수 없는 이벤트: ${message.t}`);
      }
    } catch (error: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', error.message);
    }
  }

  private async handleAuth(client: WSClient, message: WSMessage) {
    const { token } = message.p;
    const payload = this.authService.verifyToken(token);

    if (!payload) {
      this.sendMessage(client, {
        t: 'AUTH_FAIL',
        reqId: message.reqId,
        ts: Date.now(),
        p: { reason: '유효하지 않은 토큰입니다.' },
      });
      return;
    }

    const clientData = this.clients.get(client);
    if (clientData) {
      clientData.userId = payload.userId;
      clientData.characterId = payload.characterId;
    }

    const character = await this.prisma.character.findUnique({
      where: { id: payload.characterId },
      include: { room: { include: { exitsFrom: true } } },
    });

    this.sendMessage(client, {
      t: 'AUTH_OK',
      reqId: message.reqId,
      ts: Date.now(),
      p: { characterId: character?.id, characterName: character?.name },
    });

    if (character) {
      await this.sendStateSync(client, character.id);
      this.sendLog(client, 'SYSTEM', `${character.name}으로 접속했습니다.`);
      
      // AUTH_OK 직후 SEASON_STATUS 자동 푸시 (UX 개선)
      const seasonStatus = this.seasonService.getSeasonStatus();
      this.sendMessage(client, {
        t: 'SEASON_STATUS',
        reqId: undefined, // 자동 푸시는 reqId 없음
        ts: Date.now(),
        p: seasonStatus,
      });
    }
  }

  private async handleMove(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    // toRoomId (우선) 또는 roomId (하위호환) 또는 dir/direction 지원
    const toRoomId = (message.p.toRoomId as string | undefined) || (message.p.roomId as string | undefined);
    const dir = (message.p.dir as string | undefined) || (message.p.direction as string | undefined);

    try {
      let targetRoomId: string | undefined;
      
      if (toRoomId) {
        // 룸 ID 기반 이동 (anti-cheat: 현재 방 exits에 있는 목적지로만 허용)
        targetRoomId = toRoomId;
      } else if (dir) {
        // 방향 기반 이동 (하위호환)
        // WorldService에서 방향 -> roomId 변환 후 targetRoomId 설정 필요
        // 일단 여기서는 moveByDir 호출 전에 시즌 잠금 체크 불가능
        // moveByDir 내부에서 차단하거나, 여기서는 skip
      }
      
      // 시즌 잠금: 잠긴 시즌 방으로 이동 차단
      if (targetRoomId && !isUnlockedId(targetRoomId, getMaxUnlockedSeason())) {
        const season = require('../../utils/season_lock').parseSeasonFromId(targetRoomId);
        this.sendError(client, message.reqId, 'SEASON_LOCKED', `시즌 ${season}은(는) 아직 잠겨 있습니다. (Coming Soon)`);
        return;
      }
      
      if (toRoomId) {
        await this.worldService.move(clientData.characterId, toRoomId);
        this.sendLog(client, 'WORLD', '이동했습니다.');
      } else if (dir) {
        await this.worldService.moveByDir(clientData.characterId, dir);
        this.sendLog(client, 'WORLD', '이동했습니다.');
      } else {
        this.sendError(client, message.reqId, 'INVALID_PARAMS', 'toRoomId 또는 dir가 필요합니다.');
        return;
      }

      // Quest 트리거: 방 방문
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { roomId: true },
      });
      if (character) {
        const questResult = await this.questService.onMove(clientData.characterId, character.roomId);
        if (questResult.changed) {
          this.sendQuestTrack(client, clientData.characterId, questResult.active, questResult.completedIds);
        }
      }

      await this.sendStateSync(client, clientData.characterId, message.reqId);
      
      // Party sync: roomId 변경 시
      const partyId = this.partyService.getPartyIdByCharacterId(clientData.characterId);
      if (partyId) {
        await this.sendPartySyncToAll(partyId);
      }
    } catch (error: any) {
      this.sendError(client, message.reqId, 'MOVE_FAILED', error.message || '이동 실패');
    }
  }

  private async handleHunt(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const character = await this.prisma.character.findUnique({
      where: { id: clientData.characterId },
      include: { room: true },
    });

    if (!character) return;

    const party = await this.partyService.getPartyByCharacter(clientData.characterId);
    if (!party) {
      this.sendError(client, message.reqId, 'INVALID_STATE', '파티에 속해 있지 않습니다.');
      return;
    }

    // 보스 스폰 체크
    const room = character.room;
    const isBossRoom = room.tags && (room.tags as string[]).includes('BOSS');
    const bossSpawn = isBossRoom ? this.bossService.getSpawnByRoom(room.id) : null;

    let monster: any;
    let isBoss = false;

    if (bossSpawn) {
      const now = new Date();
      const bossAvailable = await this.bossService.isBossAvailable(room.id, now);
      
      if (bossAvailable) {
        // 보스 인카운터
        monster = await this.prisma.monster.findUnique({
          where: { id: bossSpawn.bossId },
        });

        if (monster) {
          isBoss = true;
          this.sendLog(client, 'SYSTEM', `💀 보스가 나타났다: ${monster.name}`);
        } else {
          // 보스 몬스터가 DB에 없으면 fallback
          monster = await this.worldService.hunt(clientData.characterId);
        }
      } else {
        // 쿨다운 중
        const remainingSec = await this.bossService.getCooldownRemainingSec(room.id, now);
        this.sendLog(client, 'SYSTEM', `보스는 회복 중입니다 (${remainingSec}초 후 재등장)`);
        monster = await this.worldService.hunt(clientData.characterId);
      }
    } else {
      // 일반 몬스터
      monster = await this.worldService.hunt(clientData.characterId);
    }

    const encounter = await this.combatService.createEncounter(party.id, character.roomId, monster.id, isBoss);

    this.sendMessage(client, {
      t: 'ENCOUNTER_START',
      reqId: message.reqId,
      ts: Date.now(),
      p: {
        encounterId: encounter.id,
        isBoss: encounter.isBoss,
        turnDeadlineAt: encounter.turnDeadlineAt.getTime(),
        partySnapshot: (encounter.stateJson as any).party,
        enemySnapshot: (encounter.stateJson as any).enemies,
      },
    });

    this.sendLog(client, 'COMBAT', `${monster.name}과(와) 조우했습니다!`);

    // 전투 타이머 시작
    await this.scheduleEncounter(encounter.id);
  }

  private async handlePartyCreate(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const { party, code } = await this.partyService.createParty(clientData.characterId);
      this.sendLog(client, 'SYSTEM', `파티를 생성했습니다. 초대 코드: ${code}`);
      await this.sendPartySyncToAll(party.id);
    } catch (error: any) {
      this.sendError(client, message.reqId, 'PARTY_CREATE_FAILED', error.message || '파티 생성 실패');
    }
  }

  private async handlePartyInvite(client: WSClient, message: WSMessage) {
    const { toCharacterName } = message.p;
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const party = await this.partyService.getPartyByCharacter(clientData.characterId);
    if (!party) {
      this.sendError(client, message.reqId, 'INVALID_STATE', '파티에 속해 있지 않습니다.');
      return;
    }

    await this.partyService.inviteToParty(party.id, clientData.characterId, toCharacterName);
    this.sendLog(client, 'SYSTEM', `${toCharacterName}에게 파티 초대를 보냈습니다.`);
  }

  private async handlePartyJoin(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const { code } = message.p;
    if (!code) {
      this.sendError(client, message.reqId, 'INVALID_STATE', '초대 코드가 필요합니다.');
      return;
    }

    try {
      const party = await this.partyService.joinPartyByCode(clientData.characterId, code);
      this.sendLog(client, 'SYSTEM', `파티에 가입했습니다.`);
      if (party) {
        await this.sendPartySyncToAll(party.id);
      }
    } catch (error: any) {
      this.sendError(client, message.reqId, 'PARTY_JOIN_FAILED', error.message || '파티 가입 실패');
    }
  }

  private async handlePartyLeave(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const partyId = this.partyService.getPartyIdByCharacterId(clientData.characterId);
      await this.partyService.leaveParty(clientData.characterId);
      this.sendLog(client, 'SYSTEM', `파티를 나갔습니다.`);
      
      // 파티 sync (남은 멤버들에게)
      if (partyId) {
        await this.sendPartySyncToAll(partyId);
      }
      
      // 나간 캐릭터에게는 빈 PARTY_SYNC 전송
      this.sendMessage(client, {
        t: 'PARTY_SYNC',
        reqId: undefined,
        ts: Date.now(),
        p: null,
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'PARTY_LEAVE_FAILED', error.message || '파티 나가기 실패');
    }
  }

  private async handlePartyFollowSet(client: WSClient, message: WSMessage) {
    const { follow } = message.p;
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    await this.partyService.setFollow(clientData.characterId, follow);
    this.sendLog(client, 'SYSTEM', `팔로우: ${follow ? '켜짐' : '꺼짐'}`);
  }

  private async handlePartySpeedSet(client: WSClient, message: WSMessage) {
    const { speedMode } = message.p;
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const party = await this.partyService.getPartyByCharacter(clientData.characterId);
    if (!party) return;

    await this.partyService.setSpeedMode(party.id, clientData.characterId, speedMode);
    this.sendLog(client, 'SYSTEM', `전투 속도: ${speedMode}`);
  }

  private async handlePartyPresetSet(client: WSClient, message: WSMessage) {
    const { preset } = message.p;
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    await this.partyService.setPreset(clientData.characterId, preset);
    this.sendLog(client, 'SYSTEM', `프리셋 변경: ${preset}`);
  }

  private async handleCombatTurn(client: WSClient, message: WSMessage) {
    const { encounterId, action, targetId } = message.p;
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    await this.combatService.setCombatAction(encounterId, clientData.characterId, action, targetId);
    this.sendLog(client, 'COMBAT', `행동 입력: ${action} (접수됨)`);
  }

  private async handleCombatTimebankUse(client: WSClient, message: WSMessage) {
    const { encounterId } = message.p;
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    await this.combatService.useTimeBank(encounterId, clientData.characterId);
    this.sendLog(client, 'COMBAT', '타임뱅크 사용 (+6초)');
  }

  private async handleChatSend(client: WSClient, message: WSMessage) {
    const { channel, text, toName } = message.p;
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    await this.chatService.sendChat(clientData.characterId, channel, text, toName);
    this.sendLog(client, 'CHAT', `[${channel}] ${text}`);
  }

  private async handleReportCreate(client: WSClient, message: WSMessage) {
    const { targetName, reason } = message.p;
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    await this.prisma.report.create({
      data: {
        reporterCharacterId: clientData.characterId,
        targetName,
        reason,
      },
    });

    this.sendLog(client, 'SYSTEM', '신고가 접수되었습니다.');
  }

  private sendMessage(client: WSClient, message: WSMessage) {
    if (client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  }

  private sendError(client: WSClient, reqId: string | undefined, code: string, message: string) {
    this.sendMessage(client, {
      t: 'ERROR',
      reqId,
      ts: Date.now(),
      p: { code, message } as ErrorPayload,
    });
  }

  private sendLog(client: WSClient, scope: string, text: string) {
    this.sendMessage(client, {
      t: 'LOG_APPEND',
      ts: Date.now(),
      p: { scope, text } as LogAppendPayload,
    });
  }

  private cleanupQuestTrackThrottle(nowMs: number) {
    const EVICT_AFTER_MS = 60 * 60 * 1000; // 60분
    const toDelete: string[] = [];
    
    for (const [characterId, data] of this.questTrackThrottle.entries()) {
      if (nowMs - data.lastSentAtMs > EVICT_AFTER_MS) {
        toDelete.push(characterId);
      }
    }
    
    for (const characterId of toDelete) {
      this.questTrackThrottle.delete(characterId);
    }
    
    if (toDelete.length > 0) {
      console.log(`[QuestTrackThrottle] Evicted ${toDelete.length} stale entries`);
    }
  }

  private sendQuestTrack(client: WSClient, characterId: string, active: any[], completedIds: string[] = []) {
    const now = Date.now();
    const THROTTLE_MS = 1000;

    // Opportunistic cleanup: every 50 entries
    if (this.questTrackThrottle.size % 50 === 0 && this.questTrackThrottle.size > 0) {
      this.cleanupQuestTrackThrottle(now);
    }

    // payload hash 계산 (간단히 JSON 직렬화)
    const payloadHash = JSON.stringify({ active: active.map(q => ({ questId: q.questId, status: q.status, progressSummary: q.progressSummary })), completedIds });
    
    const throttleData = this.questTrackThrottle.get(characterId);
    if (throttleData) {
      // 1초 내 동일 payload 재전송 금지
      if (now - throttleData.lastSentAtMs < THROTTLE_MS && throttleData.lastHash === payloadHash) {
        return; // throttle
      }
    }

    // throttle 업데이트
    this.questTrackThrottle.set(characterId, { lastSentAtMs: now, lastHash: payloadHash });

    // QUEST_TRACK 푸시
    this.sendMessage(client, {
      t: 'QUEST_TRACK',
      reqId: undefined, // 푸시 이벤트 (reqId 없음)
      ts: now,
      p: {
        active: active.map(q => ({
          questId: q.questId,
          title: q.title,
          status: q.status,
          progressSummary: q.progressSummary,
          giverRoomId: q.giverRoomId,
          turninRoomId: q.turninRoomId,
          repeatable: q.repeatable,
          cadence: q.cadence,
        })),
        completedIds,
      },
    });
  }

  private async sendStateSync(client: WSClient, characterId: string, reqId?: string) {
    const character = await this.worldService.getCharacterState(characterId);
    const party = await this.partyService.getPartyByCharacter(characterId);

    let exitsData = (character as any)?.exits || undefined;
    
    // 시즌 잠금: 잠긴 시즌으로 가는 출구 필터링
    if (exitsData && Array.isArray(exitsData)) {
      const maxSeason = getMaxUnlockedSeason();
      const originalCount = exitsData.length;
      exitsData = exitsData.filter((exit: any) => isUnlockedId(exit.toRoomId, maxSeason));
      
      if (process.env.TEST_MODE === 'true' && originalCount !== exitsData.length) {
        console.log(`[SEASON_LOCK] exits 필터링: ${originalCount} → ${exitsData.length} (maxSeason=${maxSeason})`);
      }
    }
    
    // 서버 로깅: STATE_SYNC 송신 시 exits 포함 여부 확인
    console.log(`[STATE_SYNC] characterId=${characterId}, exits 포함 여부: ${exitsData ? 'YES' : 'NO'}`);
    if (exitsData) {
      console.log(`[STATE_SYNC] exits 길이: ${Array.isArray(exitsData) ? exitsData.length : 'N/A'}`);
      if (Array.isArray(exitsData) && exitsData.length > 0) {
        console.log(`[STATE_SYNC] exits[0]: ${JSON.stringify(exitsData[0])}`);
      }
    }

    // 장비 요약 정보 조회
    const equipment = await this.prisma.equipment.findMany({
      where: { characterId },
      include: { item: true },
    });

    let totalAtk = 0;
    let totalDef = 0;
    let totalHpBonus = 0;
    const equipmentSummary: any = {};

    for (const eq of equipment) {
      totalAtk += eq.item.atk;
      totalDef += eq.item.def;
      totalHpBonus += eq.item.hpBonus;
      equipmentSummary[eq.slot] = {
        itemId: eq.itemId,
        name: eq.item.name,
        atk: eq.item.atk,
        def: eq.item.def,
        hpBonus: eq.item.hpBonus,
      };
    }

    const stateSync: StateSyncPayload = {
      char: character
        ? {
            id: character.id,
            name: character.name,
            level: character.level,
            exp: character.exp,
            gold: character.gold,
            hp: character.hp,
            hpMax: character.hpMax,
            roomId: character.roomId,
            roomTags: (character as any).roomTags || [], // roomTags 추가
            cosmeticIconItemId: (character as any).cosmeticIconItemId || null, // 코스메틱 아이콘
            cosmeticTitleItemId: (character as any).cosmeticTitleItemId || null, // 코스메틱 칭호
            equipmentBonus: {
              atk: totalAtk,
              def: totalDef,
              hpBonus: totalHpBonus,
            },
          }
        : undefined,
      party: party
        ? {
            id: party.id,
            leaderId: party.leaderCharacterId,
            speedMode: party.speedMode,
            members: party.members.map((m) => ({
              id: m.characterId,
              name: m.character.name,
              follow: m.follow,
            })),
          }
        : undefined,
      exits: exitsData, // 필드명 'exits'로 통일
      equipment: equipmentSummary,
    };

    console.log(`[sendStateSync] reqId=${reqId}, characterId=${characterId}`);
    this.sendMessage(client, {
      t: 'STATE_SYNC',
      reqId: reqId,
      ts: Date.now(),
      p: stateSync,
    });
  }

  // 전투 타이머 스케줄링
  private async scheduleEncounter(encounterId: string) {
    // 기존 타이머 제거
    const existingTimer = this.encounterTimers.get(encounterId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Encounter 조회
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        party: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!encounter) {
      return;
    }

    const state = encounter.stateJson as any;
    if (state.ended) {
      this.encounterTimers.delete(encounterId);
      return;
    }

    const now = Date.now();
    const deadline = encounter.turnDeadlineAt.getTime();
    const delay = Math.max(0, deadline - now) + 150;

    const timer = setTimeout(async () => {
      try {
        // 턴 해결
        const result = await this.combatService.resolveTurn(encounterId);

        if (!result) {
          this.encounterTimers.delete(encounterId);
          return;
        }

        // 파티 멤버들에게 브로드캐스트
        if (encounter.party) {
          for (const member of encounter.party.members) {
            const client = Array.from(this.clients.entries()).find(
              ([, data]) => data.characterId === member.characterId,
            )?.[0];

            if (client) {
              // COMBAT_RESOLVE 전송
              this.sendMessage(client, {
                t: 'COMBAT_RESOLVE',
                ts: Date.now(),
                p: {
                  encounterId,
                  turnNo: result.resolvePayload.turnNo,
                  actions: result.resolvePayload.actions,
                  state: result.resolvePayload.state,
                },
              });

              // 로그 전송
              for (const log of result.logs) {
                this.sendLog(client, 'COMBAT', log);
              }

              // 전투 종료 처리
              if (result.result) {
                // Quest 트리거: 전투 종료
                const char = await this.prisma.character.findUnique({
                  where: { id: member.characterId },
                  include: { room: true },
                });
                if (char) {
                  const questResult = await this.questService.onCombatEnd(member.characterId, {
                    zoneId: char.room.zoneId || undefined,
                    isBoss: encounter.isBoss || false,
                  });
                  if (questResult.changed) {
                    this.sendQuestTrack(client, member.characterId, questResult.active, questResult.completedIds);
                  }
                }

                this.sendMessage(client, {
                  t: 'COMBAT_END',
                  ts: Date.now(),
                  p: {
                    encounterId,
                    result: result.result,
                    rewards: result.endPayload?.rewards || {},
                  },
                });

                this.sendLog(
                  client,
                  'COMBAT',
                  result.result === 'WIN'
                    ? '전투에서 승리했습니다!'
                    : result.result === 'LOSE'
                      ? '전투에서 패배했습니다.'
                      : '전투에서 도주했습니다.',
                );

                await this.sendStateSync(client, member.characterId);
              }
            }
          }
        }

        // 전투 종료 시 타이머 삭제
        if (result.result) {
          this.encounterTimers.delete(encounterId);
        } else {
          // 다음 턴 스케줄링
          await this.scheduleEncounter(encounterId);
        }
      } catch (error) {
        console.error('전투 타이머 오류:', error);
        this.encounterTimers.delete(encounterId);
      }
    }, delay);

    this.encounterTimers.set(encounterId, timer);
  }

  // ============================================================
  // 인벤토리 & 장비 핸들러
  // ============================================================

  private async handleInventoryList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const inventory = await this.prisma.inventory.findMany({
      where: { characterId: clientData.characterId },
      include: { item: true },
    });

    const inventoryData = inventory.map((inv) => ({
      itemId: inv.itemId,
      name: inv.item.name,
      type: inv.item.type,
      slot: inv.item.slot,
      qty: inv.qty,
      atk: inv.item.atk,
      def: inv.item.def,
      hpBonus: inv.item.hpBonus,
      priceSell: inv.item.priceSell,
    }));

    this.sendMessage(client, {
      t: 'INVENTORY_LIST',
      reqId: message.reqId,
      ts: Date.now(),
      p: { inventory: inventoryData },
    });
  }

  private async handleEquipmentGet(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const equipment = await this.prisma.equipment.findMany({
      where: { characterId: clientData.characterId },
      include: { item: true },
    });

    const equipmentData: any = {};
    for (const eq of equipment) {
      equipmentData[eq.slot] = {
        itemId: eq.itemId,
        name: eq.item.name,
        atk: eq.item.atk,
        def: eq.item.def,
        hpBonus: eq.item.hpBonus,
      };
    }

    this.sendMessage(client, {
      t: 'EQUIPMENT_GET',
      reqId: message.reqId,
      ts: Date.now(),
      p: { equipment: equipmentData },
    });
  }

  private async handleEquip(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const { itemId } = message.p;

    if (!itemId) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'itemId가 필요합니다.');
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. 인벤토리에서 아이템 확인
        const inventory = await tx.inventory.findUnique({
          where: {
            characterId_itemId: {
              characterId: clientData.characterId!,
              itemId,
            },
          },
          include: { item: true },
        });

        if (!inventory) {
          throw new Error('인벤토리에 아이템이 없습니다.');
        }

        const item = inventory.item;
        if (!item.slot || item.type === 'consumable' || item.type === 'material') {
          throw new Error('이 아이템은 장착할 수 없습니다.');
        }

        // 2. 기존 장비 해제 (있다면)
        const existingEquipment = await tx.equipment.findUnique({
          where: {
            characterId_slot: {
              characterId: clientData.characterId!,
              slot: item.slot,
            },
          },
        });

        if (existingEquipment) {
          // 기존 장비를 인벤토리로 되돌림 (이미 있으면 생략)
          await tx.equipment.delete({
            where: {
              characterId_slot: {
                characterId: clientData.characterId!,
                slot: item.slot,
              },
            },
          });
        }

        // 3. 새 장비 장착
        await tx.equipment.upsert({
          where: {
            characterId_slot: {
              characterId: clientData.characterId!,
              slot: item.slot,
            },
          },
          create: {
            characterId: clientData.characterId!,
            slot: item.slot,
            itemId,
          },
          update: {
            itemId,
          },
        });

        this.sendLog(client, 'SYSTEM', `${item.name}을(를) 장착했습니다.`);
      });

      await this.sendStateSync(client, clientData.characterId);
    } catch (error: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', error.message);
    }
  }

  private async handleUnequip(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const { slot } = message.p;

    if (!slot) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'slot이 필요합니다.');
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const equipment = await tx.equipment.findUnique({
          where: {
            characterId_slot: {
              characterId: clientData.characterId!,
              slot,
            },
          },
          include: { item: true },
        });

        if (!equipment) {
          throw new Error('해당 슬롯에 장착된 아이템이 없습니다.');
        }

        await tx.equipment.delete({
          where: {
            characterId_slot: {
              characterId: clientData.characterId!,
              slot,
            },
          },
        });

        this.sendLog(client, 'SYSTEM', `${equipment.item.name}을(를) 해제했습니다.`);
      });

      await this.sendStateSync(client, clientData.characterId);
    } catch (error: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', error.message);
    }
  }

  // ============================================================
  // 상점 핸들러
  // ============================================================

  private async handleShopList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { roomId: true },
      });

      if (!character) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '캐릭터를 찾을 수 없습니다.');
        return;
      }

      const shop = this.shopService.listShop(character.roomId);
      if (!shop) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '이 방에서는 상점을 이용할 수 없습니다.');
        return;
      }

      // 아이템 상세 정보 조회 (이름 등)
      const itemIds = shop.items.map((entry) => entry.itemId);
      const items = await this.prisma.item.findMany({
        where: { id: { in: itemIds } },
      });

      const itemMap = new Map(items.map((item) => [item.id, item]));

      const shopItems = shop.items.map((entry) => {
        const item = itemMap.get(entry.itemId);
        return {
          itemId: entry.itemId,
          name: item?.name || entry.itemId,
          type: item?.type || 'material',
          slot: item?.slot || null,
          atk: item?.atk || 0,
          def: item?.def || 0,
          hpBonus: item?.hpBonus || 0,
          priceGold: entry.priceGold || 0,
          costItems: entry.costItems || [],
        };
      });

      this.sendMessage(client, {
        t: 'SHOP_LIST',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          shopId: shop.id,
          title: shop.title,
          items: shopItems,
        },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'SHOP_LIST_FAILED', error.message || 'SHOP_LIST 실패');
    }
  }

  private async handleShopBuy(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const { itemId } = message.p;
    if (!itemId) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'itemId가 필요합니다.');
      return;
    }

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { roomId: true },
      });

      if (!character) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '캐릭터를 찾을 수 없습니다.');
        return;
      }

      // ShopService.buyItem with reqId for idempotency
      const buyResult = await this.shopService.buyItem(
        clientData.characterId,
        character.roomId,
        itemId,
        message.reqId,
      );

      // 성공 응답 (SHOP_BUY_OK)
      this.sendMessage(client, {
        t: 'SHOP_BUY_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          itemId: buyResult.itemId,
          qty: buyResult.qty,
          cost: buyResult.cost,
          granted: buyResult.granted,
          balances: buyResult.balances,
        },
      });

      // 로그 (선택)
      const item = await this.prisma.item.findUnique({ where: { id: itemId } });
      this.sendLog(client, 'SYSTEM', `${item?.name || itemId}을(를) 구매했습니다.`);
      
      // QUEST_TRACK 푸시 (퀘스트 진행도 변경 시)
      if (buyResult.questResult.changed) {
        this.sendQuestTrack(
          client,
          clientData.characterId,
          buyResult.questResult.active,
          buyResult.questResult.completedIds,
        );
      }
      
      // STATE_SYNC는 선택적 (경량 유지)
      await this.sendStateSync(client, clientData.characterId, message.reqId);
    } catch (error: any) {
      // 실패 응답 (SHOP_BUY_ERR)
      this.sendMessage(client, {
        t: 'SHOP_BUY_ERR',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          code: 'SHOP_BUY_FAILED',
          message: error.message || 'SHOP_BUY 실패',
          itemId,
        },
      });
    }
  }

  private async handleShopSell(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const { itemId, qty = 1 } = message.p;

    if (!itemId || qty < 1) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'itemId와 qty가 필요합니다.');
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const character = await tx.character.findUnique({
          where: { id: clientData.characterId! },
        });

        if (!character || character.roomId !== 'GH_MARKET') {
          throw new Error('상점이 아닙니다.');
        }

        const inventory = await tx.inventory.findUnique({
          where: {
            characterId_itemId: {
              characterId: clientData.characterId!,
              itemId,
            },
          },
          include: { item: true },
        });

        if (!inventory || inventory.qty < qty) {
          throw new Error('인벤토리에 충분한 수량이 없습니다.');
        }

        const totalPrice = inventory.item.priceSell * qty;

        // 골드 획득
        await tx.character.update({
          where: { id: clientData.characterId! },
          data: { gold: character.gold + totalPrice },
        });

        // 인벤토리 업데이트
        if (inventory.qty === qty) {
          await tx.inventory.delete({
            where: {
              characterId_itemId: {
                characterId: clientData.characterId!,
                itemId,
              },
            },
          });
        } else {
          await tx.inventory.update({
            where: {
              characterId_itemId: {
                characterId: clientData.characterId!,
                itemId,
              },
            },
            data: { qty: inventory.qty - qty },
          });
        }

        this.sendLog(client, 'SYSTEM', `${inventory.item.name} x${qty}을(를) ${totalPrice}골드에 판매했습니다.`);
      });

      await this.sendStateSync(client, clientData.characterId);
    } catch (error: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', error.message);
    }
  }

  // ============================================================
  // 회복 & 포션 핸들러
  // ============================================================

  private async handleRest(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const REST_COOLDOWN_MS = 3000; // 3초

    try {
      await this.prisma.$transaction(async (tx) => {
        const character = await tx.character.findUnique({
          where: { id: clientData.characterId! },
          include: { room: true },
        });

        if (!character) {
          throw new Error('캐릭터를 찾을 수 없습니다.');
        }

        // SAFE 태그 확인
        const tags = (character.room.tags as any) || [];
        const isSafe = Array.isArray(tags) && tags.includes('SAFE');

        if (!isSafe) {
          throw new Error('안전 지대에서만 휴식할 수 있습니다.');
        }

        // 쿨다운 확인
        if (character.lastRestAt) {
          const elapsed = Date.now() - character.lastRestAt.getTime();
          if (elapsed < REST_COOLDOWN_MS) {
            const remaining = Math.ceil((REST_COOLDOWN_MS - elapsed) / 1000);
            throw new Error(`휴식은 ${remaining}초 후에 가능합니다.`);
          }
        }

        // HP 회복
        await tx.character.update({
          where: { id: clientData.characterId! },
          data: {
            hp: character.hpMax,
            lastRestAt: new Date(),
          },
        });

        this.sendLog(client, 'SYSTEM', `휴식을 취했습니다. HP가 전부 회복되었습니다. (${character.hpMax}/${character.hpMax})`);
      });

      await this.sendStateSync(client, clientData.characterId);
    } catch (error: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', error.message);
    }
  }

  private async handleQuestList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { roomId: true },
      });

      if (!character) {
        throw new Error('캐릭터를 찾을 수 없습니다.');
      }

      const available = await this.questService.listAvailable(clientData.characterId, character.roomId);
      const active = await this.questService.listActive(clientData.characterId);

      this.sendMessage(client, {
        t: 'QUEST_LIST',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          available: available.map(q => ({
            questId: q.questId,
            title: q.title,
            description: q.description,
            giverRoomId: q.giverRoomId,
            turninRoomId: q.turninRoomId,
            repeatable: q.repeatable,
            cadence: q.cadence,
          })),
          active: active.map(q => ({
            questId: q.questId,
            title: q.title,
            status: q.status,
            progressSummary: q.progressSummary,
            giverRoomId: q.giverRoomId,
            turninRoomId: q.turninRoomId,
            repeatable: q.repeatable,
            cadence: q.cadence,
          })),
        },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'QUEST_LIST_FAILED', error.message || '퀘스트 목록 조회 실패');
    }
  }

  private async handleQuestAccept(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const { questId } = message.p;

      if (!questId) {
        throw new Error('questId가 필요합니다.');
      }

      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { roomId: true },
      });

      if (!character) {
        throw new Error('캐릭터를 찾을 수 없습니다.');
      }

      await this.questService.acceptQuest(clientData.characterId, questId, character.roomId);

      this.sendLog(client, 'SYSTEM', `퀘스트를 수락했습니다: ${questId}`);

      // QUEST_LIST 푸시
      const available = await this.questService.listAvailable(clientData.characterId, character.roomId);
      const active = await this.questService.listActive(clientData.characterId);

      this.sendMessage(client, {
        t: 'QUEST_LIST',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          available: available.map(q => ({
            questId: q.questId,
            title: q.title,
            description: q.description,
            giverRoomId: q.giverRoomId,
            turninRoomId: q.turninRoomId,
            repeatable: q.repeatable,
            cadence: q.cadence,
          })),
          active: active.map(q => ({
            questId: q.questId,
            title: q.title,
            status: q.status,
            progressSummary: q.progressSummary,
            giverRoomId: q.giverRoomId,
            turninRoomId: q.turninRoomId,
            repeatable: q.repeatable,
            cadence: q.cadence,
          })),
        },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'QUEST_ACCEPT_FAILED', error.message || '퀘스트 수락 실패');
    }
  }

  private async handleQuestTurnin(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const { questId } = message.p;

      if (!questId) {
        throw new Error('questId가 필요합니다.');
      }

      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { roomId: true },
      });

      if (!character) {
        throw new Error('캐릭터를 찾을 수 없습니다.');
      }

      const rewards = await this.questService.turnIn(clientData.characterId, questId, character.roomId);

      this.sendLog(client, 'SYSTEM', `퀘스트 완료! 보상: 골드 ${rewards.gold}, 경험치 ${rewards.exp}`);

      // STATE_SYNC 푸시
      await this.sendStateSync(client, clientData.characterId, message.reqId);

      // QUEST_LIST 푸시
      const available = await this.questService.listAvailable(clientData.characterId, character.roomId);
      const active = await this.questService.listActive(clientData.characterId);

      this.sendMessage(client, {
        t: 'QUEST_LIST',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          available: available.map(q => ({
            questId: q.questId,
            title: q.title,
            description: q.description,
            giverRoomId: q.giverRoomId,
            turninRoomId: q.turninRoomId,
            repeatable: q.repeatable,
            cadence: q.cadence,
          })),
          active: active.map(q => ({
            questId: q.questId,
            title: q.title,
            status: q.status,
            progressSummary: q.progressSummary,
            giverRoomId: q.giverRoomId,
            turninRoomId: q.turninRoomId,
            repeatable: q.repeatable,
            cadence: q.cadence,
          })),
        },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'QUEST_TURNIN_FAILED', error.message || '퀘스트 제출 실패');
    }
  }

  private async handleDebugCommand(client: WSClient, message: WSMessage) {
    // TEST_MODE 가드: 운영 환경에서는 절대 허용하지 않음
    if (process.env.TEST_MODE !== 'true') {
      console.warn(`[SECURITY] TEST_MODE가 아닌데 DEBUG 명령 시도: ${message.t}`);
      this.sendError(client, message.reqId, 'FORBIDDEN', 'DEBUG 명령은 TEST_MODE에서만 사용 가능합니다.');
      return;
    }

    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      switch (message.t) {
        case 'DEBUG_GRANT_GOLD': {
          const { amount } = message.p;
          if (typeof amount !== 'number' || amount < 0) {
            throw new Error('amount는 0 이상의 숫자여야 합니다.');
          }

          await this.prisma.$transaction(async (tx) => {
            const character = await tx.character.findUnique({ where: { id: clientData.characterId! } });
            if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');

            await tx.character.update({
              where: { id: clientData.characterId! },
              data: { gold: character.gold + amount },
            });
          });

          this.sendLog(client, 'SYSTEM', `[DEBUG] 골드 ${amount} 지급됨`);
          await this.sendStateSync(client, clientData.characterId, message.reqId);
          break;
        }

        case 'DEBUG_SET_HP': {
          const { hp } = message.p;
          if (typeof hp !== 'number' || hp < 0) {
            throw new Error('hp는 0 이상의 숫자여야 합니다.');
          }

          await this.prisma.$transaction(async (tx) => {
            const character = await tx.character.findUnique({ where: { id: clientData.characterId! } });
            if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');

            const clampedHp = Math.min(Math.max(0, hp), character.hpMax);
            await tx.character.update({
              where: { id: clientData.characterId! },
              data: { hp: clampedHp },
            });
          });

          this.sendLog(client, 'SYSTEM', `[DEBUG] HP를 ${hp}로 설정`);
          await this.sendStateSync(client, clientData.characterId, message.reqId);
          break;
        }

        case 'DEBUG_APPLY_DEATH': {
          await this.combatService.applyDeath(clientData.characterId);
          this.sendLog(client, 'SYSTEM', `[DEBUG] 사망 처리 적용됨. START_TOWN에서 부활합니다.`);
          await this.sendStateSync(client, clientData.characterId, message.reqId);
          break;
        }

        case 'DEBUG_GRANT_ITEM': {
          const { itemId, qty } = message.p;
          if (!itemId || typeof qty !== 'number' || qty < 1) {
            throw new Error('itemId와 qty(1 이상)가 필요합니다.');
          }

          console.log(`[DEBUG_GRANT_ITEM] reqId=${message.reqId}, itemId=${itemId}, qty=${qty}`);

          await this.prisma.inventory.upsert({
            where: {
              characterId_itemId: { characterId: clientData.characterId, itemId },
            },
            create: {
              characterId: clientData.characterId,
              itemId,
              qty,
            },
            update: {
              qty: { increment: qty },
            },
          });

          console.log(`[DEBUG_GRANT_ITEM] inventory upsert 완료`);
          console.log(`[DEBUG_GRANT_ITEM] sendLog 호출 전, client.readyState=${client.readyState}`);
          this.sendLog(client, 'SYSTEM', `[DEBUG] ${itemId} x${qty} 지급됨`);
          console.log(`[DEBUG_GRANT_ITEM] sendLog 호출 후, client.readyState=${client.readyState}`);
          console.log(`[DEBUG_GRANT_ITEM] sendStateSync 호출 전, reqId=${message.reqId}`);
          await this.sendStateSync(client, clientData.characterId, message.reqId);
          console.log(`[DEBUG_GRANT_ITEM] sendStateSync 호출 후`);
          break;
        }
      }
    } catch (error: any) {
      console.error(`[handleDebugCommand] ERROR:`, error);
      console.error(`[handleDebugCommand] ERROR message:`, error.message);
      console.error(`[handleDebugCommand] ERROR stack:`, error.stack);
      this.sendError(client, message.reqId, 'DEBUG_FAILED', error.message || 'DEBUG 명령 실패');
    }
  }

  private async handleSeasonStatus(client: WSClient, message: WSMessage) {
    try {
      const seasonStatus = this.seasonService.getSeasonStatus();
      this.sendMessage(client, {
        t: 'SEASON_STATUS',
        reqId: message.reqId,
        ts: Date.now(),
        p: seasonStatus,
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'SEASON_STATUS_FAILED', error.message || '시즌 상태 조회 실패');
    }
  }

  private async sendPartySyncToAll(partyId: string) {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: {
        members: {
          include: {
            character: true,
          },
        },
      },
    });

    if (!party) return;

    const code = this.partyService.getPartyCodeByPartyId(partyId);
    const payload = {
      partyId: party.id,
      code: code || party.code || '',
      leaderCharacterId: party.leaderCharacterId,
      members: party.members.map((m) => ({
        characterId: m.characterId,
        name: m.character.name,
        level: m.character.level,
        roomId: m.character.roomId,
      })),
      ts: Date.now(),
    };

    // 모든 파티 멤버에게 푸시
    for (const member of party.members) {
      const targetClient = Array.from(this.clients.entries()).find(
        ([, data]) => data.characterId === member.characterId
      )?.[0];

      if (targetClient) {
        this.sendMessage(targetClient, {
          t: 'PARTY_SYNC',
          reqId: undefined,
          ts: Date.now(),
          p: payload,
        });
      }
    }
  }

  private async handlePartyInfo(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const party = await this.partyService.getPartyByCharacter(clientData.characterId);
      
      if (!party) {
        this.sendMessage(client, {
          t: 'PARTY_SYNC',
          reqId: message.reqId,
          ts: Date.now(),
          p: null,
        });
        return;
      }

      const code = this.partyService.getPartyCodeByPartyId(party.id);
      const payload = {
        partyId: party.id,
        code: code || party.code || '',
        leaderCharacterId: party.leaderCharacterId,
        members: await Promise.all(party.members.map(async (m) => {
          const char = await this.prisma.character.findUnique({ where: { id: m.characterId } });
          return {
            characterId: m.characterId,
            name: char?.name || '',
            level: char?.level || 1,
            roomId: char?.roomId || '',
          };
        })),
        ts: Date.now(),
      };

      this.sendMessage(client, {
        t: 'PARTY_SYNC',
        reqId: message.reqId,
        ts: Date.now(),
        p: payload,
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'PARTY_INFO_FAILED', error.message || '파티 정보 조회 실패');
    }
  }

  private async handleUseItem(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const { itemId, qty = 1 } = message.p;

    if (!itemId || qty < 1) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'itemId와 qty가 필요합니다.');
      return;
    }

    try {
      // 특수 itemId: 코스메틱 해제
      if (itemId === '__UNEQUIP_ICON__') {
        await this.prisma.character.update({
          where: { id: clientData.characterId },
          data: { cosmeticIconItemId: null },
        });
        this.sendLog(client, 'SYSTEM', '아이콘을 해제했습니다.');
        await this.sendStateSync(client, clientData.characterId, message.reqId);
        return;
      }

      if (itemId === '__UNEQUIP_TITLE__') {
        await this.prisma.character.update({
          where: { id: clientData.characterId },
          data: { cosmeticTitleItemId: null },
        });
        this.sendLog(client, 'SYSTEM', '칭호를 해제했습니다.');
        await this.sendStateSync(client, clientData.characterId, message.reqId);
        return;
      }

      await this.prisma.$transaction(async (tx) => {
        const character = await tx.character.findUnique({
          where: { id: clientData.characterId! },
        });

        if (!character) {
          throw new Error('캐릭터를 찾을 수 없습니다.');
        }

        // 인벤토리 확인
        const inventory = await tx.inventory.findUnique({
          where: {
            characterId_itemId: {
              characterId: clientData.characterId!,
              itemId,
            },
          },
          include: { item: true },
        });

        if (!inventory || inventory.qty < qty) {
          throw new Error('아이템이 부족합니다.');
        }

        const item = inventory.item;

        // 코스메틱 아이템 처리 (아이콘/칭호) - prefix 기반으로 확장
        const isIconCosmetic = itemId.startsWith('ITEM_ICON_');
        const isTitleCosmetic = itemId.startsWith('ITEM_TITLE_');

        if (isIconCosmetic || isTitleCosmetic) {
          // 코스메틱 아이템은 장착(적용) 처리
          const updateData: any = {};
          let logMessage = '';

          if (isIconCosmetic) {
            updateData.cosmeticIconItemId = itemId;
            logMessage = `아이콘을 적용했습니다: ${item.name}`;
          } else if (isTitleCosmetic) {
            updateData.cosmeticTitleItemId = itemId;
            logMessage = `칭호를 적용했습니다: ${item.name}`;
          }

          await tx.character.update({
            where: { id: clientData.characterId! },
            data: updateData,
          });

          this.sendLog(client, 'SYSTEM', logMessage);
          // 코스메틱은 소비되지 않음 (인벤토리 유지)
        } else if (item.type === 'consumable') {
          // 기존 소비 아이템 로직
          const effectJson = item.effectJson as any;
          let healAmount = 0;

          if (effectJson && effectJson.heal) {
            healAmount = effectJson.heal * qty;
            const newHp = Math.min(character.hp + healAmount, character.hpMax);
            const actualHeal = newHp - character.hp;

            await tx.character.update({
              where: { id: clientData.characterId! },
              data: { hp: newHp },
            });

            this.sendLog(client, 'SYSTEM', `${item.name} x${qty}을(를) 사용했습니다. HP +${actualHeal} (${newHp}/${character.hpMax})`);
          }

          // 인벤토리 감소 (소비 아이템만)
          if (inventory.qty === qty) {
            await tx.inventory.delete({
              where: {
                characterId_itemId: {
                  characterId: clientData.characterId!,
                  itemId,
                },
              },
            });
          } else {
            await tx.inventory.update({
              where: {
                characterId_itemId: {
                  characterId: clientData.characterId!,
                  itemId,
                },
              },
              data: { qty: inventory.qty - qty },
            });
          }
        } else {
          throw new Error('사용할 수 없는 아이템입니다.');
        }
      });

      await this.sendStateSync(client, clientData.characterId);
    } catch (error: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', error.message);
    }
  }
}

