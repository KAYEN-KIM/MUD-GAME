import WebSocket from 'ws';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../utils/jwt';
import { WSMessage, ErrorPayload, LogAppendPayload, StateSyncPayload } from '../types/messages';
import { moveCharacter } from '../game/movement';
import {
  createParty,
  getCharacterParty,
  inviteToParty,
  joinParty,
  leaveParty,
  setPartyLeader,
  setFollow,
  setSpeedMode,
  setPreset
} from '../game/party';
import { createEncounter, getEncounter } from '../game/encounter';
import { processCombatTurn, setCombatAction, useTimeBank } from '../game/combat';
import { sendChatMessage } from '../game/chat';
import { createReport } from '../game/report';
import { checkHuntRateLimit } from '../utils/rateLimit';

const prisma = new PrismaClient();

interface WSClient {
  ws: WebSocket;
  userId?: string;
  characterId?: string;
  authenticated: boolean;
}

const clients = new Map<WebSocket, WSClient>();

function sendMessage(ws: WebSocket, message: WSMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws: WebSocket, reqId: string | undefined, code: string, message: string) {
  sendMessage(ws, {
    t: 'ERROR',
    reqId,
    ts: Date.now(),
    p: {
      code,
      message
    } as ErrorPayload
  });
}

function sendLog(ws: WebSocket, text: string, type: 'info' | 'combat' | 'chat' | 'system' = 'info') {
  sendMessage(ws, {
    t: 'LOG_APPEND',
    ts: Date.now(),
    p: {
      text,
      type
    } as LogAppendPayload
  });
}

async function sendStateSync(ws: WebSocket, characterId: string) {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: {
      currentRoom: {
        include: {
          exits: {
            select: {
              direction: true,
              toRoomId: true
            }
          }
        }
      }
    }
  });

  if (!character) {
    return;
  }

  const party = await getCharacterParty(characterId);

  const stateSync: StateSyncPayload = {
    character: {
      id: character.id,
      name: character.name,
      level: character.level,
      hp: character.hp,
      maxHp: character.maxHp,
      mp: character.mp,
      maxMp: character.maxMp,
      currentRoomId: character.currentRoomId
    },
    room: {
      id: character.currentRoom.id,
      name: character.currentRoom.name,
      description: character.currentRoom.description,
      exits: character.currentRoom.exits.map(e => ({
        direction: e.direction,
        toRoomId: e.toRoomId
      }))
    }
  };

  if (party) {
    stateSync.party = {
      id: party.id,
      leaderId: party.leaderId,
      speedMode: party.speedMode,
      members: party.members
    };
  }

  sendMessage(ws, {
    t: 'STATE_SYNC',
    ts: Date.now(),
    p: stateSync
  });
}

export function setupWebSocketServer(wss: WebSocket.Server) {
  wss.on('connection', (ws: WebSocket) => {
    const client: WSClient = {
      ws,
      authenticated: false
    };
    clients.set(ws, client);

    ws.on('message', async (data: WebSocket.Data) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());

        if (!message.t || !message.ts) {
          sendError(ws, message.reqId, 'INVALID_STATE', '잘못된 메시지 형식입니다.');
          return;
        }

        // 인증이 필요한 메시지 처리
        if (message.t !== 'AUTH') {
          if (!client.authenticated || !client.characterId) {
            sendError(ws, message.reqId, 'FORBIDDEN', '인증이 필요합니다.');
            return;
          }
        }

        await handleMessage(ws, client, message);
      } catch (error: any) {
        console.error('Message handling error:', error);
        sendError(ws, undefined, 'INVALID_STATE', error.message || '메시지 처리 중 오류가 발생했습니다.');
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });
}

async function handleMessage(ws: WebSocket, client: WSClient, message: WSMessage) {
  switch (message.t) {
    case 'AUTH':
      await handleAuth(ws, client, message);
      break;

    case 'MOVE':
      await handleMove(ws, client, message);
      break;

    case 'HUNT':
      await handleHunt(ws, client, message);
      break;

    case 'PARTY_CREATE':
      await handlePartyCreate(ws, client, message);
      break;

    case 'PARTY_INVITE':
      await handlePartyInvite(ws, client, message);
      break;

    case 'PARTY_JOIN':
      await handlePartyJoin(ws, client, message);
      break;

    case 'PARTY_LEAVE':
      await handlePartyLeave(ws, client, message);
      break;

    case 'PARTY_SET_LEADER':
      await handlePartySetLeader(ws, client, message);
      break;

    case 'PARTY_FOLLOW_SET':
      await handlePartyFollowSet(ws, client, message);
      break;

    case 'PARTY_SPEED_SET':
      await handlePartySpeedSet(ws, client, message);
      break;

    case 'PARTY_PRESET_SET':
      await handlePartyPresetSet(ws, client, message);
      break;

    case 'COMBAT_TURN':
      await handleCombatTurn(ws, client, message);
      break;

    case 'COMBAT_TIMEBANK_USE':
      await handleCombatTimebankUse(ws, client, message);
      break;

    case 'CHAT_SEND':
      await handleChatSend(ws, client, message);
      break;

    case 'REPORT_CREATE':
      await handleReportCreate(ws, client, message);
      break;

    default:
      sendError(ws, message.reqId, 'INVALID_STATE', `알 수 없는 메시지 타입: ${message.t}`);
  }
}

async function handleAuth(ws: WebSocket, client: WSClient, message: WSMessage) {
  const { token } = message.p;

  if (!token) {
    sendMessage(ws, {
      t: 'AUTH_FAIL',
      reqId: message.reqId,
      ts: Date.now(),
      p: {
        reason: '토큰이 필요합니다.'
      }
    });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    sendMessage(ws, {
      t: 'AUTH_FAIL',
      reqId: message.reqId,
      ts: Date.now(),
      p: {
        reason: '유효하지 않은 토큰입니다.'
      }
    });
    return;
  }

  const character = await prisma.character.findUnique({
    where: { id: payload.characterId }
  });

  if (!character) {
    sendMessage(ws, {
      t: 'AUTH_FAIL',
      reqId: message.reqId,
      ts: Date.now(),
      p: {
        reason: '캐릭터를 찾을 수 없습니다.'
      }
    });
    return;
  }

  client.userId = payload.userId;
  client.characterId = payload.characterId;
  client.authenticated = true;

  sendMessage(ws, {
    t: 'AUTH_OK',
    reqId: message.reqId,
    ts: Date.now(),
    p: {
      characterId: character.id,
      characterName: character.name,
      currentRoomId: character.currentRoomId
    }
  });

  // 초기 상태 동기화
  await sendStateSync(ws, character.id);
  sendLog(ws, `${character.name}으로 접속했습니다.`, 'system');
}

async function handleMove(ws: WebSocket, client: WSClient, message: WSMessage) {
  const { direction } = message.p;

  if (!direction) {
    sendError(ws, message.reqId, 'INVALID_STATE', '방향이 필요합니다.');
    return;
  }

  const result = await moveCharacter(client.characterId!, direction);

  if (result.success) {
    if (result.log) {
      sendLog(ws, result.log.text, result.log.type);
    }
    if (result.stateSync) {
      sendMessage(ws, {
        t: 'STATE_SYNC',
        reqId: message.reqId,
        ts: Date.now(),
        p: result.stateSync
      });
    }
  } else {
    if (result.log) {
      sendLog(ws, result.log.text, result.log.type);
    }
    sendError(ws, message.reqId, 'INVALID_STATE', result.error || '이동에 실패했습니다.');
  }
}

async function handleHunt(ws: WebSocket, client: WSClient, message: WSMessage) {
  // 레이트 리밋 체크
  const rateLimit = await checkHuntRateLimit(client.characterId!);
  if (!rateLimit.allowed) {
    sendError(ws, message.reqId, 'RATE_LIMIT', '사냥 속도가 너무 빠릅니다.');
    return;
  }

  const character = await prisma.character.findUnique({
    where: { id: client.characterId! }
  });

  if (!character) {
    sendError(ws, message.reqId, 'NOT_FOUND', '캐릭터를 찾을 수 없습니다.');
    return;
  }

  // 파티 확인
  const party = await getCharacterParty(character.id);
  if (!party) {
    sendError(ws, message.reqId, 'INVALID_STATE', '파티에 속해 있지 않습니다.');
    return;
  }

  // 인카운터 생성
  try {
    const encounterId = await createEncounter(
      character.currentRoomId,
      party.id,
      party.speedMode
    );

    const encounter = await getEncounter(encounterId);
    if (encounter) {
      sendMessage(ws, {
        t: 'ENCOUNTER_START',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          encounterId: encounter.id,
          turnNumber: encounter.turnNumber,
          turnEndsAt: encounter.turnEndsAt.getTime(),
          participants: encounter.participants.map(p => ({
            id: p.id,
            name: p.character?.name || p.monster?.name || 'Unknown',
            isPlayer: p.isPlayer,
            hp: p.hp,
            maxHp: p.maxHp
          }))
        }
      });

      sendLog(ws, '전투가 시작되었습니다!', 'combat');

      // 전투 턴 처리 시작 (타이머 기반)
      startCombatTimer(encounterId, party.speedMode);
    }
  } catch (error: any) {
    sendError(ws, message.reqId, 'INVALID_STATE', error.message || '인카운터 생성에 실패했습니다.');
  }
}

async function handlePartyCreate(ws: WebSocket, client: WSClient, message: WSMessage) {
  try {
    const party = await createParty(client.characterId!);

    sendMessage(ws, {
      t: 'PARTY_CREATE',
      reqId: message.reqId,
      ts: Date.now(),
      p: party
    });

    sendLog(ws, '파티를 생성했습니다.', 'system');
    await sendStateSync(ws, client.characterId!);
  } catch (error: any) {
    sendError(ws, message.reqId, 'INVALID_STATE', error.message || '파티 생성에 실패했습니다.');
  }
}

async function handlePartyInvite(ws: WebSocket, client: WSClient, message: WSMessage) {
  const { characterName } = message.p;

  if (!characterName) {
    sendError(ws, message.reqId, 'INVALID_STATE', '캐릭터 이름이 필요합니다.');
    return;
  }

  const party = await getCharacterParty(client.characterId!);
  if (!party) {
    sendError(ws, message.reqId, 'INVALID_STATE', '파티에 속해 있지 않습니다.');
    return;
  }

  try {
    await inviteToParty(party.id, client.characterId!, characterName);
    sendLog(ws, `${characterName}에게 파티 초대를 보냈습니다.`, 'system');
  } catch (error: any) {
    sendError(ws, message.reqId, 'INVALID_STATE', error.message || '초대에 실패했습니다.');
  }
}

async function handlePartyJoin(ws: WebSocket, client: WSClient, message: WSMessage) {
  const { partyId } = message.p;

  if (!partyId) {
    sendError(ws, message.reqId, 'INVALID_STATE', '파티 ID가 필요합니다.');
    return;
  }

  try {
    const party = await joinParty(partyId, client.characterId!);
    sendMessage(ws, {
      t: 'PARTY_JOIN',
      reqId: message.reqId,
      ts: Date.now(),
      p: party
    });
    sendLog(ws, '파티에 참가했습니다.', 'system');
    await sendStateSync(ws, client.characterId!);
  } catch (error: any) {
    sendError(ws, message.reqId, 'INVALID_STATE', error.message || '파티 참가에 실패했습니다.');
  }
}

async function handlePartyLeave(ws: WebSocket, client: WSClient, message: WSMessage) {
  try {
    await leaveParty(client.characterId!);
    sendMessage(ws, {
      t: 'PARTY_LEAVE',
      reqId: message.reqId,
      ts: Date.now(),
      p: {}
    });
    sendLog(ws, '파티를 떠났습니다.', 'system');
    await sendStateSync(ws, client.characterId!);
  } catch (error: any) {
    sendError(ws, message.reqId, 'INVALID_STATE', error.message || '파티 탈퇴에 실패했습니다.');
  }
}

async function handlePartySetLeader(ws: WebSocket, client: WSClient, message: WSMessage) {
  const { characterId } = message.p;

  if (!characterId) {
    sendError(ws, message.reqId, 'INVALID_STATE', '캐릭터 ID가 필요합니다.');
    return;
  }

  const party = await getCharacterParty(client.characterId!);
  if (!party) {
    sendError(ws, message.reqId, 'INVALID_STATE', '파티에 속해 있지 않습니다.');
    return;
  }

  try {
    const updatedParty = await setPartyLeader(party.id, characterId, client.characterId!);
    sendMessage(ws, {
      t: 'PARTY_SET_LEADER',
      reqId: message.reqId,
      ts: Date.now(),
      p: updatedParty
    });
    await sendStateSync(ws, client.characterId!);
  } catch (error: any) {
    sendError(ws, message.reqId, 'INVALID_STATE', error.message || '리더 변경에 실패했습니다.');
  }
}

async function handlePartyFollowSet(ws: WebSocket, client: WSClient, message: WSMessage) {
  const { follow } = message.p;

  if (typeof follow !== 'boolean') {
    sendError(ws, message.reqId, 'INVALID_STATE', 'follow 값이 필요합니다.');
    return;
  }

  try {
    await setFollow(client.characterId!, follow);
    sendMessage(ws, {
      t: 'PARTY_FOLLOW_SET',
      reqId: message.reqId,
      ts: Date.now(),
      p: { follow }
    });
    await sendStateSync(ws, client.characterId!);
  } catch (error: any) {
    sendError(ws, message.reqId, 'INVALID_STATE', error.message || '팔로우 설정에 실패했습니다.');
  }
}

async function handlePartySpeedSet(ws: WebSocket, client: WSClient, message: WSMessage) {
  const { speedMode } = message.p;

  if (!speedMode || (speedMode !== 'FAST' && speedMode !== 'TACTICAL')) {
    sendError(ws, message.reqId, 'INVALID_STATE', '유효한 속도 모드가 필요합니다.');
    return;
  }

  const party = await getCharacterParty(client.characterId!);
  if (!party) {
    sendError(ws, message.reqId, 'INVALID_STATE', '파티에 속해 있지 않습니다.');
    return;
  }

  try {
    await setSpeedMode(party.id, speedMode, client.characterId!);
    sendMessage(ws, {
      t: 'PARTY_SPEED_SET',
      reqId: message.reqId,
      ts: Date.now(),
      p: { speedMode }
    });
    await sendStateSync(ws, client.characterId!);
  } catch (error: any) {
    sendError(ws, message.reqId, 'INVALID_STATE', error.message || '속도 설정에 실패했습니다.');
  }
}

async function handlePartyPresetSet(ws: WebSocket, client: WSClient, message: WSMessage) {
  const { preset } = message.p;

  if (!preset) {
    sendError(ws, message.reqId, 'INVALID_STATE', '프리셋이 필요합니다.');
    return;
  }

  try {
    await setPreset(client.characterId!, preset);
    sendMessage(ws, {
      t: 'PARTY_PRESET_SET',
      reqId: message.reqId,
      ts: Date.now(),
      p: { preset }
    });
  } catch (error: any) {
    sendError(ws, message.reqId, 'INVALID_STATE', error.message || '프리셋 설정에 실패했습니다.');
  }
}

async function handleCombatTurn(ws: WebSocket, client: WSClient, message: WSMessage) {
  const { action, targetId } = message.p;

  if (!action) {
    sendError(ws, message.reqId, 'INVALID_STATE', '행동이 필요합니다.');
    return;
  }

  // 현재 인카운터 찾기
  const character = await prisma.character.findUnique({
    where: { id: client.characterId! }
  });

  if (!character) {
    sendError(ws, message.reqId, 'NOT_FOUND', '캐릭터를 찾을 수 없습니다.');
    return;
  }

  const party = await getCharacterParty(character.id);
  if (!party) {
    sendError(ws, message.reqId, 'INVALID_STATE', '파티에 속해 있지 않습니다.');
    return;
  }

  // 활성 인카운터 찾기
  const encounter = await prisma.encounter.findFirst({
    where: {
      partyId: party.id,
      status: 'ACTIVE'
    }
  });

  if (!encounter) {
    sendError(ws, message.reqId, 'INVALID_STATE', '활성 전투가 없습니다.');
    return;
  }

  try {
    await setCombatAction(encounter.id, character.id, action, targetId);
    sendMessage(ws, {
      t: 'COMBAT_TURN',
      reqId: message.reqId,
      ts: Date.now(),
      p: { action, targetId }
    });
  } catch (error: any) {
    sendError(ws, message.reqId, 'INVALID_STATE', error.message || '행동 설정에 실패했습니다.');
  }
}

async function handleCombatTimebankUse(ws: WebSocket, client: WSClient, message: WSMessage) {
  const character = await prisma.character.findUnique({
    where: { id: client.characterId! }
  });

  if (!character) {
    sendError(ws, message.reqId, 'NOT_FOUND', '캐릭터를 찾을 수 없습니다.');
    return;
  }

  const party = await getCharacterParty(character.id);
  if (!party) {
    sendError(ws, message.reqId, 'INVALID_STATE', '파티에 속해 있지 않습니다.');
    return;
  }

  const encounter = await prisma.encounter.findFirst({
    where: {
      partyId: party.id,
      status: 'ACTIVE'
    }
  });

  if (!encounter) {
    sendError(ws, message.reqId, 'INVALID_STATE', '활성 전투가 없습니다.');
    return;
  }

  try {
    await useTimeBank(encounter.id, party.id, client.characterId!);
    sendMessage(ws, {
      t: 'COMBAT_TIMEBANK_USE',
      reqId: message.reqId,
      ts: Date.now(),
      p: {}
    });
    sendLog(ws, '타임뱅크를 사용했습니다. (+6초)', 'combat');
  } catch (error: any) {
    sendError(ws, message.reqId, 'INVALID_STATE', error.message || '타임뱅크 사용에 실패했습니다.');
  }
}

async function handleChatSend(ws: WebSocket, client: WSClient, message: WSMessage) {
  const { message: chatMessage, type } = message.p;

  if (!chatMessage || typeof chatMessage !== 'string') {
    sendError(ws, message.reqId, 'INVALID_STATE', '채팅 메시지가 필요합니다.');
    return;
  }

  const result = await sendChatMessage(
    client.characterId!,
    chatMessage,
    type || 'ROOM'
  );

  if (result.success) {
    sendMessage(ws, {
      t: 'CHAT_SEND',
      reqId: message.reqId,
      ts: Date.now(),
      p: { messageId: result.messageId }
    });
  } else {
    sendError(ws, message.reqId, 'RATE_LIMIT', result.error || '채팅 전송에 실패했습니다.');
  }
}

async function handleReportCreate(ws: WebSocket, client: WSClient, message: WSMessage) {
  const { reportedCharacterId, reportedMessageId, reason } = message.p;

  if (!reason) {
    sendError(ws, message.reqId, 'INVALID_STATE', '신고 사유가 필요합니다.');
    return;
  }

  const character = await prisma.character.findUnique({
    where: { id: client.characterId! }
  });

  if (!character) {
    sendError(ws, message.reqId, 'NOT_FOUND', '캐릭터를 찾을 수 없습니다.');
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: client.userId! }
  });

  if (!user) {
    sendError(ws, message.reqId, 'NOT_FOUND', '유저를 찾을 수 없습니다.');
    return;
  }

  const result = await createReport(
    user.id,
    reportedCharacterId || null,
    reportedMessageId || null,
    reason
  );

  if (result.success) {
    sendMessage(ws, {
      t: 'REPORT_CREATE',
      reqId: message.reqId,
      ts: Date.now(),
      p: { reportId: result.reportId }
    });
    sendLog(ws, '신고가 접수되었습니다.', 'system');
  } else {
    sendError(ws, message.reqId, 'INVALID_STATE', result.error || '신고 생성에 실패했습니다.');
  }
}

// 전투 타이머 관리
const combatTimers = new Map<string, NodeJS.Timeout>();

function startCombatTimer(encounterId: string, speedMode: 'FAST' | 'TACTICAL') {
  // 기존 타이머 제거
  const existingTimer = combatTimers.get(encounterId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const duration = speedMode === 'FAST' ? 6000 : 9000;

  const timer = setTimeout(async () => {
    try {
      const encounter = await prisma.encounter.findUnique({
        where: { id: encounterId },
        include: {
          party: {
            include: {
              members: {
                include: {
                  character: true
                }
              }
            }
          }
        }
      });

      if (!encounter || encounter.status !== 'ACTIVE') {
        combatTimers.delete(encounterId);
        return;
      }

      // 전투 턴 처리
      await processCombatTurn(encounterId);

      // 전투 상태 확인
      const updatedEncounter = await prisma.encounter.findUnique({
        where: { id: encounterId },
        include: {
          participants: true
        }
      });

      if (updatedEncounter && updatedEncounter.status === 'ACTIVE') {
        // 다음 턴 시작
        const players = updatedEncounter.participants.filter(p => p.isPlayer);
        const monsters = updatedEncounter.participants.filter(p => !p.isPlayer);

        if (players.length > 0 && monsters.length > 0) {
          // 모든 파티 멤버에게 전투 상태 전송
          if (encounter.party) {
            for (const member of encounter.party.members) {
              const client = Array.from(clients.values()).find(
                c => c.characterId === member.characterId
              );
              if (client) {
                sendMessage(client.ws, {
                  t: 'COMBAT_TURN',
                  ts: Date.now(),
                  p: {
                    encounterId: updatedEncounter.id,
                    turnNumber: updatedEncounter.turnNumber,
                    turnEndsAt: updatedEncounter.turnEndsAt.getTime(),
                    participants: updatedEncounter.participants.map(p => ({
                      id: p.id,
                      name: p.character?.name || p.monster?.name || 'Unknown',
                      isPlayer: p.isPlayer,
                      hp: p.hp,
                      maxHp: p.maxHp
                    }))
                  }
                });
              }
            }
          }

          startCombatTimer(encounterId, updatedEncounter.speedMode);
        } else {
          // 전투 종료
          await prisma.encounter.update({
            where: { id: encounterId },
            data: { status: 'RESOLVED' }
          });

          // 모든 파티 멤버에게 전투 종료 알림
          if (encounter.party) {
            for (const member of encounter.party.members) {
              const client = Array.from(clients.values()).find(
                c => c.characterId === member.characterId
              );
              if (client) {
                sendMessage(client.ws, {
                  t: 'COMBAT_END',
                  ts: Date.now(),
                  p: {
                    encounterId: updatedEncounter.id,
                    victory: players.length > 0
                  }
                });
                sendLog(client.ws, players.length > 0 ? '전투에서 승리했습니다!' : '전투에서 패배했습니다.', 'combat');
                await sendStateSync(client.ws, member.characterId);
              }
            }
          }

          combatTimers.delete(encounterId);
        }
      } else {
        combatTimers.delete(encounterId);
      }
    } catch (error) {
      console.error('Combat timer error:', error);
      combatTimers.delete(encounterId);
    }
  }, duration);

  combatTimers.set(encounterId, timer);
}

