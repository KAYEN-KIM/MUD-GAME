import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import { AuthService } from '../auth/auth.service';
import { WorldService } from '../world/world.service';
import { PartyService } from '../party/party.service';
import { CombatService } from '../combat/combat.service';
import { CombatTickService } from '../combat-tick/combat-tick.service';
import { ChatService } from '../chat/chat.service';
import { QuestService } from '../quest/quest.service';
import { ShopService } from '../shop/shop.service';
import { SeasonService } from '../season/season.service';
import { BossService } from '../boss/boss.service';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { WSMessage, LogAppendPayload, StateSyncPayload, ErrorPayload } from './dto';
import { getMaxUnlockedSeason, isUnlockedId } from '../../utils/season_lock';
import { getAllRecipes, getRecipe } from '../crafting/crafting-system';
import { getAllAchievements, getAchievement } from '../achievement/achievement-system';

type WSClient = WebSocket & {
  userId?: string;
  characterId?: string;
};

@WebSocketGateway()
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;

  private clients = new Map<WSClient, { userId?: string; characterId?: string }>();
  private encounterTimers = new Map<string, NodeJS.Timeout>();
  private questTrackThrottle = new Map<string, { lastSentAtMs: number; lastHash: string }>();
  private redisSubscriber: any;
  // 바닥 아이템은 DB(RoomGroundItem)에 영구 저장됨

  constructor(
    private readonly authService: AuthService,
    private readonly worldService: WorldService,
    private readonly partyService: PartyService,
    private readonly combatService: CombatService,
    private readonly combatTickService: CombatTickService,
    private readonly chatService: ChatService,
    private readonly questService: QuestService,
    private readonly shopService: ShopService,
    private readonly seasonService: SeasonService,
    private readonly bossService: BossService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
  }

  onModuleInit() {
    // Redis는 provider의 onModuleInit에서 연결이 준비되므로, gateway constructor가 아닌 여기에서 구독 시작
    this.setupRedisSubscription();
  }

  onModuleDestroy() {
    try {
      if (this.redisSubscriber) {
        // ioredis: quit() (graceful) or disconnect()
        if (typeof this.redisSubscriber.quit === 'function') {
          this.redisSubscriber.quit();
        } else if (typeof this.redisSubscriber.disconnect === 'function') {
          this.redisSubscriber.disconnect();
        }
      }
    } catch (e) {
      console.error('[WsGateway] Redis subscriber cleanup failed', e);
    }
  }

  private setupRedisSubscription() {
    try {
      // Create a separate Redis client for subscription
      this.redisSubscriber = this.redis.getClient().duplicate();
      
      this.redisSubscriber.psubscribe('combat:tick:*', (err: any) => {
        if (err) {
          console.error('[WsGateway] Failed to subscribe to combat:tick:*', err);
        } else {
          console.log('[WsGateway] Subscribed to combat:tick:* events');
        }
      });

      this.redisSubscriber.on('pmessage', async (pattern: string, channel: string, message: string) => {
        try {
          const roomId = channel.replace('combat:tick:', '');
          const tickResult = JSON.parse(message);
          await this.broadcastToRoom(roomId, {
            t: 'COMBAT_TICK',
            ts: Date.now(),
            p: tickResult,
          });
        } catch (error) {
          console.error('[WsGateway] Error handling combat tick event:', error);
        }
      });
    } catch (error) {
      console.warn('[WsGateway] Redis pub/sub을 사용할 수 없습니다. 메모리 기반으로 작동합니다.');
      // Redis가 없어도 게임은 계속 작동 (단일 서버 환경에서는 문제 없음)
    }
  }

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
        case 'LOOK':
          await this.handleLook(client, message);
          break;
        case 'WHO':
          await this.handleWho(client, message);
          break;
        case 'EXITS':
          await this.handleExits(client, message);
          break;
        case 'ROOM_ITEMS_LIST':
          await this.handleRoomItemsList(client, message);
          break;
        case 'DROP_ITEM':
          await this.handleDropItem(client, message);
          break;
        case 'GET_ITEM':
          await this.handleGetItem(client, message);
          break;
        case 'MOVE':
          await this.handleMove(client, message);
          break;
        case 'HUNT':
          await this.handleHunt(client, message);
          break;
        case 'ATTACK':
        case 'KILL':
          await this.handleAttack(client, message);
          break;
        case 'CAST':
          await this.handleCast(client, message);
          break;
        case 'FLEE':
          await this.handleFlee(client, message);
          break;
        case 'ROOM_MONSTERS':
          await this.handleRoomMonsters(client, message);
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
        case 'GUILD_LIST':
          await this.handleGuildList(client, message);
          break;
        case 'GUILD_CREATE':
          await this.handleGuildCreate(client, message);
          break;
        case 'GUILD_JOIN':
          await this.handleGuildJoin(client, message);
          break;
        case 'GUILD_LEAVE':
          await this.handleGuildLeave(client, message);
          break;
        case 'GUILD_CHAT_SEND':
          await this.handleGuildChatSend(client, message);
          break;
        case 'GUILD_VAULT_LIST':
          await this.handleGuildVaultList(client, message);
          break;
        case 'GUILD_VAULT_DEPOSIT_GOLD':
          await this.handleGuildVaultDepositGold(client, message);
          break;
        case 'GUILD_VAULT_WITHDRAW_GOLD':
          await this.handleGuildVaultWithdrawGold(client, message);
          break;
        case 'GUILD_VAULT_DEPOSIT_ITEM':
          await this.handleGuildVaultDepositItem(client, message);
          break;
        case 'GUILD_VAULT_WITHDRAW_ITEM':
          await this.handleGuildVaultWithdrawItem(client, message);
          break;
        case 'GUILD_WAR_CHALLENGE':
          await this.handleGuildWarChallenge(client, message);
          break;
        case 'GUILD_WAR_ACCEPT':
          await this.handleGuildWarAccept(client, message);
          break;
        case 'GUILD_WAR_LIST':
          await this.handleGuildWarList(client, message);
          break;
        case 'GUILD_WAR_MATCH':
          await this.handleGuildWarMatch(client, message);
          break;
        case 'GUILD_QUEST_LIST':
          await this.handleGuildQuestList(client, message);
          break;
        case 'GUILD_QUEST_ACCEPT':
          await this.handleGuildQuestAccept(client, message);
          break;
        case 'GUILD_QUEST_TURNIN':
          await this.handleGuildQuestTurnin(client, message);
          break;
        case 'CRAFT_LIST':
          await this.handleCraftList(client, message);
          break;
        case 'CRAFT':
          await this.handleCraft(client, message);
          break;
        case 'ACHIEVEMENT_LIST':
          await this.handleAchievementList(client, message);
          break;
        case 'ACHIEVEMENT_CLAIM':
          await this.handleAchievementClaim(client, message);
          break;
        case 'TRADE_OFFER_CREATE':
          await this.handleTradeOfferCreate(client, message);
          break;
        case 'TRADE_OFFER_ACCEPT':
          await this.handleTradeOfferAccept(client, message);
          break;
        case 'TRADE_OFFER_REJECT':
          await this.handleTradeOfferReject(client, message);
          break;
        case 'SEARCH':
          await this.handleSearch(client, message);
          break;
        case 'NODE_LIST':
          await this.handleNodeList(client, message);
          break;
        case 'GATHER':
          await this.handleGather(client, message);
          break;
        case 'MARKETPLACE_LIST':
          await this.handleMarketplaceList(client, message);
          break;
        case 'MARKETPLACE_LISTING_CREATE':
          await this.handleMarketplaceListingCreate(client, message);
          break;
        case 'MARKETPLACE_BID':
          await this.handleMarketplaceBid(client, message);
          break;
        case 'MARKETPLACE_BUY_NOW':
          await this.handleMarketplaceBuyNow(client, message);
          break;
        case 'MARKETPLACE_CANCEL':
          await this.handleMarketplaceCancel(client, message);
          break;
        case 'PVP_CHALLENGE':
          await this.handlePvpChallenge(client, message);
          break;
        case 'PVP_ACCEPT':
          await this.handlePvpAccept(client, message);
          break;
        case 'PVP_RANKING':
          await this.handlePvpRanking(client, message);
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
        case 'ENHANCE':
          await this.handleEnhance(client, message);
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
      case 'SPELL_LIST':
        await this.handleSpellList(client, message);
        break;
      case 'SKILL_LIST':
        await this.handleSkillList(client, message);
        break;
        case 'SKILL_LEARN':
          await this.handleSkillLearn(client, message);
          break;
        case 'SKILL_USE':
          await this.handleSkillUse(client, message);
          break;
        case 'DUNGEON_LIST':
        await this.handleDungeonList(client, message);
        break;
      case 'DUNGEON_ENTER':
        await this.handleDungeonEnter(client, message);
        break;
      case 'RAID_LIST':
        await this.handleRaidList(client, message);
        break;
      case 'RAID_ENTER':
        await this.handleRaidEnter(client, message);
        break;
      case 'DUNGEON_STATUS':
        await this.handleDungeonStatus(client, message);
        break;
      case 'RAID_STATUS':
        await this.handleRaidStatus(client, message);
        break;
      case 'PET_LIST':
        await this.handlePetList(client, message);
        break;
      case 'PET_SUMMON':
        await this.handlePetSummon(client, message);
        break;
      case 'PET_DISMISS':
        await this.handlePetDismiss(client, message);
        break;
      case 'HOUSE_INFO':
        await this.handleHouseInfo(client, message);
        break;
      case 'HOUSE_CREATE':
        await this.handleHouseCreate(client, message);
        break;
      case 'HOUSE_STORAGE':
        await this.handleHouseStorage(client, message);
        break;
      case 'FARM_PLANT':
        await this.handleFarmPlant(client, message);
        break;
      case 'FARM_HARVEST':
        await this.handleFarmHarvest(client, message);
        break;
      case 'EVENT_LIST':
        await this.handleEventList(client, message);
        break;
      case 'EVENT_JOIN':
        await this.handleEventJoin(client, message);
        break;
      case 'EVENT_PROGRESS':
        await this.handleEventProgress(client, message);
        break;
      case 'RANKING_DUNGEON':
        await this.handleRankingDungeon(client, message);
        break;
      case 'RANKING_RAID':
        await this.handleRankingRaid(client, message);
        break;
      case 'STORY_LIST':
        await this.handleStoryList(client, message);
        break;
      case 'STORY_COMPLETE':
        await this.handleStoryComplete(client, message);
        break;
      case 'NPC_LIST':
        await this.handleNPCList(client, message);
        break;
      case 'NPC_TALK':
        await this.handleNPCTalk(client, message);
        break;
        case 'REST':
          await this.handleRest(client, message);
          break;
        // Social System
        case 'FRIEND_LIST':
          await this.handleFriendList(client, message);
          break;
        case 'FRIEND_ADD':
          await this.handleFriendAdd(client, message);
          break;
        case 'FRIEND_ACCEPT':
          await this.handleFriendAccept(client, message);
          break;
        case 'FRIEND_REMOVE':
          await this.handleFriendRemove(client, message);
          break;
        case 'BLACKLIST_LIST':
          await this.handleBlacklistList(client, message);
          break;
        case 'BLACKLIST_ADD':
          await this.handleBlacklistAdd(client, message);
          break;
        case 'BLACKLIST_REMOVE':
          await this.handleBlacklistRemove(client, message);
          break;
        case 'MAIL_LIST':
          await this.handleMailList(client, message);
          break;
        case 'MAIL_SEND':
          await this.handleMailSend(client, message);
          break;
        case 'MAIL_READ':
          await this.handleMailRead(client, message);
          break;
        case 'MAIL_DELETE':
          await this.handleMailDelete(client, message);
          break;
        case 'MAIL_CLAIM':
          await this.handleMailClaim(client, message);
          break;
        // Collection System
        case 'BESTIARY_LIST':
          await this.handleBestiaryList(client, message);
          break;
        case 'TITLE_LIST':
          await this.handleTitleList(client, message);
          break;
        case 'TITLE_EQUIP':
          await this.handleTitleEquip(client, message);
          break;
        case 'COLLECTIBLE_LIST':
          await this.handleCollectibleList(client, message);
          break;
        // Economy Expansion
        case 'BANK_INFO':
          await this.handleBankInfo(client, message);
          break;
        case 'BANK_DEPOSIT':
          await this.handleBankDeposit(client, message);
          break;
        case 'BANK_WITHDRAW':
          await this.handleBankWithdraw(client, message);
          break;
        case 'BANK_HISTORY':
          await this.handleBankHistory(client, message);
          break;
        case 'EXCHANGE_LIST':
          await this.handleExchangeList(client, message);
          break;
        case 'EXCHANGE_SELL':
          await this.handleExchangeSell(client, message);
          break;
        case 'EXCHANGE_BUY':
          await this.handleExchangeBuy(client, message);
          break;
        case 'EXCHANGE_CANCEL':
          await this.handleExchangeCancel(client, message);
          break;
        // Admin Tools
        case 'ADMIN_STATS':
          await this.handleAdminStats(client, message);
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

  private async handleGuildList(client: WSClient, message: WSMessage) {
    const guilds = await (this.prisma as any).guild.findMany({
      include: {
        members: { include: { character: { select: { id: true, name: true } } } },
      },
      orderBy: [{ level: 'desc' }, { createdAt: 'desc' }],
    });

    const payloadGuilds = guilds.map((g: any) => {
      const leader = g.members.find((m: any) => m.characterId === g.leaderCharacterId)?.character;
      return {
        id: g.id,
        name: g.name,
        description: g.description || '',
        level: g.level,
        memberCount: g.members.length,
        maxMembers: g.maxMembers,
        leaderId: g.leaderCharacterId,
        leaderName: leader?.name || '(unknown)',
        createdAt: g.createdAt.toISOString(),
      };
    });

    this.sendMessage(client, {
      t: 'GUILD_LIST_OK',
      reqId: message.reqId,
      ts: Date.now(),
      p: { guilds: payloadGuilds },
    });
  }

  private async handleGuildCreate(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const name = (message.p?.name || '').trim();
    const description = (message.p?.description || '').trim();
    if (!name) {
      this.sendError(client, message.reqId, 'INVALID_STATE', '길드 이름이 필요합니다.');
      return;
    }
    if (name.length > 20) {
      this.sendError(client, message.reqId, 'INVALID_STATE', '길드 이름이 너무 깁니다. (최대 20자)');
      return;
    }

    const CREATE_COST = 10000;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const character = await tx.character.findUnique({ where: { id: clientData.characterId! } });
        if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');

        const existingMember = await (tx as any).guildMember.findUnique({
          where: { characterId: character.id },
        });
        if (existingMember) throw new Error('이미 길드에 가입되어 있습니다.');

        const existsName = await (tx as any).guild.findUnique({ where: { name } });
        if (existsName) throw new Error('이미 존재하는 길드 이름입니다.');

        if (character.gold < CREATE_COST) throw new Error(`골드가 부족합니다. (필요: ${CREATE_COST})`);

        await tx.character.update({
          where: { id: character.id },
          data: { gold: { decrement: CREATE_COST } },
        });

        const guild = await (tx as any).guild.create({
          data: {
            name,
            description,
            leaderCharacterId: character.id,
            maxMembers: 20,
            members: {
              create: {
                characterId: character.id,
                role: 'LEADER',
              },
            },
          },
          include: { members: true },
        });

        // 길드 버프 초기화 (레벨 1)
        await (tx as any).guildBuff.create({
          data: {
            guildId: guild.id,
            expBonus: 0,
            goldBonus: 0,
            atkBonus: 0,
            defBonus: 0,
            hpBonus: 0,
          },
        });

        return { guild, characterName: character.name };
      });

      this.sendLog(client, 'SYSTEM', `🏰 길드 생성 완료: ${name} (비용 ${CREATE_COST}G)`);
      // 업적 트리거: JOIN_GUILD (리더도 가입으로 간주)
      try {
        await (this.prisma as any).characterAchievement.upsert({
          where: { characterId_achievementId: { characterId: clientData.characterId, achievementId: 'guild_member' } },
          create: { characterId: clientData.characterId, achievementId: 'guild_member', progress: 1, target: 1 },
          update: { progress: 1 },
        });
      } catch {}

      // 리스트 갱신
      await this.handleGuildList(client, message);
      await this.sendStateSync(client, clientData.characterId, message.reqId);

      // 전역 공지(선택): 같은 방에만 알림
      const char = await this.prisma.character.findUnique({ where: { id: clientData.characterId }, select: { roomId: true } });
      if (char?.roomId) {
        await this.broadcastToRoom(char.roomId, {
          t: 'LOG_APPEND',
          ts: Date.now(),
          p: { scope: 'WORLD', text: `🏰 ${result.characterName}이(가) 길드 <${name}>를 창설했습니다!` },
        });
      }
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '길드 생성 실패');
    }
  }

  private async handleGuildJoin(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;
    const guildId = (message.p?.guildId || '').trim();
    if (!guildId) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'guildId가 필요합니다.');
      return;
    }

    try {
      const joinRes = await this.prisma.$transaction(async (tx) => {
        const character = await tx.character.findUnique({ where: { id: clientData.characterId! } });
        if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');

        const existingMember = await (tx as any).guildMember.findUnique({
          where: { characterId: character.id },
        });
        if (existingMember) throw new Error('이미 길드에 가입되어 있습니다.');

        const guild = await (tx as any).guild.findUnique({
          where: { id: guildId },
          include: { members: true },
        });
        if (!guild) throw new Error('길드를 찾을 수 없습니다.');
        if (guild.members.length >= guild.maxMembers) throw new Error('길드가 가득 찼습니다.');

        await (tx as any).guildMember.create({
          data: { guildId: guild.id, characterId: character.id, role: 'MEMBER' },
        });

        return { guildName: guild.name, characterName: character.name };
      });

      this.sendLog(client, 'SYSTEM', `✅ 길드 가입: <${joinRes.guildName}>`);
      try {
        await (this.prisma as any).characterAchievement.upsert({
          where: { characterId_achievementId: { characterId: clientData.characterId, achievementId: 'guild_member' } },
          create: { characterId: clientData.characterId, achievementId: 'guild_member', progress: 1, target: 1 },
          update: { progress: 1 },
        });
      } catch {}

      await this.handleGuildList(client, message);
      await this.sendStateSync(client, clientData.characterId, message.reqId);
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '길드 가입 실패');
    }
  }

  private async handleGuildLeave(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const res = await this.prisma.$transaction(async (tx) => {
        const member = await (tx as any).guildMember.findUnique({
          where: { characterId: clientData.characterId! },
        });
        if (!member) throw new Error('길드에 가입되어 있지 않습니다.');

        const guild = await (tx as any).guild.findUnique({
          where: { id: member.guildId },
          include: { members: true },
        });
        if (!guild) throw new Error('길드를 찾을 수 없습니다.');

        const isLeader = guild.leaderCharacterId === clientData.characterId;
        if (isLeader) {
          if (guild.members.length === 1) {
            // 마지막 멤버면 길드 해산
            await (tx as any).guildMember.delete({ where: { characterId: clientData.characterId! } });
            await (tx as any).guild.delete({ where: { id: guild.id } });
            return { guildName: guild.name, disbanded: true };
          }
          // 리더 교체: 가장 오래된 가입자
          const nextLeader = guild.members
            .filter((m: any) => m.characterId !== clientData.characterId)
            .sort((a: any, b: any) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())[0];
          if (!nextLeader) throw new Error('리더를 위임할 수 없습니다.');
          await (tx as any).guild.update({
            where: { id: guild.id },
            data: { leaderCharacterId: nextLeader.characterId },
          });
        }

        await (tx as any).guildMember.delete({ where: { characterId: clientData.characterId! } });
        return { guildName: guild.name, disbanded: false };
      });

      this.sendLog(client, 'SYSTEM', res.disbanded ? `🏴 길드 해산: <${res.guildName}>` : `👋 길드 탈퇴: <${res.guildName}>`);
      await this.handleGuildList(client, message);
      await this.sendStateSync(client, clientData.characterId, message.reqId);
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '길드 탈퇴 실패');
    }
  }

  private async handleGuildChatSend(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;
    const text = (message.p?.text || '').toString().trim();
    if (!text) return;

    const member = await (this.prisma as any).guildMember.findUnique({
      where: { characterId: clientData.characterId },
      include: { guild: true, character: { select: { name: true } } },
    });
    if (!member) {
      this.sendError(client, message.reqId, 'INVALID_STATE', '길드에 가입되어 있지 않습니다.');
      return;
    }

    const guildId = member.guildId;
    const senderName = member.character?.name || '???';
    const guildName = member.guild?.name || 'GUILD';
    const msg = `[GUILD:${guildName}] ${senderName}: ${text}`;

    const online = [...this.clients.entries()]
      .filter(([, d]) => d.characterId)
      .map(([ws, d]) => ({ ws, characterId: d.characterId! }));

    // 온라인 유저 중 길드원만 브로드캐스트
    for (const o of online) {
      const m = await (this.prisma as any).guildMember.findUnique({ where: { characterId: o.characterId } });
      if (m?.guildId === guildId) {
        this.sendLog(o.ws, 'CHAT', msg);
      }
    }
  }

  // ===== GUILD VAULT =====

  private async handleGuildVaultList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const guildMember = await (this.prisma as any).guildMember.findUnique({
        where: { characterId: clientData.characterId },
        include: {
          guild: {
            include: {
              vaultItems: { include: { item: { select: { id: true, name: true, icon: true } } } },
            },
          },
        },
      });
      if (!guildMember) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '길드에 속해 있지 않습니다.');
        return;
      }

      this.sendMessage(client, {
        t: 'GUILD_VAULT_LIST_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          vaultGold: guildMember.guild.vaultGold || 0,
          items: (guildMember.guild.vaultItems || []).map((vi: any) => ({
            itemId: vi.itemId,
            itemName: vi.item.name,
            itemIcon: vi.item.icon,
            qty: vi.qty,
            depositedBy: vi.depositedBy,
            depositedAt: vi.depositedAt.toISOString(),
          })),
        },
      });
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '길드 금고 조회 실패');
    }
  }

  private async handleGuildVaultDepositGold(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const amount = Number(message.p?.amount || 0) || 0;
    if (amount <= 0) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'amount는 양수여야 합니다.');
      return;
    }

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { id: true, name: true, gold: true },
      });
      if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');
      if (character.gold < amount) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '골드가 부족합니다.');
        return;
      }

      const guildMember = await (this.prisma as any).guildMember.findUnique({
        where: { characterId: clientData.characterId },
        include: { guild: true },
      });
      if (!guildMember) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '길드에 속해 있지 않습니다.');
        return;
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.character.update({
          where: { id: character.id },
          data: { gold: { decrement: amount } },
        });
        await (tx as any).guild.update({
          where: { id: guildMember.guildId },
          data: { vaultGold: { increment: amount } },
        });
      });

      this.sendLog(client, 'SYSTEM', `💰 길드 금고에 ${amount}G 기여했습니다.`);
      this.sendMessage(client, {
        t: 'GUILD_VAULT_DEPOSIT_GOLD_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { amount },
      });
      await this.sendStateSync(client, clientData.characterId, message.reqId);
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '골드 기여 실패');
    }
  }

  private async handleGuildVaultWithdrawGold(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const amount = Number(message.p?.amount || 0) || 0;
    if (amount <= 0) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'amount는 양수여야 합니다.');
      return;
    }

    try {
      const guildMember = await (this.prisma as any).guildMember.findUnique({
        where: { characterId: clientData.characterId },
        include: { guild: true },
      });
      if (!guildMember) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '길드에 속해 있지 않습니다.');
        return;
      }

      // 권한 체크: LEADER 또는 OFFICER만 인출 가능
      if (guildMember.role !== 'LEADER' && guildMember.role !== 'OFFICER') {
        this.sendError(client, message.reqId, 'INVALID_STATE', '길드장 또는 부관만 인출할 수 있습니다.');
        return;
      }

      if ((guildMember.guild.vaultGold || 0) < amount) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '길드 금고에 골드가 부족합니다.');
        return;
      }

      await this.prisma.$transaction(async (tx) => {
        await (tx as any).guild.update({
          where: { id: guildMember.guildId },
          data: { vaultGold: { decrement: amount } },
        });
        await tx.character.update({
          where: { id: clientData.characterId },
          data: { gold: { increment: amount } },
        });
      });

      this.sendLog(client, 'SYSTEM', `💰 길드 금고에서 ${amount}G 인출했습니다.`);
      this.sendMessage(client, {
        t: 'GUILD_VAULT_WITHDRAW_GOLD_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { amount },
      });
      await this.sendStateSync(client, clientData.characterId, message.reqId);
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '골드 인출 실패');
    }
  }

  private async handleGuildVaultDepositItem(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const itemId = (message.p?.itemId || '').toString().trim();
    const qty = Number(message.p?.qty || 1) || 1;
    if (!itemId || qty <= 0) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'itemId와 qty(>0)가 필요합니다.');
      return;
    }

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { id: true, name: true },
      });
      if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');

      const inv = await this.prisma.inventory.findUnique({
        where: { characterId_itemId: { characterId: character.id, itemId } },
      });
      if (!inv || inv.qty < qty) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '인벤토리에 아이템이 부족합니다.');
        return;
      }

      const guildMember = await (this.prisma as any).guildMember.findUnique({
        where: { characterId: clientData.characterId },
        include: { guild: true },
      });
      if (!guildMember) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '길드에 속해 있지 않습니다.');
        return;
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.inventory.update({
          where: { characterId_itemId: { characterId: character.id, itemId } },
          data: { qty: { decrement: qty } },
        });
        await tx.inventory.deleteMany({
          where: { characterId: character.id, itemId, qty: { lte: 0 } },
        });

        await (tx as any).guildVaultItem.upsert({
          where: { guildId_itemId: { guildId: guildMember.guildId, itemId } },
          create: {
            guildId: guildMember.guildId,
            itemId,
            qty,
            depositedBy: character.id,
          },
          update: { qty: { increment: qty } },
        });
      });

      const item = await this.prisma.item.findUnique({ where: { id: itemId }, select: { name: true } });
      this.sendLog(client, 'SYSTEM', `📦 길드 금고에 ${item?.name || itemId} x${qty} 기여했습니다.`);
      this.sendMessage(client, {
        t: 'GUILD_VAULT_DEPOSIT_ITEM_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { itemId, qty },
      });
      await this.sendStateSync(client, clientData.characterId, message.reqId);
      await this.sendInventoryList(client, clientData.characterId, message.reqId);
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '아이템 기여 실패');
    }
  }

  private async handleGuildVaultWithdrawItem(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const itemId = (message.p?.itemId || '').toString().trim();
    const qty = Number(message.p?.qty || 1) || 1;
    if (!itemId || qty <= 0) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'itemId와 qty(>0)가 필요합니다.');
      return;
    }

    try {
      const guildMember = await (this.prisma as any).guildMember.findUnique({
        where: { characterId: clientData.characterId },
        include: { guild: { include: { vaultItems: true } } },
      });
      if (!guildMember) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '길드에 속해 있지 않습니다.');
        return;
      }

      // 권한 체크: LEADER 또는 OFFICER만 인출 가능
      if (guildMember.role !== 'LEADER' && guildMember.role !== 'OFFICER') {
        this.sendError(client, message.reqId, 'INVALID_STATE', '길드장 또는 부관만 인출할 수 있습니다.');
        return;
      }

      const vaultItem = guildMember.guild.vaultItems.find((vi: any) => vi.itemId === itemId);
      if (!vaultItem || vaultItem.qty < qty) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '길드 금고에 아이템이 부족합니다.');
        return;
      }

      await this.prisma.$transaction(async (tx) => {
        if (vaultItem.qty === qty) {
          await (tx as any).guildVaultItem.delete({
            where: { id: vaultItem.id },
          });
        } else {
          await (tx as any).guildVaultItem.update({
            where: { id: vaultItem.id },
            data: { qty: { decrement: qty } },
          });
        }

        await tx.inventory.upsert({
          where: { characterId_itemId: { characterId: clientData.characterId!, itemId } },
          create: { characterId: clientData.characterId!, itemId, qty },
          update: { qty: { increment: qty } },
        });
      });

      const item = await this.prisma.item.findUnique({ where: { id: itemId }, select: { name: true } });
      this.sendLog(client, 'SYSTEM', `📦 길드 금고에서 ${item?.name || itemId} x${qty} 인출했습니다.`);
      this.sendMessage(client, {
        t: 'GUILD_VAULT_WITHDRAW_ITEM_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { itemId, qty },
      });
      await this.sendStateSync(client, clientData.characterId, message.reqId);
      await this.sendInventoryList(client, clientData.characterId, message.reqId);
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '아이템 인출 실패');
    }
  }

  // ===== GUILD WAR =====

  private async handleGuildWarChallenge(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const defenderGuildId = (message.p?.defenderGuildId || '').toString().trim();
    if (!defenderGuildId) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'defenderGuildId가 필요합니다.');
      return;
    }

    try {
      const challengerMember = await (this.prisma as any).guildMember.findUnique({
        where: { characterId: clientData.characterId },
        include: { guild: true, character: { select: { name: true } } },
      });
      if (!challengerMember || challengerMember.role !== 'LEADER') {
        this.sendError(client, message.reqId, 'INVALID_STATE', '길드장만 전쟁을 선포할 수 있습니다.');
        return;
      }

      const defenderGuild = await (this.prisma as any).guild.findUnique({
        where: { id: defenderGuildId },
      });
      if (!defenderGuild) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '상대 길드를 찾을 수 없습니다.');
        return;
      }

      if (challengerMember.guildId === defenderGuildId) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '자신의 길드와는 전쟁할 수 없습니다.');
        return;
      }

      // 이미 진행 중인 전쟁이 있는지 확인
      const existingWar = await (this.prisma as any).guildWar.findFirst({
        where: {
          OR: [
            { challengerGuildId: challengerMember.guildId, status: { in: ['PENDING', 'ACTIVE'] } },
            { defenderGuildId: challengerMember.guildId, status: { in: ['PENDING', 'ACTIVE'] } },
            { challengerGuildId: defenderGuildId, status: { in: ['PENDING', 'ACTIVE'] } },
            { defenderGuildId: defenderGuildId, status: { in: ['PENDING', 'ACTIVE'] } },
          ],
        },
      });
      if (existingWar) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '이미 진행 중인 전쟁이 있습니다.');
        return;
      }

      const war = await (this.prisma as any).guildWar.create({
        data: {
          challengerGuildId: challengerMember.guildId,
          defenderGuildId,
          status: 'PENDING',
        },
        include: {
          challengerGuild: { select: { name: true } },
          defenderGuild: { select: { name: true } },
        },
      });

      this.sendLog(client, 'SYSTEM', `⚔️ 길드 전쟁 선포: ${war.challengerGuild.name} → ${war.defenderGuild.name}`);
      this.sendMessage(client, {
        t: 'GUILD_WAR_CHALLENGE_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { warId: war.id },
      });

      // 상대 길드장에게 알림 (온라인인 경우)
      const defenderLeader = await this.prisma.character.findUnique({
        where: { id: defenderGuild.leaderCharacterId },
      });
      if (defenderLeader) {
        const onlineClients = [...this.clients.entries()].filter(([, d]) => d.characterId === defenderLeader.id);
        for (const [ws] of onlineClients) {
          this.sendLog(ws, 'SYSTEM', `⚔️ ${war.challengerGuild.name} 길드가 전쟁을 선포했습니다!`);
        }
      }
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '전쟁 선포 실패');
    }
  }

  private async handleGuildWarAccept(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const warId = (message.p?.warId || '').toString().trim();
    if (!warId) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'warId가 필요합니다.');
      return;
    }

    try {
      const defenderMember = await (this.prisma as any).guildMember.findUnique({
        where: { characterId: clientData.characterId },
        include: { guild: true },
      });
      if (!defenderMember || defenderMember.role !== 'LEADER') {
        this.sendError(client, message.reqId, 'INVALID_STATE', '길드장만 전쟁을 수락할 수 있습니다.');
        return;
      }

      const war = await (this.prisma as any).guildWar.findUnique({
        where: { id: warId },
        include: {
          challengerGuild: { select: { name: true } },
          defenderGuild: { select: { name: true } },
        },
      });
      if (!war) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '전쟁을 찾을 수 없습니다.');
        return;
      }
      if (war.defenderGuildId !== defenderMember.guildId) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '자신의 길드 전쟁만 수락할 수 있습니다.');
        return;
      }
      if (war.status !== 'PENDING') {
        this.sendError(client, message.reqId, 'INVALID_STATE', '이미 처리된 전쟁입니다.');
        return;
      }

      const now = new Date();
      const endAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7일 후 종료

      await (this.prisma as any).guildWar.update({
        where: { id: warId },
        data: {
          status: 'ACTIVE',
          startAt: now,
          endAt,
        },
      });

      this.sendLog(client, 'SYSTEM', `⚔️ 길드 전쟁 시작: ${war.challengerGuild.name} vs ${war.defenderGuild.name} (7일간)`);
      this.sendMessage(client, {
        t: 'GUILD_WAR_ACCEPT_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { warId, startAt: now.toISOString(), endAt: endAt.toISOString() },
      });

      // 양쪽 길드원들에게 알림
      const challengerMembers = await (this.prisma as any).guildMember.findMany({
        where: { guildId: war.challengerGuildId },
        include: { character: { select: { id: true } } },
      });
      const defenderMembers = await (this.prisma as any).guildMember.findMany({
        where: { guildId: war.defenderGuildId },
        include: { character: { select: { id: true } } },
      });

      const allMemberIds = [...challengerMembers, ...defenderMembers].map((m: any) => m.character.id);
      const onlineClients = [...this.clients.entries()].filter(([, d]) => d.characterId && allMemberIds.includes(d.characterId));
      for (const [ws] of onlineClients) {
        this.sendLog(ws, 'SYSTEM', `⚔️ 길드 전쟁이 시작되었습니다!`);
      }
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '전쟁 수락 실패');
    }
  }

  private async handleGuildWarList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const guildMember = await (this.prisma as any).guildMember.findUnique({
        where: { characterId: clientData.characterId },
        include: { guild: true },
      });
      if (!guildMember) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '길드에 속해 있지 않습니다.');
        return;
      }

      const wars = await (this.prisma as any).guildWar.findMany({
        where: {
          OR: [
            { challengerGuildId: guildMember.guildId },
            { defenderGuildId: guildMember.guildId },
          ],
          status: { in: ['PENDING', 'ACTIVE'] },
        },
        include: {
          challengerGuild: { select: { name: true } },
          defenderGuild: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      this.sendMessage(client, {
        t: 'GUILD_WAR_LIST_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          wars: wars.map((w: any) => ({
            id: w.id,
            challengerGuildName: w.challengerGuild.name,
            defenderGuildName: w.defenderGuild.name,
            status: w.status,
            challengerScore: w.challengerScore || 0,
            defenderScore: w.defenderScore || 0,
            startAt: w.startAt?.toISOString(),
            endAt: w.endAt?.toISOString(),
          })),
        },
      });
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '전쟁 목록 조회 실패');
    }
  }

  private async handleGuildWarMatch(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const warId = (message.p?.warId || '').toString().trim();
    const targetCharacterId = (message.p?.targetCharacterId || '').toString().trim();
    if (!warId || !targetCharacterId) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'warId와 targetCharacterId가 필요합니다.');
      return;
    }

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { id: true, name: true },
      });
      if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');

      const targetCharacter = await this.prisma.character.findUnique({
        where: { id: targetCharacterId },
        select: { id: true, name: true },
      });
      if (!targetCharacter) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '상대 캐릭터를 찾을 수 없습니다.');
        return;
      }

      // 양쪽 모두 길드에 속해 있는지 확인
      const challengerMember = await (this.prisma as any).guildMember.findUnique({
        where: { characterId: clientData.characterId },
      });
      const defenderMember = await (this.prisma as any).guildMember.findUnique({
        where: { characterId: targetCharacterId },
      });

      if (!challengerMember || !defenderMember) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '양쪽 모두 길드에 속해 있어야 합니다.');
        return;
      }

      const war = await (this.prisma as any).guildWar.findUnique({
        where: { id: warId },
      });
      if (!war || war.status !== 'ACTIVE') {
        this.sendError(client, message.reqId, 'INVALID_STATE', '진행 중인 전쟁이 아닙니다.');
        return;
      }

      // 길드 확인
      const isChallenger = challengerMember.guildId === war.challengerGuildId;
      const isDefender = challengerMember.guildId === war.defenderGuildId;
      const targetIsChallenger = defenderMember.guildId === war.challengerGuildId;
      const targetIsDefender = defenderMember.guildId === war.defenderGuildId;

      if (!((isChallenger && targetIsDefender) || (isDefender && targetIsChallenger))) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '같은 길드원과는 전투할 수 없습니다.');
        return;
      }

      // PVP 매치 생성 (기존 PVP 시스템 활용)
      const match = await (this.prisma as any).pvpMatch.create({
        data: {
          challengerCharacterId: clientData.characterId,
          defenderCharacterId: targetCharacterId,
          status: 'PENDING',
        },
      });

      // 길드 전쟁 매치 기록
      await (this.prisma as any).guildWarMatch.create({
        data: {
          warId,
          challengerCharacterId: clientData.characterId,
          defenderCharacterId: targetCharacterId,
        },
      });

      this.sendLog(client, 'SYSTEM', `⚔️ 길드 전쟁 매치 생성: ${character.name} vs ${targetCharacter.name}`);
      this.sendMessage(client, {
        t: 'GUILD_WAR_MATCH_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { matchId: match.id, warId },
      });

      // 상대에게 알림
      const onlineClients = [...this.clients.entries()].filter(([, d]) => d.characterId === targetCharacterId);
      for (const [ws] of onlineClients) {
        this.sendLog(ws, 'SYSTEM', `⚔️ ${character.name}이(가) 길드 전쟁 매치를 신청했습니다!`);
      }
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '전쟁 매치 생성 실패');
    }
  }

  // 길드 전쟁 점수 업데이트 (PVP 매치 완료 시 호출)
  private async updateGuildWarScore(warId: string, winnerCharacterId: string) {
    try {
      const match = await (this.prisma as any).guildWarMatch.findFirst({
        where: { warId, finishedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (!match) return;

      const war = await (this.prisma as any).guildWar.findUnique({
        where: { id: warId },
      });
      if (!war || war.status !== 'ACTIVE') return;

      const isChallengerWin = match.challengerCharacterId === winnerCharacterId;
      const isDefenderWin = match.defenderCharacterId === winnerCharacterId;

      if (isChallengerWin) {
        await (this.prisma as any).guildWar.update({
          where: { id: warId },
          data: { challengerScore: { increment: 1 } },
        });
      } else if (isDefenderWin) {
        await (this.prisma as any).guildWar.update({
          where: { id: warId },
          data: { defenderScore: { increment: 1 } },
        });
      }

      // 매치 완료 처리
      await (this.prisma as any).guildWarMatch.update({
        where: { id: match.id },
        data: {
          winnerId: winnerCharacterId,
          finishedAt: new Date(),
        },
      });

      // 전쟁 종료 체크 (7일 경과 또는 점수 차이 10점 이상)
      const now = new Date();
      const updatedWar = await (this.prisma as any).guildWar.findUnique({
        where: { id: warId },
      });
      const scoreDiff = Math.abs((updatedWar.challengerScore || 0) - (updatedWar.defenderScore || 0));
      if (updatedWar.endAt && now >= updatedWar.endAt) {
        const winnerGuildId = (updatedWar.challengerScore || 0) > (updatedWar.defenderScore || 0) ? updatedWar.challengerGuildId : updatedWar.defenderGuildId;
        await (this.prisma as any).guildWar.update({
          where: { id: warId },
          data: {
            status: 'FINISHED',
            winnerGuildId,
          },
        });
      } else if (scoreDiff >= 10) {
        const winnerGuildId = (updatedWar.challengerScore || 0) > (updatedWar.defenderScore || 0) ? updatedWar.challengerGuildId : updatedWar.defenderGuildId;
        await (this.prisma as any).guildWar.update({
          where: { id: warId },
          data: {
            status: 'FINISHED',
            winnerGuildId,
            endAt: now,
          },
        });
      }
    } catch (e: any) {
      console.error(`[GUILD_WAR] 점수 업데이트 실패: warId=${warId}, error=${e?.message}`);
    }
  }

  // ===== GUILD QUEST =====

  private async handleGuildQuestList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const guildMember = await (this.prisma as any).guildMember.findUnique({
        where: { characterId: clientData.characterId },
        include: { guild: { include: { quests: true } } },
      });
      if (!guildMember) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '길드에 속해 있지 않습니다.');
        return;
      }

      const activeQuests = (guildMember.guild.quests || []).filter((q: any) => q.status === 'ACTIVE');
      const completedQuests = (guildMember.guild.quests || []).filter((q: any) => q.status === 'COMPLETED');

      this.sendMessage(client, {
        t: 'GUILD_QUEST_LIST_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          active: activeQuests.map((q: any) => ({
            id: q.id,
            questId: q.questId,
            progress: q.progress,
            target: q.target,
            acceptedAt: q.acceptedAt.toISOString(),
          })),
          completed: completedQuests.map((q: any) => ({
            id: q.id,
            questId: q.questId,
            completedAt: q.completedAt?.toISOString(),
          })),
        },
      });
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '길드 퀘스트 목록 조회 실패');
    }
  }

  private async handleGuildQuestAccept(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const questId = (message.p?.questId || '').toString().trim();
    if (!questId) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'questId가 필요합니다.');
      return;
    }

    try {
      const guildMember = await (this.prisma as any).guildMember.findUnique({
        where: { characterId: clientData.characterId },
        include: { guild: true },
      });
      if (!guildMember) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '길드에 속해 있지 않습니다.');
        return;
      }

      // 권한 체크: LEADER 또는 OFFICER만 수락 가능
      if (guildMember.role !== 'LEADER' && guildMember.role !== 'OFFICER') {
        this.sendError(client, message.reqId, 'INVALID_STATE', '길드장 또는 부관만 퀘스트를 수락할 수 있습니다.');
        return;
      }

      // 이미 수락한 퀘스트인지 확인
      const existing = await (this.prisma as any).guildQuest.findUnique({
        where: { guildId_questId: { guildId: guildMember.guildId, questId } },
      });
      if (existing) {
        if (existing.status === 'ACTIVE') {
          this.sendError(client, message.reqId, 'INVALID_STATE', '이미 진행 중인 퀘스트입니다.');
          return;
        }
        if (existing.status === 'COMPLETED') {
          this.sendError(client, message.reqId, 'INVALID_STATE', '이미 완료한 퀘스트입니다.');
          return;
        }
      }

      // 퀘스트 템플릿 조회 (간단한 예시 - 실제로는 quest-service에서 가져와야 함)
      // 여기서는 기본값으로 처리
      const target = 100; // 기본 목표값

      await (this.prisma as any).guildQuest.create({
        data: {
          guildId: guildMember.guildId,
          questId,
          status: 'ACTIVE',
          progress: 0,
          target,
        },
      });

      this.sendLog(client, 'SYSTEM', `📜 길드 퀘스트 수락: ${questId}`);
      this.sendMessage(client, {
        t: 'GUILD_QUEST_ACCEPT_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { questId },
      });

      // 길드원들에게 알림
      const members = await (this.prisma as any).guildMember.findMany({
        where: { guildId: guildMember.guildId },
        include: { character: { select: { id: true } } },
      });
      const memberIds = members.map((m: any) => m.character.id);
      const onlineClients = [...this.clients.entries()].filter(([, d]) => d.characterId && memberIds.includes(d.characterId));
      for (const [ws] of onlineClients) {
        this.sendLog(ws, 'SYSTEM', `📜 새로운 길드 퀘스트가 수락되었습니다: ${questId}`);
      }
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '길드 퀘스트 수락 실패');
    }
  }

  private async handleGuildQuestTurnin(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const questId = (message.p?.questId || '').toString().trim();
    if (!questId) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'questId가 필요합니다.');
      return;
    }

    try {
      const guildMember = await (this.prisma as any).guildMember.findUnique({
        where: { characterId: clientData.characterId },
        include: { guild: true },
      });
      if (!guildMember) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '길드에 속해 있지 않습니다.');
        return;
      }

      const guildQuest = await (this.prisma as any).guildQuest.findUnique({
        where: { guildId_questId: { guildId: guildMember.guildId, questId } },
      });
      if (!guildQuest || guildQuest.status !== 'ACTIVE') {
        this.sendError(client, message.reqId, 'INVALID_STATE', '진행 중인 길드 퀘스트가 아닙니다.');
        return;
      }

      if (guildQuest.progress < guildQuest.target) {
        this.sendError(client, message.reqId, 'INVALID_STATE', `퀘스트 진행도가 부족합니다. (${guildQuest.progress}/${guildQuest.target})`);
        return;
      }

      // 권한 체크: LEADER 또는 OFFICER만 완료 가능
      if (guildMember.role !== 'LEADER' && guildMember.role !== 'OFFICER') {
        this.sendError(client, message.reqId, 'INVALID_STATE', '길드장 또는 부관만 퀘스트를 완료할 수 있습니다.');
        return;
      }

      // 퀘스트 완료 처리
      await (this.prisma as any).guildQuest.update({
        where: { id: guildQuest.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // 길드 경험치 보상 (퀘스트 완료 시)
      const guildExpReward = 500; // 기본 보상
      const guild = guildMember.guild;
      const newExp = guild.exp + guildExpReward;
      
      let newLevel = guild.level;
      let remainingExp = newExp;
      while (remainingExp >= newLevel * 1000) {
        remainingExp -= newLevel * 1000;
        newLevel++;
      }

      await (this.prisma as any).guild.update({
        where: { id: guild.id },
        data: { exp: remainingExp, level: newLevel },
      });

      if (newLevel > guild.level) {
        await this.updateGuildBuff(guild.id, newLevel);
      }

      this.sendLog(client, 'SYSTEM', `📜 길드 퀘스트 완료: ${questId} (길드 경험치 +${guildExpReward})`);
      this.sendMessage(client, {
        t: 'GUILD_QUEST_TURNIN_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { questId, guildExpReward },
      });

      // 길드원들에게 알림
      const members = await (this.prisma as any).guildMember.findMany({
        where: { guildId: guildMember.guildId },
        include: { character: { select: { id: true } } },
      });
      const memberIds = members.map((m: any) => m.character.id);
      const onlineClients = [...this.clients.entries()].filter(([, d]) => d.characterId && memberIds.includes(d.characterId));
      for (const [ws] of onlineClients) {
        this.sendLog(ws, 'SYSTEM', `📜 길드 퀘스트 완료! 길드 경험치 +${guildExpReward}`);
      }
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '길드 퀘스트 완료 실패');
    }
  }

  private async handleCraftList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const character = await this.prisma.character.findUnique({
      where: { id: clientData.characterId },
      select: { level: true },
    });
    const level = character?.level || 1;
    const recipes = getAllRecipes().map((r) => ({
      id: r.id,
      name: r.name,
      requiredLevel: r.requiredLevel,
      ingredients: r.ingredients,
      resultItemId: r.resultItemId,
      resultQty: r.resultQty,
      // UI 편의: 현재 레벨 정보
      characterLevel: level,
    }));

    this.sendMessage(client, {
      t: 'CRAFT_LIST_OK',
      reqId: message.reqId,
      ts: Date.now(),
      p: { recipes },
    });
  }

  private async handleCraft(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;
    const recipeId = (message.p?.recipeId || '').toString();
    const recipe = getRecipe(recipeId);
    if (!recipe) {
      this.sendError(client, message.reqId, 'INVALID_STATE', '레시피를 찾을 수 없습니다.');
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const character = await tx.character.findUnique({ where: { id: clientData.characterId! } });
        if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');
        if (character.level < recipe.requiredLevel) throw new Error('레벨이 부족합니다.');

        const inv = await tx.inventory.findMany({
          where: { characterId: character.id },
        });
        const invMap = new Map(inv.map((i) => [i.itemId, i.qty]));

        for (const ing of recipe.ingredients) {
          const have = invMap.get(ing.itemId) || 0;
          if (have < ing.qty) {
            throw new Error(`재료 부족: ${ing.itemId} (필요 ${ing.qty}, 보유 ${have})`);
          }
        }

        // 재료 차감
        for (const ing of recipe.ingredients) {
          await tx.inventory.update({
            where: { characterId_itemId: { characterId: character.id, itemId: ing.itemId } },
            data: { qty: { decrement: ing.qty } },
          });
          // qty 0 이하 정리
          await tx.inventory.deleteMany({
            where: { characterId: character.id, itemId: ing.itemId, qty: { lte: 0 } },
          });
        }

        // 결과 지급
        await tx.inventory.upsert({
          where: { characterId_itemId: { characterId: character.id, itemId: recipe.resultItemId } },
          create: { characterId: character.id, itemId: recipe.resultItemId, qty: recipe.resultQty },
          update: { qty: { increment: recipe.resultQty } },
        });

        // 업적 진행(제작)
        try {
          const achId = 'master_craftsman';
          const def = getAchievement(achId);
          if (def) {
            await (tx as any).characterAchievement.upsert({
              where: { characterId_achievementId: { characterId: character.id, achievementId: achId } },
              create: { characterId: character.id, achievementId: achId, progress: 1, target: def.condition.target },
              update: { progress: { increment: 1 }, target: def.condition.target },
            });
          }
        } catch {
          // ignore
        }
      });

      this.sendLog(client, 'SYSTEM', `🛠️ 제작 완료: ${recipe.name} → ${recipe.resultItemId} x${recipe.resultQty}`);
      await this.sendInventoryList(client, clientData.characterId, message.reqId);
      await this.handleCraftList(client, message);
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '제작 실패');
    }
  }

  private async handleAchievementList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const defs = getAllAchievements();
    const rows = await (this.prisma as any).characterAchievement.findMany({
      where: { characterId: clientData.characterId },
    });
    const rowMap = new Map<string, any>(rows.map((r: any) => [r.achievementId, r]));

    const achievements = defs
      .filter((a) => !a.hidden)
      .map((a) => {
        const row: any = rowMap.get(a.id) as any;
        const progress = row?.progress ?? 0;
        const target = row?.target ?? a.condition.target;
        const completed = progress >= target;
        return {
          id: a.id,
          name: a.name,
          description: a.description,
          category: a.category,
          progress,
          maxProgress: target,
          completed,
          completedAt: row?.completedAt ? new Date(row.completedAt).toISOString() : null,
          rewards: a.rewards,
        };
      });

    this.sendMessage(client, {
      t: 'ACHIEVEMENT_LIST_OK',
      reqId: message.reqId,
      ts: Date.now(),
      p: { achievements },
    });
  }

  private async handleAchievementClaim(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;
    const achievementId = (message.p?.achievementId || '').toString();
    const def = getAchievement(achievementId);
    if (!def) {
      this.sendError(client, message.reqId, 'INVALID_STATE', '업적을 찾을 수 없습니다.');
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const row: any = await (tx as any).characterAchievement.findUnique({
          where: { characterId_achievementId: { characterId: clientData.characterId!, achievementId } },
        });
        const progress = row?.progress ?? 0;
        const target = row?.target ?? def.condition.target;
        if (progress < target) throw new Error('아직 업적 조건을 달성하지 않았습니다.');
        if (row?.completedAt) throw new Error('이미 보상을 수령했습니다.');

        // 보상 지급
        if (def.rewards.gold && def.rewards.gold > 0) {
          await tx.character.update({
            where: { id: clientData.characterId! },
            data: { gold: { increment: def.rewards.gold } },
          });
        }
        if (def.rewards.item?.itemId) {
          await tx.inventory.upsert({
            where: { characterId_itemId: { characterId: clientData.characterId!, itemId: def.rewards.item.itemId } },
            create: { characterId: clientData.characterId!, itemId: def.rewards.item.itemId, qty: def.rewards.item.qty },
            update: { qty: { increment: def.rewards.item.qty } },
          });
        }
        // 칭호 보상: title 문자열만 있는 경우, 코스메틱 타이틀 아이템이 있으면 자동 장착 (없으면 무시)
        if (def.rewards.title) {
          // 가장 가까운 방식: 타이틀 아이템이 인벤에 있으면 장착, 없으면 skip
          const titleItem = await tx.item.findFirst({
            where: { id: { startsWith: 'ITEM_TITLE_' }, name: { contains: def.rewards.title } },
          });
          if (titleItem) {
            await tx.inventory.upsert({
              where: { characterId_itemId: { characterId: clientData.characterId!, itemId: titleItem.id } },
              create: { characterId: clientData.characterId!, itemId: titleItem.id, qty: 1 },
              update: { qty: { increment: 1 } },
            });
            await tx.character.update({
              where: { id: clientData.characterId! },
              data: { cosmeticTitleItemId: titleItem.id },
            });
          }
        }

        await (tx as any).characterAchievement.upsert({
          where: { characterId_achievementId: { characterId: clientData.characterId!, achievementId } },
          create: { characterId: clientData.characterId!, achievementId, progress: progress, target: target, completedAt: new Date() },
          update: { completedAt: new Date() },
        });
      });

      this.sendMessage(client, { t: 'ACHIEVEMENT_CLAIM_OK', reqId: message.reqId, ts: Date.now(), p: {} });
      await this.sendStateSync(client, clientData.characterId, message.reqId);
      await this.sendInventoryList(client, clientData.characterId, message.reqId);
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '업적 보상 수령 실패');
    }
  }

  private async handleTradeOfferCreate(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const targetName = (message.p?.targetName || '').toString().trim();
    const offeredGold = Number(message.p?.offeredGold || 0) || 0;
    const offeredItems = Array.isArray(message.p?.offeredItems) ? message.p.offeredItems : [];

    if (!targetName) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'targetName이 필요합니다.');
      return;
    }
    if (offeredGold < 0) {
      this.sendError(client, message.reqId, 'INVALID_STATE', '골드는 0 이상이어야 합니다.');
      return;
    }

    try {
      const fromChar = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { id: true, name: true, gold: true },
      });
      if (!fromChar) throw new Error('캐릭터를 찾을 수 없습니다.');

      const toChar = await this.prisma.character.findFirst({
        where: { name: targetName },
        select: { id: true, name: true },
      });
      if (!toChar) throw new Error('대상 캐릭터를 찾을 수 없습니다.');
      if (toChar.id === fromChar.id) throw new Error('자기 자신에게 거래 제안을 보낼 수 없습니다.');

      // offeredItems 정규화(중복 합치기)
      const itemMap = new Map<string, number>();
      for (const finalAny of offeredItems as any[]) {
        const itemId = (finalAny?.itemId || '').toString();
        const qty = Number(finalAny?.qty || 0) || 0;
        if (!itemId || qty <= 0) continue;
        itemMap.set(itemId, (itemMap.get(itemId) || 0) + qty);
      }
      const itemsNorm = [...itemMap.entries()].map(([itemId, qty]) => ({ itemId, qty }));

      // 에스크로: 제안 시점에 자원 선차감하여 중복/사기 방지
      const offer = await this.prisma.$transaction(async (tx) => {
        if (offeredGold > 0) {
          const c = await tx.character.findUnique({ where: { id: fromChar.id }, select: { gold: true } });
          if (!c || c.gold < offeredGold) throw new Error('골드가 부족합니다.');
          await tx.character.update({
            where: { id: fromChar.id },
            data: { gold: { decrement: offeredGold } },
          });
        }

        for (const it of itemsNorm) {
          const row = await tx.inventory.findUnique({
            where: { characterId_itemId: { characterId: fromChar.id, itemId: it.itemId } },
          });
          if (!row || row.qty < it.qty) throw new Error(`아이템이 부족합니다: ${it.itemId}`);
          await tx.inventory.update({
            where: { characterId_itemId: { characterId: fromChar.id, itemId: it.itemId } },
            data: { qty: { decrement: it.qty } },
          });
          await tx.inventory.deleteMany({
            where: { characterId: fromChar.id, itemId: it.itemId, qty: { lte: 0 } },
          });
        }

        const created = await (tx as any).tradeOffer.create({
          data: {
            fromCharacterId: fromChar.id,
            toCharacterId: toChar.id,
            offeredGold,
            status: 'PENDING',
            items: {
              create: itemsNorm.map((it) => ({ itemId: it.itemId, qty: it.qty })),
            },
          },
        });
        return created;
      });

      this.sendLog(client, 'SYSTEM', `🤝 거래 제안을 보냈습니다: to=${toChar.name} offerId=${offer.id}`);
      await this.sendStateSync(client, clientData.characterId, message.reqId);
      await this.sendInventoryList(client, clientData.characterId, message.reqId);

      // 대상에게 인박스 알림(온라인이면)
      const targetClient = [...this.clients.entries()].find(([, d]) => d.characterId === toChar.id);
      if (targetClient) {
        const [targetWs] = targetClient;
        this.sendMessage(targetWs, {
          t: 'TRADE_OFFER_INBOX',
          ts: Date.now(),
          p: {
            offerId: offer.id,
            fromCharacterId: fromChar.id,
            fromName: fromChar.name,
            offeredGold,
            offeredItems: itemsNorm,
          },
        });
        this.sendLog(targetWs, 'SYSTEM', `🤝 거래 제안 도착: ${fromChar.name} (offerId=${offer.id})`);
      }
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '거래 제안 실패');
    }
  }

  private async handleTradeOfferAccept(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;
    const offerId = (message.p?.offerId || '').toString();
    if (!offerId) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'offerId가 필요합니다.');
      return;
    }

    try {
      const offer = await this.prisma.$transaction(async (tx) => {
        const o = await (tx as any).tradeOffer.findUnique({
          where: { id: offerId },
          include: { items: true, fromCharacter: { select: { name: true } }, toCharacter: { select: { name: true } } },
        });
        if (!o) throw new Error('거래 제안을 찾을 수 없습니다.');
        if (o.status !== 'PENDING') throw new Error('이미 처리된 거래입니다.');
        if (o.toCharacterId !== clientData.characterId) throw new Error('수락 권한이 없습니다.');

        // 수락: 에스크로 자원 -> 수신자에게 지급
        if (o.offeredGold > 0) {
          await tx.character.update({
            where: { id: o.toCharacterId },
            data: { gold: { increment: o.offeredGold } },
          });
        }
        for (const it of o.items) {
          await tx.inventory.upsert({
            where: { characterId_itemId: { characterId: o.toCharacterId, itemId: it.itemId } },
            create: { characterId: o.toCharacterId, itemId: it.itemId, qty: it.qty },
            update: { qty: { increment: it.qty } },
          });
        }

        await (tx as any).tradeOffer.update({
          where: { id: offerId },
          data: { status: 'ACCEPTED' },
        });
        return o;
      });

      this.sendLog(client, 'SYSTEM', `✅ 거래 수락 완료: from=${offer.fromCharacter.name} offerId=${offerId}`);
      this.sendMessage(client, { t: 'TRADE_OFFER_ACCEPT_OK', reqId: message.reqId, ts: Date.now(), p: { offerId } });
      await this.sendStateSync(client, clientData.characterId, message.reqId);
      await this.sendInventoryList(client, clientData.characterId, message.reqId);

      const fromClient = [...this.clients.entries()].find(([, d]) => d.characterId === offer.fromCharacterId);
      if (fromClient) {
        const [ws] = fromClient;
        this.sendLog(ws, 'SYSTEM', `✅ ${offer.toCharacter.name}이(가) 거래를 수락했습니다. offerId=${offerId}`);
        this.sendMessage(ws, { t: 'TRADE_OFFER_ACCEPTED', ts: Date.now(), p: { offerId, toName: offer.toCharacter.name } });
      }
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '거래 수락 실패');
    }
  }

  private async handleTradeOfferReject(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;
    const offerId = (message.p?.offerId || '').toString();
    if (!offerId) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'offerId가 필요합니다.');
      return;
    }

    try {
      const offer = await this.prisma.$transaction(async (tx) => {
        const o = await (tx as any).tradeOffer.findUnique({
          where: { id: offerId },
          include: { items: true, fromCharacter: { select: { name: true } }, toCharacter: { select: { name: true } } },
        });
        if (!o) throw new Error('거래 제안을 찾을 수 없습니다.');
        if (o.status !== 'PENDING') throw new Error('이미 처리된 거래입니다.');
        if (o.toCharacterId !== clientData.characterId) throw new Error('거절 권한이 없습니다.');

        // 거절: 에스크로 반환
        if (o.offeredGold > 0) {
          await tx.character.update({
            where: { id: o.fromCharacterId },
            data: { gold: { increment: o.offeredGold } },
          });
        }
        for (const it of o.items) {
          await tx.inventory.upsert({
            where: { characterId_itemId: { characterId: o.fromCharacterId, itemId: it.itemId } },
            create: { characterId: o.fromCharacterId, itemId: it.itemId, qty: it.qty },
            update: { qty: { increment: it.qty } },
          });
        }

        await (tx as any).tradeOffer.update({
          where: { id: offerId },
          data: { status: 'REJECTED' },
        });
        return o;
      });

      this.sendLog(client, 'SYSTEM', `❌ 거래를 거절했습니다. offerId=${offerId}`);
      this.sendMessage(client, { t: 'TRADE_OFFER_REJECT_OK', reqId: message.reqId, ts: Date.now(), p: { offerId } });
      await this.sendStateSync(client, clientData.characterId, message.reqId);

      const fromClient = [...this.clients.entries()].find(([, d]) => d.characterId === offer.fromCharacterId);
      if (fromClient) {
        const [ws] = fromClient;
        this.sendLog(ws, 'SYSTEM', `❌ ${offer.toCharacter.name}이(가) 거래를 거절했습니다. offerId=${offerId}`);
        this.sendMessage(ws, { t: 'TRADE_OFFER_REJECTED', ts: Date.now(), p: { offerId, toName: offer.toCharacter.name } });
        await this.sendStateSync(ws, offer.fromCharacterId, message.reqId);
        await this.sendInventoryList(ws, offer.fromCharacterId, message.reqId);
      }
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '거래 거절 실패');
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

      // 자원 노드 스폰 체크 (접속 시)
      await this.ensureResourceNodes(character.room.id);

      // MUD UX: 접속 직후 현재 방 묘사/출구/주변을 로그로 출력
      await this.sendLook(client, character.id);
    }
  }

  private async handleLook(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;
    await this.sendLook(client, clientData.characterId);
  }

  private async handleWho(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;
    await this.sendWho(client, clientData.characterId);
  }

  private async handleExits(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;
    await this.sendExits(client, clientData.characterId);
  }

  // (legacy) ensureGroundSeed: 바닥 아이템은 이제 DB 기반 lazy seed로 처리됨

  private async handleRoomItemsList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const character = await this.prisma.character.findUnique({
      where: { id: clientData.characterId },
      select: { roomId: true },
    });
    if (!character) return;

    // Lazy seed (START_TOWN)
    if (character.roomId === 'START_TOWN') {
      const existingAny = await (this.prisma as any).roomGroundItem.findFirst({
        where: { roomId: character.roomId },
        select: { id: true },
      });
      if (!existingAny) {
        // 존재하는 아이템만 추가
        const seed = [
          { itemId: 'ITEM_MAT_ORE_IRON', qty: 2 },
          { itemId: 'ITEM_POTION_HP_S', qty: 1 },
        ];
        for (const s of seed) {
          const item = await this.prisma.item.findUnique({ where: { id: s.itemId } });
          if (!item) continue;
          await (this.prisma as any).roomGroundItem.upsert({
            where: { roomId_itemId: { roomId: character.roomId, itemId: s.itemId } },
            create: { roomId: character.roomId, itemId: s.itemId, qty: s.qty },
            update: { qty: { increment: s.qty } },
          });
        }
      }
    }

    const groundRows = await (this.prisma as any).roomGroundItem.findMany({
      where: { roomId: character.roomId, qty: { gt: 0 } },
      include: { item: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    const payloadItems = groundRows.map((r: any) => ({
      itemId: r.itemId,
      name: r.item?.name || r.itemId,
      qty: r.qty,
    }));

    this.sendMessage(client, {
      t: 'ROOM_ITEMS_LIST',
      reqId: message.reqId,
      ts: Date.now(),
      p: { roomId: character.roomId, items: payloadItems },
    });
  }

  private async sendInventoryList(client: WSClient, characterId: string, reqId?: string) {
    const inventory = await this.prisma.inventory.findMany({
      where: { characterId },
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
      reqId,
      ts: Date.now(),
      p: { inventory: inventoryData },
    });
  }

  private async handleDropItem(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const itemId = message.p?.itemId as string | undefined;
    const qty = Math.max(1, Number(message.p?.qty ?? 1));
    if (!itemId) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'itemId가 필요합니다.');
      return;
    }

    const character = await this.prisma.character.findUnique({
      where: { id: clientData.characterId },
      select: { roomId: true, name: true },
    });
    if (!character) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        const inv = await tx.inventory.findUnique({
          where: { characterId_itemId: { characterId: clientData.characterId!, itemId } },
          include: { item: true },
        });
        if (!inv || inv.qty < qty) {
          throw new Error('인벤토리에 충분한 수량이 없습니다.');
        }

        if (inv.qty === qty) {
          await tx.inventory.delete({
            where: { characterId_itemId: { characterId: clientData.characterId!, itemId } },
          });
        } else {
          await tx.inventory.update({
            where: { characterId_itemId: { characterId: clientData.characterId!, itemId } },
            data: { qty: inv.qty - qty },
          });
        }

        await (tx as any).roomGroundItem.upsert({
          where: { roomId_itemId: { roomId: character.roomId, itemId } },
          create: { roomId: character.roomId, itemId, qty },
          update: { qty: { increment: qty } },
        });

        const msg = `${character.name}이(가) ${inv.item.name} x${qty}을(를) 바닥에 내려놓았습니다.`;
        await this.broadcastToRoom(character.roomId, {
          t: 'LOG_APPEND',
          ts: Date.now(),
          p: { scope: 'WORLD', text: msg } as LogAppendPayload,
        });
      });

      await this.sendInventoryList(client, clientData.characterId, message.reqId);
      await this.handleRoomItemsList(client, { ...message, p: {} });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', error.message || 'DROP_ITEM 실패');
    }
  }

  private async handleGetItem(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const itemId = message.p?.itemId as string | undefined;
    const qty = Math.max(1, Number(message.p?.qty ?? 1));
    if (!itemId) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'itemId가 필요합니다.');
      return;
    }

    const character = await this.prisma.character.findUnique({
      where: { id: clientData.characterId },
      select: { roomId: true, name: true },
    });
    if (!character) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        const row = await (tx as any).roomGroundItem.findUnique({
          where: { roomId_itemId: { roomId: character.roomId, itemId } },
          include: { item: true },
        });
        const available = row?.qty || 0;
        if (available < qty) throw new Error('바닥에 아이템이 충분하지 않습니다.');
        const item = row.item;

        // 바닥 수량 차감
        const newQty = available - qty;
        if (newQty <= 0) {
          await (tx as any).roomGroundItem.delete({
            where: { roomId_itemId: { roomId: character.roomId, itemId } },
          });
        } else {
          await (tx as any).roomGroundItem.update({
            where: { roomId_itemId: { roomId: character.roomId, itemId } },
            data: { qty: newQty },
          });
        }

        await tx.inventory.upsert({
          where: { characterId_itemId: { characterId: clientData.characterId!, itemId } },
          create: { characterId: clientData.characterId!, itemId, qty },
          update: { qty: { increment: qty } },
        });

        const msg = `${character.name}이(가) ${item.name} x${qty}을(를) 주웠습니다.`;
        await this.broadcastToRoom(character.roomId, {
          t: 'LOG_APPEND',
          ts: Date.now(),
          p: { scope: 'WORLD', text: msg } as LogAppendPayload,
        });

        // 퀘스트 트리거(아이템 획득)
        try {
          const questResult = await this.questService.onItemGained(clientData.characterId!, itemId, qty);
          if (questResult.changed) {
            // 해당 클라이언트에만 푸시
            this.sendQuestTrack(client, clientData.characterId!, questResult.active, questResult.completedIds);
          }
        } catch (e) {
          // ignore
        }
      });

      await this.sendInventoryList(client, clientData.characterId, message.reqId);
      await this.handleRoomItemsList(client, { ...message, p: {} });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', error.message || 'GET_ITEM 실패');
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
        // 탐험 기록(방 방문) 저장: 최초 방문이면 업적 진행도 +1
        let firstVisit = false;
        try {
          await (this.prisma as any).characterRoomVisit.create({
            data: { characterId: clientData.characterId, roomId: character.roomId },
          });
          firstVisit = true;
        } catch {
          // unique 충돌이면 이미 방문한 방
        }
        if (firstVisit) {
          for (const achId of ['wanderer', 'cartographer']) {
            const def = getAchievement(achId);
            if (!def) continue;
            try {
              await (this.prisma as any).characterAchievement.upsert({
                where: { characterId_achievementId: { characterId: clientData.characterId, achievementId: achId } },
                create: { characterId: clientData.characterId, achievementId: achId, progress: 1, target: def.condition.target },
                update: { progress: { increment: 1 }, target: def.condition.target },
              });
            } catch {
              // ignore
            }
          }
        }

        const questResult = await this.questService.onMove(clientData.characterId, character.roomId);
        if (questResult.changed) {
          this.sendQuestTrack(client, clientData.characterId, questResult.active, questResult.completedIds);
        }
      }

      await this.sendStateSync(client, clientData.characterId, message.reqId);

      // 자원 노드 스폰 체크 (이동 후)
      if (character) {
        await this.ensureResourceNodes(character.roomId);
      }

      // MUD UX: 이동 후 즉시 새 방 묘사 출력
      await this.sendLook(client, clientData.characterId);
      
      // Party sync: roomId 변경 시
      const partyId = this.partyService.getPartyIdByCharacterId(clientData.characterId);
      if (partyId) {
        await this.sendPartySyncToAll(partyId);
      }
    } catch (error: any) {
      this.sendError(client, message.reqId, 'MOVE_FAILED', error.message || '이동 실패');
    }
  }

  private async handleSearch(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { id: true, name: true, roomId: true, hp: true, hpMax: true, gold: true },
      });
      if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');

      // 간단 랜덤 이벤트 테이블
      const roll = Math.random();

      if (roll < 0.50) {
        this.sendLog(client, 'WORLD', '주변을 샅샅이 뒤졌지만… 아무것도 찾지 못했습니다.');
        return;
      }

      // 30%: 골드
      if (roll < 0.80) {
        const gain = 5 + Math.floor(Math.random() * 46); // 5~50
        await this.prisma.character.update({
          where: { id: character.id },
          data: { gold: { increment: gain } },
        });
        this.sendLog(client, 'WORLD', `💰 동전주머니를 발견했습니다! (+${gain}G)`);
        await this.sendStateSync(client, clientData.characterId, message.reqId);
        return;
      }

      // 15%: 아이템(바닥에 떨어뜨리기)
      if (roll < 0.95) {
        const pool = ['ITEM_MAT_ORE_IRON', 'ITEM_MAT_LEATHER', 'ITEM_POTION_HP_S'];
        const itemId = pool[Math.floor(Math.random() * pool.length)];
        const qty = itemId.startsWith('ITEM_POTION') ? 1 : 1 + Math.floor(Math.random() * 3);

        await (this.prisma as any).roomGroundItem.upsert({
          where: { roomId_itemId: { roomId: character.roomId, itemId } },
          create: { roomId: character.roomId, itemId, qty },
          update: { qty: { increment: qty } },
        });

        const item = await this.prisma.item.findUnique({ where: { id: itemId }, select: { name: true } });
        this.sendLog(client, 'WORLD', `🧺 무언가를 발견했습니다: ${item?.name || itemId} x${qty} (바닥)`);
        await this.handleRoomItemsList(client, { ...message, p: {} });
        return;
      }

      // 5%: 함정(HP 감소)
      const dmg = 5 + Math.floor(Math.random() * 16); // 5~20
      const newHp = Math.max(1, character.hp - dmg);
      await this.prisma.character.update({
        where: { id: character.id },
        data: { hp: newHp },
      });
      this.sendLog(client, 'WORLD', `☠️ 함정이다! (-${dmg} HP)`);
      await this.sendStateSync(client, clientData.characterId, message.reqId);
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || 'search 실패');
    }
  }

  // ===== GATHERING (C) =====

  private async handleNodeList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { roomId: true },
      });
      if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');

      const now = new Date();
      const nodes = await (this.prisma as any).resourceNode.findMany({
        where: {
          roomId: character.roomId,
          currentHp: { gt: 0 },
          respawnAt: { lte: now },
        },
        orderBy: { nodeType: 'asc' },
      });

      this.sendMessage(client, {
        t: 'NODE_LIST_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          nodes: nodes.map((n: any) => ({
            id: n.id,
            nodeType: n.nodeType,
            currentHp: n.currentHp,
            maxHp: n.maxHp,
          })),
        },
      });
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '자원 노드 목록 조회 실패');
    }
  }

  private async handleGather(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const nodeId = (message.p?.nodeId || '').toString().trim();
    if (!nodeId) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'nodeId가 필요합니다.');
      return;
    }

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { id: true, name: true, roomId: true },
      });
      if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');

      const node = await (this.prisma as any).resourceNode.findUnique({
        where: { id: nodeId },
      });
      if (!node) throw new Error('자원 노드를 찾을 수 없습니다.');
      if (node.roomId !== character.roomId) throw new Error('같은 방에 있지 않습니다.');
      if (node.currentHp <= 0) throw new Error('이미 고갈된 자원입니다.');
      if (node.respawnAt > new Date()) throw new Error('아직 리젠되지 않았습니다.');

      // 채집: HP 감소 (10~20 랜덤)
      const damage = 10 + Math.floor(Math.random() * 11);
      const newHp = Math.max(0, node.currentHp - damage);
      const gathered = newHp < node.currentHp;

      // 자원 타입별 드롭 아이템 매핑
      const dropMap: Record<string, { itemId: string; qty: number }> = {
        ORE_IRON: { itemId: 'ITEM_MAT_ORE_IRON', qty: 1 + Math.floor(Math.random() * 3) },
        ORE_GOLD: { itemId: 'ITEM_MAT_ORE_GOLD', qty: 1 },
        HERB_RED: { itemId: 'ITEM_MAT_HERB_RED', qty: 1 + Math.floor(Math.random() * 2) },
        TREE_OAK: { itemId: 'ITEM_MAT_WOOD_OAK', qty: 1 + Math.floor(Math.random() * 3) },
      };

      const drop = dropMap[node.nodeType] || { itemId: 'ITEM_MAT_ORE_IRON', qty: 1 };

      await this.prisma.$transaction(async (tx) => {
        if (gathered && drop.itemId) {
          // 바닥에 아이템 드롭
          await (tx as any).roomGroundItem.upsert({
            where: { roomId_itemId: { roomId: character.roomId, itemId: drop.itemId } },
            create: { roomId: character.roomId, itemId: drop.itemId, qty: drop.qty },
            update: { qty: { increment: drop.qty } },
          });
        }

        // 노드 HP 업데이트
        const respawnAt = new Date();
        respawnAt.setMinutes(respawnAt.getMinutes() + 60); // 기본 60분 리젠

        if (newHp <= 0) {
          // 고갈: 리젠 시간 설정
          await (tx as any).resourceNode.update({
            where: { id: nodeId },
            data: { currentHp: 0, respawnAt },
          });
        } else {
          await (tx as any).resourceNode.update({
            where: { id: nodeId },
            data: { currentHp: newHp },
          });
        }
      });

      if (gathered) {
        const item = await this.prisma.item.findUnique({ where: { id: drop.itemId }, select: { name: true } });
        this.sendLog(client, 'WORLD', `⛏️ 채집 성공! ${item?.name || drop.itemId} x${drop.qty} (바닥)`);
        await this.handleRoomItemsList(client, { ...message, p: {} });
      } else {
        this.sendLog(client, 'WORLD', '⛏️ 채집 실패... (HP 부족)');
      }

      this.sendMessage(client, {
        t: 'GATHER_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { nodeId, gathered, itemId: gathered ? drop.itemId : null, qty: gathered ? drop.qty : 0 },
      });
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '채집 실패');
    }
  }

  // ===== MARKETPLACE (A) =====

  private async cleanupExpiredMarketplaceListings() {
    try {
      const now = new Date();
      const expired = await (this.prisma as any).marketplaceListing.findMany({
        where: {
          status: 'ACTIVE',
          expiresAt: { lte: now },
        },
        include: {
          sellerCharacter: { select: { id: true } },
        },
      });

      for (const listing of expired) {
        await this.prisma.$transaction(async (tx) => {
          // 입찰자에게 골드 반환
          if (listing.currentBidderId && listing.currentBid) {
            await tx.character.update({
              where: { id: listing.currentBidderId },
              data: { gold: { increment: listing.currentBid } },
            });
          }

          // 판매자에게 아이템 반환
          await tx.inventory.upsert({
            where: { characterId_itemId: { characterId: listing.sellerCharacterId, itemId: listing.itemId } },
            create: { characterId: listing.sellerCharacterId, itemId: listing.itemId, qty: listing.qty },
            update: { qty: { increment: listing.qty } },
          });

          // 경매 만료 처리
          await (tx as any).marketplaceListing.update({
            where: { id: listing.id },
            data: { status: 'EXPIRED' },
          });
        });
      }

      if (expired.length > 0) {
        console.log(`[Marketplace] 만료된 경매 ${expired.length}개 정리 완료`);
      }
    } catch (e: any) {
      console.error(`[Marketplace] 만료 경매 정리 실패: ${e?.message}`);
    }
  }

  private async handleMarketplaceList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      // 만료된 경매 자동 정리 (백그라운드)
      await this.cleanupExpiredMarketplaceListings();

      const page = Number(message.p?.page || 1) || 1;
      const limit = Math.min(Number(message.p?.limit || 50) || 50, 100);
      const skip = (page - 1) * limit;
      const itemIdFilter = (message.p?.itemId || '').toString().trim();

      const where: any = {
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      };
      if (itemIdFilter) {
        where.itemId = itemIdFilter;
      }

      const [listings, total] = await Promise.all([
        (this.prisma as any).marketplaceListing.findMany({
          where,
          include: {
            sellerCharacter: { select: { id: true, name: true } },
            item: { select: { id: true, name: true, icon: true, rarity: true } },
            bids: { orderBy: { createdAt: 'desc' }, take: 1, include: { bidder: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        (this.prisma as any).marketplaceListing.count({ where }),
      ]);

      this.sendMessage(client, {
        t: 'MARKETPLACE_LIST_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          listings: listings.map((l: any) => ({
            id: l.id,
            sellerName: l.sellerCharacter.name,
            itemId: l.itemId,
            itemName: l.item.name,
            itemIcon: l.item.icon,
            itemRarity: l.item.rarity,
            qty: l.qty,
            startingPrice: l.startingPrice,
            buyNowPrice: l.buyNowPrice,
            currentBid: l.currentBid,
            currentBidderName: l.bids[0]?.bidder?.name || null,
            expiresAt: l.expiresAt.toISOString(),
            createdAt: l.createdAt.toISOString(),
          })),
          total,
          page,
          limit,
        },
      });
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '경매장 목록 조회 실패');
    }
  }

  private async handleMarketplaceListingCreate(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const itemId = (message.p?.itemId || '').toString().trim();
    const qty = Number(message.p?.qty || 1) || 1;
    const startingPrice = Number(message.p?.startingPrice || 0) || 0;
    const buyNowPrice = message.p?.buyNowPrice != null ? Number(message.p.buyNowPrice) : null;
    const durationHours = Number(message.p?.durationHours || 24) || 24;

    if (!itemId || qty <= 0 || startingPrice <= 0) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'itemId, qty(>0), startingPrice(>0)가 필요합니다.');
      return;
    }
    if (buyNowPrice != null && buyNowPrice <= startingPrice) {
      this.sendError(client, message.reqId, 'INVALID_STATE', '즉시구매가는 시작가보다 높아야 합니다.');
      return;
    }

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { id: true, name: true, gold: true },
      });
      if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');

      const inv = await this.prisma.inventory.findUnique({
        where: { characterId_itemId: { characterId: character.id, itemId } },
      });
      if (!inv || inv.qty < qty) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '인벤토리에 아이템이 부족합니다.');
        return;
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + durationHours);

      const listing = await this.prisma.$transaction(async (tx) => {
        // 인벤에서 아이템 차감
        await tx.inventory.update({
          where: { characterId_itemId: { characterId: character.id, itemId } },
          data: { qty: { decrement: qty } },
        });
        await tx.inventory.deleteMany({
          where: { characterId: character.id, itemId, qty: { lte: 0 } },
        });

        // 경매장 등록
        const created = await (tx as any).marketplaceListing.create({
          data: {
            sellerCharacterId: character.id,
            itemId,
            qty,
            startingPrice,
            buyNowPrice,
            status: 'ACTIVE',
            expiresAt,
          },
        });
        return created;
      });

      this.sendLog(client, 'SYSTEM', `🏪 경매장에 등록했습니다: ${itemId} x${qty} (시작가: ${startingPrice}G)`);
      this.sendMessage(client, {
        t: 'MARKETPLACE_LISTING_CREATE_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { listingId: listing.id },
      });
      await this.sendStateSync(client, clientData.characterId, message.reqId);
      await this.sendInventoryList(client, clientData.characterId, message.reqId);
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '경매장 등록 실패');
    }
  }

  private async handleMarketplaceBid(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const listingId = (message.p?.listingId || '').toString().trim();
    const bidAmount = Number(message.p?.bidAmount || 0) || 0;

    if (!listingId || bidAmount <= 0) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'listingId와 bidAmount(>0)가 필요합니다.');
      return;
    }

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { id: true, name: true, gold: true },
      });
      if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');

      const listing = await (this.prisma as any).marketplaceListing.findUnique({
        where: { id: listingId },
        include: {
          sellerCharacter: { select: { id: true, name: true } },
          item: { select: { name: true } },
        },
      });
      if (!listing) throw new Error('경매를 찾을 수 없습니다.');
      if (listing.status !== 'ACTIVE') throw new Error('종료된 경매입니다.');
      if (listing.expiresAt < new Date()) throw new Error('만료된 경매입니다.');
      if (listing.sellerCharacterId === character.id) throw new Error('자신의 경매에는 입찰할 수 없습니다.');

      const minBid = listing.currentBid ? listing.currentBid + 1 : listing.startingPrice;
      if (bidAmount < minBid) {
        this.sendError(client, message.reqId, 'INVALID_STATE', `최소 입찰가는 ${minBid}G입니다.`);
        return;
      }
      if (character.gold < bidAmount) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '골드가 부족합니다.');
        return;
      }

      await this.prisma.$transaction(async (tx) => {
        // 이전 입찰자에게 골드 반환
        if (listing.currentBidderId) {
          await tx.character.update({
            where: { id: listing.currentBidderId },
            data: { gold: { increment: listing.currentBid } },
          });
        }

        // 새 입찰자 골드 차감
        await tx.character.update({
          where: { id: character.id },
          data: { gold: { decrement: bidAmount } },
        });

        // 입찰 기록
        await (tx as any).marketplaceBid.create({
          data: { listingId, bidderCharacterId: character.id, bidAmount },
        });

        // 경매 정보 업데이트
        await (tx as any).marketplaceListing.update({
          where: { id: listingId },
          data: { currentBid: bidAmount, currentBidderId: character.id },
        });
      });

      this.sendLog(client, 'SYSTEM', `💰 입찰했습니다: ${listing.item.name} (${bidAmount}G)`);
      this.sendMessage(client, {
        t: 'MARKETPLACE_BID_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { listingId, bidAmount },
      });
      await this.sendStateSync(client, clientData.characterId, message.reqId);

      // 판매자에게 알림
      const sellerClient = [...this.clients.entries()].find(([, d]) => d.characterId === listing.sellerCharacterId);
      if (sellerClient) {
        const [ws] = sellerClient;
        this.sendLog(ws, 'SYSTEM', `💰 ${character.name}이(가) 입찰했습니다: ${bidAmount}G`);
      }
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '입찰 실패');
    }
  }

  private async handleMarketplaceBuyNow(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const listingId = (message.p?.listingId || '').toString().trim();
    if (!listingId) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'listingId가 필요합니다.');
      return;
    }

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { id: true, name: true, gold: true },
      });
      if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');

      const listing = await (this.prisma as any).marketplaceListing.findUnique({
        where: { id: listingId },
        include: {
          sellerCharacter: { select: { id: true, name: true } },
          item: { select: { name: true } },
        },
      });
      if (!listing) throw new Error('경매를 찾을 수 없습니다.');
      if (listing.status !== 'ACTIVE') throw new Error('종료된 경매입니다.');
      if (listing.expiresAt < new Date()) throw new Error('만료된 경매입니다.');
      if (!listing.buyNowPrice) throw new Error('즉시구매가가 설정되지 않았습니다.');
      if (listing.sellerCharacterId === character.id) throw new Error('자신의 경매는 구매할 수 없습니다.');
      if (character.gold < listing.buyNowPrice) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '골드가 부족합니다.');
        return;
      }

      await this.prisma.$transaction(async (tx) => {
        // 구매자 골드 차감
        await tx.character.update({
          where: { id: character.id },
          data: { gold: { decrement: listing.buyNowPrice } },
        });

        // 판매자에게 골드 지급
        await tx.character.update({
          where: { id: listing.sellerCharacterId },
          data: { gold: { increment: listing.buyNowPrice } },
        });

        // 이전 입찰자에게 골드 반환
        if (listing.currentBidderId && listing.currentBid) {
          await tx.character.update({
            where: { id: listing.currentBidderId },
            data: { gold: { increment: listing.currentBid } },
          });
        }

        // 아이템 지급
        await tx.inventory.upsert({
          where: { characterId_itemId: { characterId: character.id, itemId: listing.itemId } },
          create: { characterId: character.id, itemId: listing.itemId, qty: listing.qty },
          update: { qty: { increment: listing.qty } },
        });

        // 경매 종료
        await (tx as any).marketplaceListing.update({
          where: { id: listingId },
          data: { status: 'SOLD', currentBidderId: character.id },
        });
      });

      this.sendLog(client, 'SYSTEM', `✅ 즉시구매 완료: ${listing.item.name} x${listing.qty} (${listing.buyNowPrice}G)`);
      this.sendMessage(client, {
        t: 'MARKETPLACE_BUY_NOW_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { listingId },
      });
      await this.sendStateSync(client, clientData.characterId, message.reqId);
      await this.sendInventoryList(client, clientData.characterId, message.reqId);

      // 판매자에게 알림
      const sellerClient = [...this.clients.entries()].find(([, d]) => d.characterId === listing.sellerCharacterId);
      if (sellerClient) {
        const [ws] = sellerClient;
        this.sendLog(ws, 'SYSTEM', `✅ ${character.name}이(가) 즉시구매했습니다: ${listing.buyNowPrice}G`);
        await this.sendStateSync(ws, listing.sellerCharacterId, message.reqId);
      }
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '즉시구매 실패');
    }
  }

  private async handleMarketplaceCancel(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const listingId = (message.p?.listingId || '').toString().trim();
    if (!listingId) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'listingId가 필요합니다.');
      return;
    }

    try {
      const listing = await (this.prisma as any).marketplaceListing.findUnique({
        where: { id: listingId },
        include: {
          sellerCharacter: { select: { id: true, name: true } },
          item: { select: { name: true } },
        },
      });
      if (!listing) throw new Error('경매를 찾을 수 없습니다.');
      if (listing.status !== 'ACTIVE') throw new Error('취소할 수 없는 경매입니다.');
      if (listing.sellerCharacterId !== clientData.characterId) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '본인의 경매만 취소할 수 있습니다.');
        return;
      }

      await this.prisma.$transaction(async (tx) => {
        // 입찰자에게 골드 반환
        if (listing.currentBidderId && listing.currentBid) {
          await tx.character.update({
            where: { id: listing.currentBidderId },
            data: { gold: { increment: listing.currentBid } },
          });
        }

        // 아이템 반환
        await tx.inventory.upsert({
          where: { characterId_itemId: { characterId: listing.sellerCharacterId, itemId: listing.itemId } },
          create: { characterId: listing.sellerCharacterId, itemId: listing.itemId, qty: listing.qty },
          update: { qty: { increment: listing.qty } },
        });

        // 경매 취소
        await (tx as any).marketplaceListing.update({
          where: { id: listingId },
          data: { status: 'CANCELLED' },
        });
      });

      this.sendLog(client, 'SYSTEM', `❌ 경매를 취소했습니다: ${listing.item.name} x${listing.qty}`);
      this.sendMessage(client, {
        t: 'MARKETPLACE_CANCEL_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { listingId },
      });
      await this.sendStateSync(client, clientData.characterId, message.reqId);
      await this.sendInventoryList(client, clientData.characterId, message.reqId);
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '경매 취소 실패');
    }
  }

  // ===== PVP (E) =====

  private async handlePvpChallenge(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const defenderName = (message.p?.defenderName || '').toString().trim();
    const betGold = Number(message.p?.betGold || 0) || 0;

    if (!defenderName) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'defenderName이 필요합니다.');
      return;
    }
    if (betGold < 0) {
      this.sendError(client, message.reqId, 'INVALID_STATE', '배팅 골드는 0 이상이어야 합니다.');
      return;
    }

    try {
      const challenger = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { id: true, name: true, gold: true },
      });
      if (!challenger) throw new Error('캐릭터를 찾을 수 없습니다.');

      const defender = await this.prisma.character.findFirst({
        where: { name: defenderName },
        select: { id: true, name: true },
      });
      if (!defender) throw new Error('대상 캐릭터를 찾을 수 없습니다.');
      if (defender.id === challenger.id) throw new Error('자기 자신에게 도전할 수 없습니다.');

      if (betGold > 0 && challenger.gold < betGold) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '골드가 부족합니다.');
        return;
      }

      const match = await this.prisma.$transaction(async (tx) => {
        if (betGold > 0) {
          await tx.character.update({
            where: { id: challenger.id },
            data: { gold: { decrement: betGold } },
          });
        }

        return await (tx as any).pvpMatch.create({
          data: {
            challengerId: challenger.id,
            defenderId: defender.id,
            betGold,
            status: 'PENDING',
          },
        });
      });

      this.sendLog(client, 'SYSTEM', `⚔️ PVP 도전: ${defender.name} (배팅: ${betGold}G)`);
      this.sendMessage(client, {
        t: 'PVP_CHALLENGE_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { matchId: match.id },
      });
      await this.sendStateSync(client, clientData.characterId, message.reqId);

      // 수비자에게 알림
      const defenderClient = [...this.clients.entries()].find(([, d]) => d.characterId === defender.id);
      if (defenderClient) {
        const [ws] = defenderClient;
        this.sendLog(ws, 'SYSTEM', `⚔️ ${challenger.name}이(가) PVP 도전했습니다! (배팅: ${betGold}G) matchId=${match.id}`);
        this.sendMessage(ws, {
          t: 'PVP_CHALLENGE_RECEIVED',
          ts: Date.now(),
          p: { matchId: match.id, challengerName: challenger.name, betGold },
        });
      }
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || 'PVP 도전 실패');
    }
  }

  private async handlePvpAccept(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const matchId = (message.p?.matchId || '').toString().trim();
    if (!matchId) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'matchId가 필요합니다.');
      return;
    }

    try {
      const match = await (this.prisma as any).pvpMatch.findUnique({
        where: { id: matchId },
        include: {
          challenger: { select: { id: true, name: true, hp: true, hpMax: true, level: true } },
          defender: { select: { id: true, name: true, hp: true, hpMax: true, level: true } },
        },
      });
      if (!match) throw new Error('매치를 찾을 수 없습니다.');
      if (match.status !== 'PENDING') throw new Error('이미 처리된 매치입니다.');
      if (match.defenderId !== clientData.characterId) throw new Error('수락 권한이 없습니다.');

      // 간단 PVP: 레벨+HP 비교로 승부 결정
      const challengerPower = match.challenger.level * 10 + match.challenger.hp;
      const defenderPower = match.defender.level * 10 + match.defender.hp;
      const challengerWins = challengerPower > defenderPower;

      await this.prisma.$transaction(async (tx) => {
        // 수비자도 배팅 골드 차감 (동일 금액)
        if (match.betGold > 0) {
          const defender = await tx.character.findUnique({ where: { id: match.defenderId }, select: { gold: true } });
          if (!defender || defender.gold < match.betGold) {
            throw new Error('수비자 골드가 부족합니다.');
          }
          await tx.character.update({
            where: { id: match.defenderId },
            data: { gold: { decrement: match.betGold } },
          });
        }

        // 승자에게 배팅 골드 지급
        const winnerId = challengerWins ? match.challengerId : match.defenderId;
        if (match.betGold > 0) {
          await tx.character.update({
            where: { id: winnerId },
            data: { gold: { increment: match.betGold * 2 } },
          });
        }

        // 랭킹 업데이트
        await (tx as any).pvpRanking.upsert({
          where: { characterId: match.challengerId },
          create: { characterId: match.challengerId, rating: 1000, wins: challengerWins ? 1 : 0, losses: challengerWins ? 0 : 1 },
          update: {
            wins: { increment: challengerWins ? 1 : 0 },
            losses: { increment: challengerWins ? 0 : 1 },
            rating: { increment: challengerWins ? 20 : -20 },
          },
        });
        await (tx as any).pvpRanking.upsert({
          where: { characterId: match.defenderId },
          create: { characterId: match.defenderId, rating: 1000, wins: challengerWins ? 0 : 1, losses: challengerWins ? 1 : 0 },
          update: {
            wins: { increment: challengerWins ? 0 : 1 },
            losses: { increment: challengerWins ? 1 : 0 },
            rating: { increment: challengerWins ? -20 : 20 },
          },
        });

        // 매치 종료
        await (tx as any).pvpMatch.update({
          where: { id: matchId },
          data: { status: 'FINISHED', winnerId, finishedAt: new Date() },
        });
      });

      const winnerName = challengerWins ? match.challenger.name : match.defender.name;
      const winnerId = challengerWins ? match.challengerId : match.defenderId;
      
      // 길드 전쟁 점수 업데이트 (해당하는 경우)
      const guildWarMatch = await (this.prisma as any).guildWarMatch.findFirst({
        where: {
          OR: [
            { challengerCharacterId: match.challengerId, defenderCharacterId: match.defenderId },
            { challengerCharacterId: match.defenderId, defenderCharacterId: match.challengerId },
          ],
          finishedAt: null,
        },
        include: { war: true },
        orderBy: { createdAt: 'desc' },
      });
      if (guildWarMatch && guildWarMatch.war.status === 'ACTIVE') {
        await this.updateGuildWarScore(guildWarMatch.warId, winnerId);
      }

      this.sendLog(client, 'SYSTEM', `⚔️ PVP 완료! 승자: ${winnerName} (배팅: ${match.betGold * 2}G)`);
      this.sendMessage(client, {
        t: 'PVP_ACCEPT_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { matchId, winnerId },
      });
      await this.sendStateSync(client, clientData.characterId, message.reqId);

      // 도전자에게 알림
      const challengerClient = [...this.clients.entries()].find(([, d]) => d.characterId === match.challengerId);
      if (challengerClient) {
        const [ws] = challengerClient;
        this.sendLog(ws, 'SYSTEM', `⚔️ PVP 완료! 승자: ${winnerName} (배팅: ${match.betGold * 2}G)`);
        await this.sendStateSync(ws, match.challengerId, message.reqId);
      }
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || 'PVP 수락 실패');
    }
  }

  private async handlePvpRanking(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const limit = Math.min(Number(message.p?.limit || 50) || 50, 100);
      const rankings = await (this.prisma as any).pvpRanking.findMany({
        include: { character: { select: { name: true } } },
        orderBy: { rating: 'desc' },
        take: limit,
      });

      this.sendMessage(client, {
        t: 'PVP_RANKING_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          rankings: rankings.map((r: any) => ({
            characterName: r.character.name,
            rating: r.rating,
            wins: r.wins,
            losses: r.losses,
            draws: r.draws,
          })),
        },
      });
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '랭킹 조회 실패');
    }
  }

  // ===== GUILD EXP =====

  private async addGuildExp(characterId: string, expGained: number) {
    try {
      const guildMember = await (this.prisma as any).guildMember.findUnique({
        where: { characterId },
        include: { guild: true },
      });
      if (!guildMember) return; // 길드에 속하지 않음

      const guildExpGain = Math.floor(expGained * 0.1); // 획득 경험치의 10%를 길드 경험치로
      if (guildExpGain <= 0) return;

      const guild = guildMember.guild;
      const newExp = guild.exp + guildExpGain;
      
      // 레벨업 체크 (레벨당 필요 경험치: 레벨 * 1000)
      let newLevel = guild.level;
      let remainingExp = newExp;
      while (remainingExp >= newLevel * 1000) {
        remainingExp -= newLevel * 1000;
        newLevel++;
      }

      await (this.prisma as any).guild.update({
        where: { id: guild.id },
        data: { exp: remainingExp, level: newLevel },
      });

      if (newLevel > guild.level) {
        console.log(`[GUILD] ${guild.name} 레벨업! ${guild.level} → ${newLevel}`);
        // 레벨업 시 버프 업데이트
        await this.updateGuildBuff(guild.id, newLevel);
      }
    } catch (e: any) {
      // 길드 경험치 추가 실패는 조용히 처리
      console.error(`[GUILD] 경험치 추가 실패: characterId=${characterId}, error=${e?.message}`);
    }
  }

  // 길드 버프 업데이트 (레벨별)
  private async updateGuildBuff(guildId: string, level: number) {
    try {
      // 레벨별 버프 계산 (레벨당 1%씩 증가, 최대 20%)
      const expBonus = Math.min(level * 1, 20);
      const goldBonus = Math.min(level * 1, 20);
      const atkBonus = Math.min(Math.floor(level / 2), 10);
      const defBonus = Math.min(Math.floor(level / 2), 10);
      const hpBonus = Math.min(Math.floor(level / 3), 10);

      await (this.prisma as any).guildBuff.upsert({
        where: { guildId },
        create: {
          guildId,
          expBonus,
          goldBonus,
          atkBonus,
          defBonus,
          hpBonus,
        },
        update: {
          expBonus,
          goldBonus,
          atkBonus,
          defBonus,
          hpBonus,
        },
      });
    } catch (e: any) {
      console.error(`[GUILD] 버프 업데이트 실패: guildId=${guildId}, error=${e?.message}`);
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
    const tags = room.tags ? JSON.parse(typeof room.tags === 'string' ? room.tags : JSON.stringify(room.tags)) as string[] : [];
    const isBossRoom = tags.includes('BOSS');
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
        partySnapshot: (() => {
          const stateStr = (encounter as any).stateString;
          return JSON.parse(typeof stateStr === 'string' ? stateStr : '{}').party || [];
        })(),
        enemySnapshot: (() => {
          const stateStr = (encounter as any).stateString;
          return JSON.parse(typeof stateStr === 'string' ? stateStr : '{}').enemies || [];
        })(),
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
    this.sendLog(client, 'COMBAT', '타임뱅크 사용 (+3초)');
  }

  private async handleChatSend(client: WSClient, message: WSMessage) {
    const { channel, text, toName } = message.p;
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    await this.chatService.sendChat(clientData.characterId, channel, text, toName);

    const from = await this.prisma.character.findUnique({
      where: { id: clientData.characterId },
      select: { name: true, roomId: true },
    });
    const fromName = from?.name || '누군가';
    const roomId = from?.roomId;

    // MUD UX: 채팅을 나 혼자만 보지 말고, 채널에 맞게 브로드캐스트
    const normalizedChannel = (channel || 'GLOBAL').toString().toUpperCase();
    const line =
      normalizedChannel === 'LOCAL'
        ? `${fromName}: ${text}`
        : `[${normalizedChannel}] ${fromName}: ${text}`;

    const payload = {
      t: 'LOG_APPEND',
      ts: Date.now(),
      p: { scope: 'CHAT', text: line } as LogAppendPayload,
    };

    if (normalizedChannel === 'LOCAL' && roomId) {
      await this.broadcastToRoom(roomId, payload);
    } else if (normalizedChannel === 'GLOBAL') {
      this.broadcastToAll(payload);
    } else {
      // PARTY/WHISPER 등은 추후 구현: 일단 보낸 사람에게만 표시
      this.sendMessage(client, payload);
    }
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

  private broadcastToAll(message: any) {
    for (const [client] of this.clients.entries()) {
      this.sendMessage(client, message);
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

  // ===== RESOURCE NODE SPAWN =====

  private async ensureResourceNodes(roomId: string) {
    try {
      const now = new Date();
      
      // 1) NodeSpawn 설정 조회
      const spawns = await (this.prisma as any).nodeSpawn.findMany({
        where: { roomId },
      });
      if (spawns.length === 0) return; // 스폰 설정이 없으면 스킵

      // 2) 각 스폰 설정별로 노드 확인 및 생성
      for (const spawn of spawns) {
        // 확률 체크
        const roll = Math.floor(Math.random() * 10000);
        if (roll >= spawn.spawnChance) continue; // 스폰 실패

        // 기존 노드 확인
        const existing = await (this.prisma as any).resourceNode.findUnique({
          where: { roomId_nodeType: { roomId, nodeType: spawn.nodeType } },
        });

        if (existing) {
          // 기존 노드가 있으면 리젠 체크
          if (existing.currentHp <= 0 && existing.respawnAt <= now) {
            // 리젠 시간이 지났으면 HP 복구
            const newHp = spawn.minHp + Math.floor(Math.random() * (spawn.maxHp - spawn.minHp + 1));
            const respawnAt = new Date();
            respawnAt.setMinutes(respawnAt.getMinutes() + spawn.respawnMinutes);

            await (this.prisma as any).resourceNode.update({
              where: { id: existing.id },
              data: {
                currentHp: newHp,
                maxHp: newHp,
                respawnAt,
              },
            });
          }
        } else {
          // 노드가 없으면 생성
          const hp = spawn.minHp + Math.floor(Math.random() * (spawn.maxHp - spawn.minHp + 1));
          const respawnAt = new Date();
          respawnAt.setMinutes(respawnAt.getMinutes() + spawn.respawnMinutes);

          await (this.prisma as any).resourceNode.create({
            data: {
              roomId,
              nodeType: spawn.nodeType,
              maxHp: hp,
              currentHp: hp,
              respawnAt,
            },
          });
        }
      }
    } catch (e: any) {
      // 노드 스폰 실패는 조용히 처리 (게임 플레이에 치명적이지 않음)
      console.error(`[ensureResourceNodes] 실패: roomId=${roomId}, error=${e?.message}`);
    }
  }

  private async sendLook(client: WSClient, characterId: string) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: {
        room: {
          include: {
            exitsFrom: {
              include: { toRoom: true },
            },
            characters: {
              select: { id: true, name: true },
            },
            spawns: {
              include: { monster: true },
            },
          },
        },
      },
    });

    if (!character?.room) return;

    // 자원 노드 스폰 체크 (LOOK 시)
    await this.ensureResourceNodes(character.room.id);
    const room = character.room;

    const others = (room.characters || [])
      .filter((c) => c.id !== characterId)
      .map((c) => c.name)
      .filter(Boolean);

    const monsterNames = (room.spawns || [])
      .map((s) => s.monster?.name)
      .filter((n): n is string => !!n);
    const uniqueMonsters = Array.from(new Set(monsterNames));

    const exits = (room.exitsFrom || []).map((e) => {
      const toName = (e as any).toRoom?.name as string | undefined;
      return toName ? `${e.label} → ${toName}` : e.label;
    });

    const desc = (room.description || '').trim();
    const lines: string[] = [];
    lines.push(`== ${room.name} [${room.id}] ==`);
    if (desc.length > 0) {
      lines.push(desc);
    } else {
      lines.push('(묘사가 없습니다)');
    }
    lines.push('');
    lines.push(exits.length ? `출구: ${exits.join(', ')}` : '출구: 없음');
    lines.push(uniqueMonsters.length ? `기척: ${uniqueMonsters.join(', ')}` : '기척: 없음');
    lines.push(others.length ? `주변 사람: ${others.join(', ')}` : '주변 사람: 없음');
    lines.push('');
    lines.push('명령: look, n/s/e/w/u/d, say <text>, help');

    this.sendLog(client, 'WORLD', lines.join('\n'));
  }

  private async sendWho(client: WSClient, characterId: string) {
    const me = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { roomId: true, name: true },
    });
    if (!me) return;

    const chars = await this.prisma.character.findMany({
      where: { roomId: me.roomId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const others = chars.filter((c) => c.id !== characterId).map((c) => c.name);
    const lines: string[] = [];
    lines.push(`현재 방 (${me.roomId})`);
    lines.push(`- 나: ${me.name}`);
    if (others.length) {
      lines.push(`- 다른 사람(${others.length}): ${others.join(', ')}`);
    } else {
      lines.push('- 다른 사람: 없음');
    }
    this.sendLog(client, 'WORLD', lines.join('\n'));
  }

  private async sendExits(client: WSClient, characterId: string) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: {
        room: {
          include: {
            exitsFrom: { include: { toRoom: true } },
          },
        },
      },
    });
    if (!character?.room) return;
    const room = character.room;
    const exits = (room.exitsFrom || []).map((e) => {
      const toName = (e as any).toRoom?.name as string | undefined;
      return toName ? `${e.label} → ${toName} [${e.toRoomId}]` : `${e.label} → ${e.toRoomId}`;
    });
    this.sendLog(
      client,
      'WORLD',
      exits.length ? `출구:\n- ${exits.join('\n- ')}` : '출구: 없음',
    );
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
      // 강화 레벨 가져오기
      const enhanceLevel = (eq as any).enhanceLevel || 0;
      
      // 강화 스탯 보너스 계산 (레벨당 5% 증가, 최대 +75%)
      const enhanceMultiplier = 1 + (enhanceLevel * 0.05);
      const enhancedAtk = Math.floor(eq.item.atk * enhanceMultiplier);
      const enhancedDef = Math.floor(eq.item.def * enhanceMultiplier);
      const enhancedHpBonus = Math.floor(eq.item.hpBonus * enhanceMultiplier);
      
      totalAtk += enhancedAtk;
      totalDef += enhancedDef;
      totalHpBonus += enhancedHpBonus;
      
      equipmentSummary[eq.slot] = {
        itemId: eq.itemId,
        name: eq.item.name,
        atk: enhancedAtk,
        def: enhancedDef,
        hpBonus: enhancedHpBonus,
        enhanceLevel, // 강화 레벨도 함께 전송
      };
    }

    // 길드 버프 조회
    let guildBuff: any = null;
    if (character) {
      try {
        const guildMember = await (this.prisma as any).guildMember.findUnique({
          where: { characterId },
          include: { guild: { include: { buff: true } } },
        });
        if (guildMember?.guild?.buff) {
          guildBuff = {
            expBonus: guildMember.guild.buff.expBonus || 0,
            goldBonus: guildMember.guild.buff.goldBonus || 0,
            atkBonus: guildMember.guild.buff.atkBonus || 0,
            defBonus: guildMember.guild.buff.defBonus || 0,
            hpBonus: guildMember.guild.buff.hpBonus || 0,
          };
        }
      } catch {
        // 길드 버프 조회 실패는 무시
      }
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
            currentTitle: null as any, // 아래에서 채움
            equipmentBonus: {
              atk: totalAtk,
              def: totalDef,
              hpBonus: totalHpBonus,
            },
            guildBuff, // 길드 버프 추가
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
    // currentTitle 계산(코스메틱 칭호 아이템명)
    try {
      const titleItemId = (character as any)?.cosmeticTitleItemId;
      if (titleItemId && stateSync.char) {
        const titleItem = await this.prisma.item.findUnique({ where: { id: titleItemId } });
        (stateSync.char as any).currentTitle = titleItem?.name || null;
      }
    } catch {
      // ignore
    }
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

    const state = JSON.parse((encounter as any).stateString || '{}') as any;
    if (state.ended) {
      this.encounterTimers.delete(encounterId);
      return;
    }

    const now = Date.now();
    const deadline = encounter.turnDeadlineAt.getTime();
    // delay 계산: deadline까지 남은 시간 (최소 0ms)
    const delay = Math.max(0, deadline - now);
    console.log(`[scheduleEncounter] encounterId=${encounterId.substring(0, 8)}, now=${now}, deadline=${deadline}, delay=${delay}ms, turnNo=${encounter.turnNo}`);

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
          // 다음 턴 스케줄링 (즉시, resolveTurn에서 이미 turnDeadlineAt이 설정됨)
          // resolveTurn이 실행되는 동안 시간이 지났을 수 있으므로 즉시 스케줄링
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
    await this.sendInventoryList(client, clientData.characterId, message.reqId);
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

  // ===== ENHANCEMENT (B) =====

  private async handleEnhance(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const slot = (message.p?.slot || '').toString().trim();
    if (!slot) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'slot이 필요합니다.');
      return;
    }

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { id: true, name: true, gold: true },
      });
      if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');

      const equipment = await this.prisma.equipment.findUnique({
        where: { characterId_slot: { characterId: character.id, slot } },
        include: { item: true },
      });
      if (!equipment) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '해당 슬롯에 장착된 아이템이 없습니다.');
        return;
      }

      const currentLevel = (equipment as any).enhanceLevel || 0;
      if (currentLevel >= 15) {
        this.sendError(client, message.reqId, 'INVALID_STATE', '이미 최대 강화 레벨입니다.');
        return;
      }

      // 강화 비용: 레벨 * 1000G
      const cost = (currentLevel + 1) * 1000;
      if (character.gold < cost) {
        this.sendError(client, message.reqId, 'INVALID_STATE', `골드가 부족합니다. 필요: ${cost}G`);
        return;
      }

      // 강화 확률: 100% - (레벨 * 5%)
      const successRate = Math.max(10, 100 - currentLevel * 5); // 최소 10%
      const roll = Math.random() * 100;
      const success = roll < successRate;

      await this.prisma.$transaction(async (tx) => {
        // 골드 차감
        await tx.character.update({
          where: { id: character.id },
          data: { gold: { decrement: cost } },
        });

        if (success) {
          // 성공: 레벨 증가
          await (tx as any).equipment.update({
            where: { characterId_slot: { characterId: character.id, slot } },
            data: { enhanceLevel: { increment: 1 } },
          });
        } else {
          // 실패: 파괴 (레벨 0 이상일 때만)
          if (currentLevel > 0) {
            await (tx as any).equipment.update({
              where: { characterId_slot: { characterId: character.id, slot } },
              data: { enhanceLevel: 0 },
            });
          }
        }
      });

      if (success) {
        const newLevel = currentLevel + 1;
        this.sendLog(client, 'SYSTEM', `✨ 강화 성공! ${equipment.item.name} +${newLevel} (비용: ${cost}G)`);
        this.sendMessage(client, {
          t: 'ENHANCE_OK',
          reqId: message.reqId,
          ts: Date.now(),
          p: { slot, newLevel, success: true },
        });
      } else {
        const destroyed = currentLevel > 0;
        this.sendLog(
          client,
          'SYSTEM',
          destroyed
              ? `💥 강화 실패! ${equipment.item.name}이(가) 파괴되어 +0이 되었습니다. (비용: ${cost}G)`
              : `❌ 강화 실패! (비용: ${cost}G)`,
        );
        this.sendMessage(client, {
          t: 'ENHANCE_OK',
          reqId: message.reqId,
          ts: Date.now(),
          p: { slot, newLevel: destroyed ? 0 : currentLevel, success: false, destroyed },
        });
      }

      await this.sendStateSync(client, clientData.characterId, message.reqId);
      await this.handleEquipmentGet(client, { ...message, p: {} });
    } catch (e: any) {
      this.sendError(client, message.reqId, 'INVALID_STATE', e?.message || '강화 실패');
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

    const { itemId, qty = 1 } = message.p;
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
        Math.max(1, Number(qty || 1)),
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

  private async handleSpellList(client: WSClient, message: WSMessage) {
    try {
      const { getAllSpells } = require('../combat-tick/spell-registry');
      const spells = getAllSpells();

      this.sendMessage(client, {
        t: 'SPELL_LIST',
        reqId: message.reqId,
        ts: Date.now(),
        p: { spells },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'SPELL_LIST_FAILED', error.message || '주문 목록 조회 실패');
    }
  }

  private async handleSkillList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
      });

      const learnedSkills = await (this.prisma as any).characterSkill.findMany({
        where: { characterId: clientData.characterId },
      });

      if (!character) {
        throw new Error('Character not found');
      }

      const { getAllSkills, canLearnSkill } = require('../skills/skill-registry');
      const allSkills = getAllSkills();

      // 학습한 스킬 맵 생성
      const learnedSkillsMap = new Map<string, number>();
      for (const learned of learnedSkills || []) {
        learnedSkillsMap.set(learned.skillId, learned.level);
      }

      const skillsWithProgress = allSkills.map((skill: any) => {
        const currentLevel = learnedSkillsMap.get(skill.id) || 0;
        const canLearn = canLearnSkill(skill, character.level, learnedSkillsMap) && currentLevel < skill.maxLevel;
        
        return {
          id: skill.id,
          name: skill.name,
          type: skill.type,
          category: skill.category,
          maxLevel: skill.maxLevel,
          description: skill.description,
          requiredLevel: skill.requiredLevel,
          requiredSkills: skill.requiredSkills,
          currentLevel,
          canLearn,
          skillPoints: character.skillPoints || 0,
        };
      });

      this.sendMessage(client, {
        t: 'SKILL_LIST_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          skills: skillsWithProgress,
          skillPoints: character.skillPoints || 0,
        },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'SKILL_LIST_FAILED', error.message || '스킬 목록 조회 실패');
    }
  }

  private async handleSkillLearn(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const skillId = (message.p?.skillId || '').toString().trim();
    if (!skillId) {
      this.sendError(client, message.reqId, 'SKILL_LEARN_FAILED', 'skillId가 필요합니다.');
      return;
    }

    try {
      const { getSkill, canLearnSkill } = require('../skills/skill-registry');
      const skill = getSkill(skillId);
      if (!skill) {
        throw new Error('스킬을 찾을 수 없습니다.');
      }

      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
      });

      const learnedSkills = await (this.prisma as any).characterSkill.findMany({
        where: { characterId: clientData.characterId },
      });

      if (!character) {
        throw new Error('캐릭터를 찾을 수 없습니다.');
      }

      if (character.skillPoints < 1) {
        throw new Error('스킬 포인트가 부족합니다.');
      }

      // 학습한 스킬 맵 생성
      const learnedSkillsMap = new Map<string, number>();
      for (const learned of learnedSkills || []) {
        learnedSkillsMap.set(learned.skillId, learned.level);
      }

      const currentLevel = learnedSkillsMap.get(skillId) || 0;
      if (currentLevel >= skill.maxLevel) {
        throw new Error('이미 최대 레벨입니다.');
      }

      if (!canLearnSkill(skill, character.level, learnedSkillsMap)) {
        throw new Error('스킬 학습 요구사항을 충족하지 못했습니다.');
      }

      await this.prisma.$transaction(async (tx) => {
        // 스킬 포인트 차감
        await tx.character.update({
          where: { id: clientData.characterId },
          data: { skillPoints: { decrement: 1 } },
        });

        // 스킬 학습/업그레이드
        await (tx as any).characterSkill.upsert({
          where: { characterId_skillId: { characterId: clientData.characterId, skillId } },
          create: {
            characterId: clientData.characterId,
            skillId,
            level: 1,
          },
          update: {
            level: { increment: 1 },
          },
        });
      });

      this.sendLog(client, 'SYSTEM', `✨ 스킬 학습 성공: ${skill.name} (레벨 ${currentLevel + 1}/${skill.maxLevel}, SP -1)`);
      this.sendMessage(client, {
        t: 'SKILL_LEARN_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { skillId, level: currentLevel + 1 },
      });
      await this.sendStateSync(client, clientData.characterId, message.reqId);
    } catch (error: any) {
      this.sendError(client, message.reqId, 'SKILL_LEARN_FAILED', error.message || '스킬 학습 실패');
    }
  }

  private async handleSkillUse(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const skillId = (message.p?.skillId || '').toString().trim();
    const targetId = (message.p?.targetId || '').toString().trim();
    if (!skillId) {
      this.sendError(client, message.reqId, 'SKILL_USE_FAILED', 'skillId가 필요합니다.');
      return;
    }

    try {
      const { getSkill, SkillType } = require('../skills/skill-registry');
      const skill = getSkill(skillId);
      if (!skill) {
        throw new Error('스킬을 찾을 수 없습니다.');
      }

      if (skill.type !== SkillType.ACTIVE) {
        throw new Error('이 스킬은 수동 사용 스킬이 아닙니다.');
      }

      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
      });

      if (!character) {
        throw new Error('캐릭터를 찾을 수 없습니다.');
      }

      const learnedSkill = await (this.prisma as any).characterSkill.findUnique({
        where: { characterId_skillId: { characterId: clientData.characterId, skillId } },
      });

      if (!learnedSkill || learnedSkill.level <= 0) {
        throw new Error('학습하지 않은 스킬입니다.');
      }

      // 쿨다운 체크 (기본 5초)
      const cooldownSeconds = 5;
      if (learnedSkill.lastUsedAt) {
        const cooldownEnd = new Date(learnedSkill.lastUsedAt.getTime() + cooldownSeconds * 1000);
        if (new Date() < cooldownEnd) {
          const remaining = Math.ceil((cooldownEnd.getTime() - Date.now()) / 1000);
          throw new Error(`쿨다운 중입니다. (${remaining}초 남음)`);
        }
      }

      // MP 소모 체크 (레벨당 10 MP)
      const mpCost = learnedSkill.level * 10;
      if (character.mp < mpCost) {
        throw new Error(`MP가 부족합니다. (필요: ${mpCost}, 보유: ${character.mp})`);
      }

      // MP 차감 및 쿨다운 업데이트
      await this.prisma.$transaction(async (tx) => {
        await tx.character.update({
          where: { id: clientData.characterId },
          data: { mp: { decrement: mpCost } },
        });

        await (tx as any).characterSkill.update({
          where: { id: learnedSkill.id },
          data: { lastUsedAt: new Date() },
        });
      });

      // 스킬 효과 적용 (전투 중인 경우)
      const encounter = await this.prisma.encounter.findFirst({
        where: {
          party: {
            members: {
              some: { characterId: clientData.characterId },
            },
          },
          stateString: { contains: '"ended":false' },
        } as any,
      });

      if (encounter) {
        // 전투 중 스킬 사용 로직 (추후 구현)
        this.sendLog(client, 'COMBAT', `✨ ${skill.name} 사용! (MP -${mpCost})`);
      } else {
        this.sendLog(client, 'SYSTEM', `✨ ${skill.name} 사용! (MP -${mpCost})`);
      }

      this.sendMessage(client, {
        t: 'SKILL_USE_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { skillId, mpCost },
      });
      await this.sendStateSync(client, clientData.characterId, message.reqId);
    } catch (error: any) {
      this.sendError(client, message.reqId, 'SKILL_USE_FAILED', error.message || '스킬 사용 실패');
    }
  }

  private async handleDungeonList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { level: true, roomId: true },
      });

      if (!character) {
        throw new Error('캐릭터를 찾을 수 없습니다.');
      }

      const dungeons = await (this.prisma as any).dungeon.findMany({
        where: {
          minLevel: { lte: character.level },
          maxLevel: { gte: character.level },
          entryRoomId: character.roomId,
        },
        orderBy: { minLevel: 'asc' },
      });

      this.sendMessage(client, {
        t: 'DUNGEON_LIST_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          dungeons: dungeons.map((d: any) => ({
            id: d.id,
            name: d.name,
            description: d.description,
            minLevel: d.minLevel,
            maxLevel: d.maxLevel,
            requiredPartySize: d.requiredPartySize,
            maxPartySize: d.maxPartySize,
            roomCount: d.roomCount,
            expMultiplier: d.expMultiplier,
            goldMultiplier: d.goldMultiplier,
            itemDropMultiplier: d.itemDropMultiplier,
          })),
        },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'DUNGEON_LIST_FAILED', error.message || '던전 목록 조회 실패');
    }
  }

  private async handleDungeonEnter(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const dungeonId = (message.p?.dungeonId || '').toString().trim();
    const difficulty = (message.p?.difficulty || 'NORMAL').toString().toUpperCase();

    if (!dungeonId) {
      this.sendError(client, message.reqId, 'DUNGEON_ENTER_FAILED', 'dungeonId가 필요합니다.');
      return;
    }

    if (!['EASY', 'NORMAL', 'HARD', 'NIGHTMARE'].includes(difficulty)) {
      this.sendError(client, message.reqId, 'DUNGEON_ENTER_FAILED', '난이도는 EASY/NORMAL/HARD/NIGHTMARE 중 하나여야 합니다.');
      return;
    }

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { id: true, name: true, level: true, roomId: true },
      });

      if (!character) {
        throw new Error('캐릭터를 찾을 수 없습니다.');
      }

      const dungeon = await (this.prisma as any).dungeon.findUnique({
        where: { id: dungeonId },
      });

      if (!dungeon) {
        throw new Error('던전을 찾을 수 없습니다.');
      }

      if (character.level < dungeon.minLevel || character.level > dungeon.maxLevel) {
        throw new Error(`레벨 요구사항을 충족하지 못했습니다. (필요: ${dungeon.minLevel}-${dungeon.maxLevel})`);
      }

      if (character.roomId !== dungeon.entryRoomId) {
        throw new Error('던전 입장 위치가 아닙니다.');
      }

      const partyMember = await this.prisma.partyMember.findFirst({
        where: { characterId: clientData.characterId },
        include: { party: { include: { members: true } } },
      });

      if (!partyMember) {
        throw new Error('파티에 속해 있어야 던전에 입장할 수 있습니다.');
      }

      const party = partyMember.party;
      const partySize = party.members.length;

      if (partySize < dungeon.requiredPartySize) {
        throw new Error(`최소 파티 인원이 부족합니다. (필요: ${dungeon.requiredPartySize}, 현재: ${partySize})`);
      }

      if (partySize > dungeon.maxPartySize) {
        throw new Error(`최대 파티 인원을 초과했습니다. (최대: ${dungeon.maxPartySize}, 현재: ${partySize})`);
      }

      const existingInstance = await (this.prisma as any).dungeonInstance.findFirst({
        where: {
          partyId: party.id,
          status: 'ACTIVE',
        },
      });

      if (existingInstance) {
        throw new Error('이미 진행 중인 던전이 있습니다.');
      }

      const instance = await (this.prisma as any).dungeonInstance.create({
        data: {
          dungeonId,
          difficulty,
          partyId: party.id,
          currentRoomId: dungeon.entryRoomId,
          clearedRooms: JSON.stringify([]),
          status: 'ACTIVE',
        },
      });

      const difficultyMultipliers: Record<string, { exp: number; gold: number; item: number }> = {
        EASY: { exp: 0.8, gold: 0.8, item: 0.8 },
        NORMAL: { exp: 1.0, gold: 1.0, item: 1.0 },
        HARD: { exp: 1.5, gold: 1.5, item: 1.5 },
        NIGHTMARE: { exp: 2.5, gold: 2.5, item: 2.5 },
      };

      const multiplier = difficultyMultipliers[difficulty] || difficultyMultipliers.NORMAL;

      this.sendLog(client, 'SYSTEM', `🏰 던전 입장: ${dungeon.name} (${difficulty})`);
      this.sendMessage(client, {
        t: 'DUNGEON_ENTER_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          instanceId: instance.id,
          dungeonId,
          difficulty,
          expMultiplier: dungeon.expMultiplier * multiplier.exp,
          goldMultiplier: dungeon.goldMultiplier * multiplier.gold,
          itemDropMultiplier: dungeon.itemDropMultiplier * multiplier.item,
        },
      });

      for (const member of party.members) {
        const memberClient = [...this.clients.entries()].find(([, d]) => d.characterId === member.characterId);
        if (memberClient) {
          const [ws] = memberClient;
          this.sendLog(ws, 'SYSTEM', `🏰 ${character.name}이(가) 던전에 입장했습니다: ${dungeon.name} (${difficulty})`);
        }
      }
    } catch (error: any) {
      this.sendError(client, message.reqId, 'DUNGEON_ENTER_FAILED', error.message || '던전 입장 실패');
    }
  }

  private async handleStoryList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const { getAllStoryChapters, getNextChapter } = require('../story/story-system');
      const allChapters = getAllStoryChapters();
      
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
      });

      if (!character) {
        throw new Error('Character not found');
      }

      // 완료된 챕터 목록(DB 저장)
      const completedRows = await (this.prisma as any).characterStoryChapter?.findMany?.({
        where: { characterId: character.id },
        select: { chapterId: true },
      });
      const completedChapters: string[] = Array.isArray(completedRows)
        ? completedRows.map((r: any) => r.chapterId).filter((x: any) => typeof x === 'string')
        : [];
      const nextChapter = getNextChapter(character.level, completedChapters);

      const chaptersWithStatus = allChapters.map((chapter: any) => ({
        id: chapter.id,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        description: chapter.description,
        requiredLevel: chapter.requiredLevel,
        rewards: chapter.rewards,
        cinematicText: chapter.cinematicText,
        completed: completedChapters.includes(chapter.id),
        canStart:
          !completedChapters.includes(chapter.id) &&
          character.level >= chapter.requiredLevel &&
          (!chapter.requiredQuests ||
            (Array.isArray(chapter.requiredQuests) &&
              chapter.requiredQuests.every((q: any) => completedChapters.includes(q)))),
        isNext: nextChapter?.id === chapter.id,
      }));

      this.sendMessage(client, {
        t: 'STORY_LIST',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          chapters: chaptersWithStatus,
        },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'STORY_LIST_FAILED', error.message || '스토리 목록 조회 실패');
    }
  }

  private async handleStoryComplete(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const chapterId = message.p?.chapterId as string | undefined;
      const choice = message.p?.choice as string | undefined;

      if (!chapterId || typeof chapterId !== 'string') {
        throw new Error('chapterId required');
      }

      // 이미 완료한 경우도 idempotent 처리
      // 복합 키는 upsert에서 직접 사용 불가하므로 findUnique + create/update로 처리
      const existing = await (this.prisma as any).characterStoryChapter.findUnique({
        where: {
          characterId_chapterId: {
            characterId: clientData.characterId,
            chapterId,
          },
        },
      });

      if (existing) {
        // 이미 완료된 경우 choice만 업데이트 (있을 때만)
        if (choice !== undefined) {
          await (this.prisma as any).characterStoryChapter.update({
            where: { id: existing.id },
            data: { choice },
          });
        }
      } else {
        // 새로 완료 처리 (id는 Prisma가 자동 생성)
        await (this.prisma as any).characterStoryChapter.create({
          data: {
            characterId: clientData.characterId,
            chapterId,
            choice: choice ?? null,
          },
        });
      }

      this.sendLog(client, 'SYSTEM', `📖 스토리 완료: ${chapterId}`);

      // 완료 후 목록 갱신
      await this.handleStoryList(client, message);
    } catch (error: any) {
      this.sendError(client, message.reqId, 'STORY_COMPLETE_FAILED', error.message || '스토리 완료 처리 실패');
    }
  }

  private async handleRaidList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { level: true, roomId: true },
      });

      if (!character) {
        throw new Error('캐릭터를 찾을 수 없습니다.');
      }

      const raids = await (this.prisma as any).raid.findMany({
        where: {
          minLevel: { lte: character.level },
          maxLevel: { gte: character.level },
          entryRoomId: character.roomId,
        },
        orderBy: { minLevel: 'asc' },
      });

      this.sendMessage(client, {
        t: 'RAID_LIST_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          raids: raids.map((r: any) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            minLevel: r.minLevel,
            maxLevel: r.maxLevel,
            requiredPartySize: r.requiredPartySize,
            maxPartySize: r.maxPartySize,
            roomCount: r.roomCount,
            bossCount: r.bossCount,
            expMultiplier: r.expMultiplier,
            goldMultiplier: r.goldMultiplier,
            itemDropMultiplier: r.itemDropMultiplier,
          })),
        },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'RAID_LIST_FAILED', error.message || '레이드 목록 조회 실패');
    }
  }

  private async handleRaidEnter(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const raidId = (message.p?.raidId || '').toString().trim();

    if (!raidId) {
      this.sendError(client, message.reqId, 'RAID_ENTER_FAILED', 'raidId가 필요합니다.');
      return;
    }

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { id: true, name: true, level: true, roomId: true },
      });

      if (!character) {
        throw new Error('캐릭터를 찾을 수 없습니다.');
      }

      const raid = await (this.prisma as any).raid.findUnique({
        where: { id: raidId },
      });

      if (!raid) {
        throw new Error('레이드를 찾을 수 없습니다.');
      }

      if (character.level < raid.minLevel || character.level > raid.maxLevel) {
        throw new Error(`레벨 요구사항을 충족하지 못했습니다. (필요: ${raid.minLevel}-${raid.maxLevel})`);
      }

      if (character.roomId !== raid.entryRoomId) {
        throw new Error('레이드 입장 위치가 아닙니다.');
      }

      const partyMember = await this.prisma.partyMember.findFirst({
        where: { characterId: clientData.characterId },
        include: { party: { include: { members: true } } },
      });

      if (!partyMember) {
        throw new Error('파티에 속해 있어야 레이드에 입장할 수 있습니다.');
      }

      const party = partyMember.party;
      const partySize = party.members.length;

      if (partySize < raid.requiredPartySize) {
        throw new Error(`최소 파티 인원이 부족합니다. (필요: ${raid.requiredPartySize}, 현재: ${partySize})`);
      }

      if (partySize > raid.maxPartySize) {
        throw new Error(`최대 파티 인원을 초과했습니다. (최대: ${raid.maxPartySize}, 현재: ${partySize})`);
      }

      const existingInstance = await (this.prisma as any).raidInstance.findFirst({
        where: {
          partyId: party.id,
          status: 'ACTIVE',
        },
      });

      if (existingInstance) {
        throw new Error('이미 진행 중인 레이드가 있습니다.');
      }

      const instance = await (this.prisma as any).raidInstance.create({
        data: {
          raidId,
          partyId: party.id,
          currentRoomId: raid.entryRoomId,
          clearedRooms: JSON.stringify([]),
          defeatedBosses: '',
          status: 'ACTIVE',
        },
      });

      this.sendLog(client, 'SYSTEM', `⚔️ 레이드 입장: ${raid.name} (파티 ${partySize}명)`);
      this.sendMessage(client, {
        t: 'RAID_ENTER_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          instanceId: instance.id,
          raidId,
          expMultiplier: raid.expMultiplier,
          goldMultiplier: raid.goldMultiplier,
          itemDropMultiplier: raid.itemDropMultiplier,
        },
      });

      for (const member of party.members) {
        const memberClient = [...this.clients.entries()].find(([, d]) => d.characterId === member.characterId);
        if (memberClient) {
          const [ws] = memberClient;
          this.sendLog(ws, 'SYSTEM', `⚔️ ${character.name}이(가) 레이드에 입장했습니다: ${raid.name}`);
        }
      }
    } catch (error: any) {
      this.sendError(client, message.reqId, 'RAID_ENTER_FAILED', error.message || '레이드 입장 실패');
    }
  }

  // ===== DUNGEON/RAID STATUS =====
  private async handleDungeonStatus(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const partyMember = await this.prisma.partyMember.findFirst({
        where: { characterId: clientData.characterId },
        include: { party: true },
      });

      if (!partyMember) {
        throw new Error('파티에 속해 있지 않습니다.');
      }

      const instance = await (this.prisma as any).dungeonInstance.findFirst({
        where: {
          partyId: partyMember.partyId,
          status: 'ACTIVE',
        },
        include: { dungeon: true },
      });

      if (!instance) {
        this.sendMessage(client, {
          t: 'DUNGEON_STATUS_OK',
          reqId: message.reqId,
          ts: Date.now(),
          p: { active: false },
        });
        return;
      }

      const clearedRooms = instance.clearedRooms ? JSON.parse(instance.clearedRooms) as string[] : [];
      const progress = Math.floor((clearedRooms.length / instance.dungeon.roomCount) * 100);

      this.sendMessage(client, {
        t: 'DUNGEON_STATUS_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          active: true,
          dungeonId: instance.dungeonId,
          dungeonName: instance.dungeon.name,
          difficulty: instance.difficulty,
          clearedRooms: clearedRooms.length,
          totalRooms: instance.dungeon.roomCount,
          progress,
        },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'DUNGEON_STATUS_FAILED', error.message || '던전 상태 조회 실패');
    }
  }

  private async handleRaidStatus(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const partyMember = await this.prisma.partyMember.findFirst({
        where: { characterId: clientData.characterId },
        include: { party: true },
      });

      if (!partyMember) {
        throw new Error('파티에 속해 있지 않습니다.');
      }

      const instance = await (this.prisma as any).raidInstance.findFirst({
        where: {
          partyId: partyMember.partyId,
          status: 'ACTIVE',
        },
        include: { raid: true },
      });

      if (!instance) {
        this.sendMessage(client, {
          t: 'RAID_STATUS_OK',
          reqId: message.reqId,
          ts: Date.now(),
          p: { active: false },
        });
        return;
      }

      const clearedRooms = instance.clearedRooms ? JSON.parse(instance.clearedRooms) as string[] : [];
      const defeatedBosses = instance.defeatedBosses ? instance.defeatedBosses.split(',').filter(Boolean) : [];
      const roomProgress = Math.floor((clearedRooms.length / instance.raid.roomCount) * 100);
      const bossProgress = Math.floor((defeatedBosses.length / instance.raid.bossCount) * 100);

      this.sendMessage(client, {
        t: 'RAID_STATUS_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          active: true,
          raidId: instance.raidId,
          raidName: instance.raid.name,
          clearedRooms: clearedRooms.length,
          totalRooms: instance.raid.roomCount,
          roomProgress,
          defeatedBosses: defeatedBosses.length,
          totalBosses: instance.raid.bossCount,
          bossProgress,
        },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'RAID_STATUS_FAILED', error.message || '레이드 상태 조회 실패');
    }
  }

  // ===== PET SYSTEM =====
  private async handlePetList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const pets = await (this.prisma as any).pet.findMany({
        where: { characterId: clientData.characterId },
        orderBy: { createdAt: 'desc' },
      });

      this.sendMessage(client, {
        t: 'PET_LIST_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { pets },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'PET_LIST_FAILED', error.message || '펫 목록 조회 실패');
    }
  }

  private async handlePetSummon(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const petId = (message.p?.petId || '').toString().trim();
    if (!petId) {
      this.sendError(client, message.reqId, 'PET_SUMMON_FAILED', 'petId가 필요합니다.');
      return;
    }

    try {
      const pet = await (this.prisma as any).pet.findUnique({
        where: { id: petId },
      });

      if (!pet || pet.characterId !== clientData.characterId) {
        throw new Error('펫을 찾을 수 없습니다.');
      }

      await (this.prisma as any).pet.updateMany({
        where: { characterId: clientData.characterId, isActive: true },
        data: { isActive: false },
      });

      await (this.prisma as any).pet.update({
        where: { id: petId },
        data: { isActive: true },
      });

      this.sendLog(client, 'SYSTEM', `🐾 ${pet.name}을(를) 소환했습니다.`);
      this.sendMessage(client, {
        t: 'PET_SUMMON_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { petId } as any,
      });
      await this.sendStateSync(client, clientData.characterId, message.reqId);
    } catch (error: any) {
      this.sendError(client, message.reqId, 'PET_SUMMON_FAILED', error.message || '펫 소환 실패');
    }
  }

  private async handlePetDismiss(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      await (this.prisma as any).pet.updateMany({
        where: { characterId: clientData.characterId, isActive: true },
        data: { isActive: false },
      });

      this.sendLog(client, 'SYSTEM', '🐾 펫을 해제했습니다.');
      this.sendMessage(client, {
        t: 'PET_DISMISS_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {} as any,
      });
      await this.sendStateSync(client, clientData.characterId, message.reqId);
    } catch (error: any) {
      this.sendError(client, message.reqId, 'PET_DISMISS_FAILED', error.message || '펫 해제 실패');
    }
  }

  // ===== HOUSING SYSTEM =====
  private async handleHouseInfo(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const house = await (this.prisma as any).house.findUnique({
        where: { characterId: clientData.characterId },
        include: {
          farmPlots: true,
          storage: { include: { item: true } },
        },
      });

      if (!house) {
        this.sendMessage(client, {
          t: 'HOUSE_INFO_OK',
          reqId: message.reqId,
          ts: Date.now(),
          p: { hasHouse: false },
        });
        return;
      }

      this.sendMessage(client, {
        t: 'HOUSE_INFO_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          hasHouse: true,
          house: {
            id: house.id,
            name: house.name,
            level: house.level,
            capacity: house.capacity,
            location: house.location,
          },
          farmPlots: house.farmPlots,
          storage: house.storage,
        },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'HOUSE_INFO_FAILED', error.message || '주택 정보 조회 실패');
    }
  }

  private async handleHouseCreate(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const name = (message.p?.name || '').toString().trim();
    if (!name) {
      this.sendError(client, message.reqId, 'HOUSE_CREATE_FAILED', 'name이 필요합니다.');
      return;
    }

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { gold: true, roomId: true },
      });

      if (!character) {
        throw new Error('캐릭터를 찾을 수 없습니다.');
      }

      const cost = 1000;
      if (character.gold < cost) {
        throw new Error(`골드가 부족합니다. (필요: ${cost}G)`);
      }

      const existing = await (this.prisma as any).house.findUnique({
        where: { characterId: clientData.characterId },
      });

      if (existing) {
        throw new Error('이미 주택을 보유하고 있습니다.');
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.character.update({
          where: { id: clientData.characterId },
          data: { gold: { decrement: cost } },
        });

        const house = await (tx as any).house.create({
          data: {
            characterId: clientData.characterId,
            name,
            location: character.roomId,
          },
        });

        for (let i = 0; i < 10; i++) {
          await (tx as any).farmPlot.create({
            data: {
              houseId: house.id,
              plotIndex: i,
              status: 'EMPTY',
            },
          });
        }
      });

      this.sendLog(client, 'SYSTEM', `🏠 주택을 구매했습니다: ${name}`);
      this.sendMessage(client, {
        t: 'HOUSE_CREATE_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {} as any,
      });
      await this.sendStateSync(client, clientData.characterId, message.reqId);
    } catch (error: any) {
      this.sendError(client, message.reqId, 'HOUSE_CREATE_FAILED', error.message || '주택 구매 실패');
    }
  }

  private async handleHouseStorage(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const action = (message.p?.action || '').toString().trim();
    const itemId = (message.p?.itemId || '').toString().trim();
    const qty = Number(message.p?.qty || 1) || 1;

    if (!action || !itemId) {
      this.sendError(client, message.reqId, 'HOUSE_STORAGE_FAILED', 'action과 itemId가 필요합니다.');
      return;
    }

    try {
      const house = await (this.prisma as any).house.findUnique({
        where: { characterId: clientData.characterId },
      });

      if (!house) {
        throw new Error('주택을 보유하고 있지 않습니다.');
      }

      if (action === 'DEPOSIT') {
        if (!itemId) {
          throw new Error('itemId가 필요합니다.');
        }

        const inv = await this.prisma.inventory.findUnique({
          where: { characterId_itemId: { characterId: clientData.characterId!, itemId } },
        });

        if (!inv || inv.qty < qty) {
          throw new Error('인벤토리에 아이템이 부족합니다.');
        }

        const storageCount = await (this.prisma as any).houseStorage.count({
          where: { houseId: house.id },
        });

        if (storageCount >= house.capacity) {
          throw new Error('저장소가 가득 찼습니다.');
        }

        await this.prisma.$transaction(async (tx) => {
          await tx.inventory.update({
            where: { characterId_itemId: { characterId: clientData.characterId!, itemId } },
            data: { qty: { decrement: qty } },
          });
          await tx.inventory.deleteMany({
            where: { characterId: clientData.characterId!, itemId, qty: { lte: 0 } },
          });

          await (tx as any).houseStorage.upsert({
            where: { houseId_itemId: { houseId: house.id, itemId } },
            create: { houseId: house.id, itemId, qty },
            update: { qty: { increment: qty } },
          });
        });

        this.sendLog(client, 'SYSTEM', `📦 저장소에 보관했습니다: ${itemId} x${qty}`);
      } else if (action === 'WITHDRAW') {
        const storage = await (this.prisma as any).houseStorage.findUnique({
          where: { houseId_itemId: { houseId: house.id, itemId } },
        });

        if (!storage || storage.qty < qty) {
          throw new Error('저장소에 아이템이 부족합니다.');
        }

        await this.prisma.$transaction(async (tx) => {
          await (tx as any).houseStorage.update({
            where: { houseId_itemId: { houseId: house.id, itemId } },
            data: { qty: { decrement: qty } },
          });
          await (tx as any).houseStorage.deleteMany({
            where: { houseId: house.id, itemId, qty: { lte: 0 } },
          });

          await tx.inventory.upsert({
            where: { characterId_itemId: { characterId: clientData.characterId!, itemId } },
            create: { characterId: clientData.characterId!, itemId, qty },
            update: { qty: { increment: qty } },
          });
        });

        this.sendLog(client, 'SYSTEM', `📦 저장소에서 꺼냈습니다: ${itemId} x${qty}`);
      }

      this.sendMessage(client, {
        t: 'HOUSE_STORAGE_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {} as any,
      });
      await this.sendStateSync(client, clientData.characterId, message.reqId);
    } catch (error: any) {
      this.sendError(client, message.reqId, 'HOUSE_STORAGE_FAILED', error.message || '저장소 작업 실패');
    }
  }

  // ===== FARM SYSTEM =====
  private async handleFarmPlant(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const plotIndex = Number(message.p?.plotIndex ?? -1);
    const cropId = (message.p?.cropId || '').toString().trim();

    if (plotIndex < 0 || !cropId) {
      this.sendError(client, message.reqId, 'FARM_PLANT_FAILED', 'plotIndex와 cropId가 필요합니다.');
      return;
    }

    try {
      const house = await (this.prisma as any).house.findUnique({
        where: { characterId: clientData.characterId },
        include: { farmPlots: true },
      });

      if (!house) {
        throw new Error('주택을 보유하고 있지 않습니다.');
      }

      const plot = house.farmPlots.find((p: any) => p.plotIndex === plotIndex);
      if (!plot) {
        throw new Error('농장 플롯을 찾을 수 없습니다.');
      }

      if (plot.status !== 'EMPTY') {
        throw new Error('이미 작물이 심어져 있습니다.');
      }

      const inv = await this.prisma.inventory.findUnique({
        where: { characterId_itemId: { characterId: clientData.characterId, itemId: cropId } },
      });

      if (!inv || inv.qty < 1) {
        throw new Error('씨앗이 없습니다.');
      }

      const growTime = 3600000;
      const harvestAt = new Date(Date.now() + growTime);

      await this.prisma.$transaction(async (tx) => {
        await tx.inventory.update({
          where: { characterId_itemId: { characterId: clientData.characterId!, itemId: cropId! } },
          data: { qty: { decrement: 1 } },
        });
        await tx.inventory.deleteMany({
          where: { characterId: clientData.characterId!, itemId: cropId!, qty: { lte: 0 } },
        });

        await (tx as any).farmPlot.update({
          where: { id: plot.id },
          data: {
            cropId,
            plantedAt: new Date(),
            harvestAt,
            status: 'GROWING',
          },
        });
      });

      this.sendLog(client, 'SYSTEM', `🌱 작물을 심었습니다: ${cropId} (플롯 ${plotIndex})`);
      this.sendMessage(client, {
        t: 'FARM_PLANT_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {} as any,
      });
      await this.sendStateSync(client, clientData.characterId, message.reqId);
    } catch (error: any) {
      this.sendError(client, message.reqId, 'FARM_PLANT_FAILED', error.message || '작물 심기 실패');
    }
  }

  private async handleFarmHarvest(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const plotIndex = Number(message.p?.plotIndex ?? -1);

    if (plotIndex < 0) {
      this.sendError(client, message.reqId, 'FARM_HARVEST_FAILED', 'plotIndex가 필요합니다.');
      return;
    }

    try {
      const house = await (this.prisma as any).house.findUnique({
        where: { characterId: clientData.characterId },
        include: { farmPlots: true },
      });

      if (!house) {
        throw new Error('주택을 보유하고 있지 않습니다.');
      }

      const plot = house.farmPlots.find((p: any) => p.plotIndex === plotIndex);
      if (!plot) {
        throw new Error('농장 플롯을 찾을 수 없습니다.');
      }

      if (plot.status !== 'READY' && (!plot.harvestAt || new Date() < plot.harvestAt)) {
        throw new Error('아직 수확할 수 없습니다.');
      }

      if (!plot.cropId) {
        throw new Error('작물이 없습니다.');
      }

      const harvestQty = 3;

      await this.prisma.$transaction(async (tx) => {
        await tx.inventory.upsert({
          where: { characterId_itemId: { characterId: clientData.characterId!, itemId: plot.cropId! } },
          create: { characterId: clientData.characterId!, itemId: plot.cropId!, qty: harvestQty },
          update: { qty: { increment: harvestQty } },
        });

        await (tx as any).farmPlot.update({
          where: { id: plot.id },
          data: {
            cropId: null,
            plantedAt: null,
            harvestAt: null,
            status: 'EMPTY',
          },
        });
      });

      this.sendLog(client, 'SYSTEM', `🌾 작물을 수확했습니다: ${plot.cropId} x${harvestQty} (플롯 ${plotIndex})`);
      this.sendMessage(client, {
        t: 'FARM_HARVEST_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { cropId: plot.cropId || '', qty: harvestQty } as any,
      });
      await this.sendStateSync(client, clientData.characterId, message.reqId);
    } catch (error: any) {
      this.sendError(client, message.reqId, 'FARM_HARVEST_FAILED', error.message || '작물 수확 실패');
    }
  }

  // ===== EVENT SYSTEM =====
  private async handleEventList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const now = new Date();
      const events = await (this.prisma as any).event.findMany({
        where: {
          OR: [
            { status: 'ACTIVE' },
            { status: 'UPCOMING', startAt: { lte: now } },
          ],
        },
        orderBy: { startAt: 'desc' },
      });

      const participations = await (this.prisma as any).eventParticipation.findMany({
        where: { characterId: clientData.characterId },
      });

      const participationMap = new Map(participations.map((p: any) => [p.eventId, p]));

      this.sendMessage(client, {
        t: 'EVENT_LIST_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          events: events.map((e: any) => ({
            id: e.id,
            name: e.name,
            description: e.description,
            type: e.type,
            status: e.status,
            startAt: e.startAt,
            endAt: e.endAt,
            joined: participationMap.has(e.id),
            progress: ((participationMap.get(e.id) as any)?.progress) || {},
          })),
        },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'EVENT_LIST_FAILED', error.message || '이벤트 목록 조회 실패');
    }
  }

  private async handleEventJoin(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const eventId = (message.p?.eventId || '').toString().trim();
    if (!eventId) {
      this.sendError(client, message.reqId, 'EVENT_JOIN_FAILED', 'eventId가 필요합니다.');
      return;
    }

    try {
      const event = await (this.prisma as any).event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new Error('이벤트를 찾을 수 없습니다.');
      }

      const now = new Date();
      if (event.status !== 'ACTIVE' || now < event.startAt || now > event.endAt) {
        throw new Error('참가할 수 없는 이벤트입니다.');
      }

      const existing = await (this.prisma as any).eventParticipation.findUnique({
        where: { eventId_characterId: { eventId, characterId: clientData.characterId } },
      });

      if (existing) {
        throw new Error('이미 참가한 이벤트입니다.');
      }

      await (this.prisma as any).eventParticipation.create({
        data: {
          eventId,
          characterId: clientData.characterId,
          progress: {},
        },
      });

      this.sendLog(client, 'SYSTEM', `🎉 이벤트에 참가했습니다: ${event.name}`);
      this.sendMessage(client, {
        t: 'EVENT_JOIN_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {} as any,
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'EVENT_JOIN_FAILED', error.message || '이벤트 참가 실패');
    }
  }

  private async handleEventProgress(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const eventId = (message.p?.eventId || '').toString().trim();
    const progressData = message.p?.progress as Record<string, any> | undefined;

    if (!eventId || !progressData) {
      this.sendError(client, message.reqId, 'EVENT_PROGRESS_FAILED', 'eventId와 progress가 필요합니다.');
      return;
    }

    try {
      const participation = await (this.prisma as any).eventParticipation.findUnique({
        where: { eventId_characterId: { eventId, characterId: clientData.characterId } },
        include: { event: true },
      });

      if (!participation) {
        throw new Error('참가하지 않은 이벤트입니다.');
      }

      const now = new Date();
      if (participation.event.status !== 'ACTIVE' || now > participation.event.endAt) {
        throw new Error('진행할 수 없는 이벤트입니다.');
      }

      await (this.prisma as any).eventParticipation.update({
        where: { id: participation.id },
        data: { progress: progressData },
      });

      this.sendMessage(client, {
        t: 'EVENT_PROGRESS_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {} as any,
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'EVENT_PROGRESS_FAILED', error.message || '이벤트 진행 업데이트 실패');
    }
  }

  // ===== RANKING SYSTEM =====
  private async handleRankingDungeon(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const dungeonId = (message.p?.dungeonId || '').toString().trim();
    const difficulty = (message.p?.difficulty || 'NORMAL').toString().toUpperCase();
    const limit = Number(message.p?.limit || 10) || 10;

    try {
      const rankings = await (this.prisma as any).dungeonRanking.findMany({
        where: {
          ...(dungeonId ? { dungeonId } : {}),
          difficulty,
        },
        orderBy: [
          { clearCount: 'desc' },
          { bestTime: 'asc' },
        ],
        take: limit,
        include: {
          character: {
            select: { id: true, name: true, level: true },
          },
        },
      });

      this.sendMessage(client, {
        t: 'RANKING_DUNGEON_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          rankings: rankings.map((r: any, index: number) => ({
            rank: index + 1,
            characterName: r.character.name,
            characterLevel: r.character.level,
            dungeonId: r.dungeonId,
            difficulty: r.difficulty,
            clearCount: r.clearCount,
            bestTime: r.bestTime,
            totalExp: r.totalExp,
            totalGold: r.totalGold,
          })),
        },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'RANKING_DUNGEON_FAILED', error.message || '던전 랭킹 조회 실패');
    }
  }

  private async handleRankingRaid(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const raidId = (message.p?.raidId || '').toString().trim();
    const limit = Number(message.p?.limit || 10) || 10;

    try {
      const rankings = await (this.prisma as any).raidRanking.findMany({
        where: raidId ? { raidId } : {},
        orderBy: [
          { clearCount: 'desc' },
          { bestTime: 'asc' },
        ],
        take: limit,
        include: {
          character: {
            select: { id: true, name: true, level: true },
          },
        },
      });

      this.sendMessage(client, {
        t: 'RANKING_RAID_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          rankings: rankings.map((r: any, index: number) => ({
            rank: index + 1,
            characterName: r.character.name,
            characterLevel: r.character.level,
            raidId: r.raidId,
            clearCount: r.clearCount,
            bestTime: r.bestTime,
            totalExp: r.totalExp,
            totalGold: r.totalGold,
          })),
        },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'RANKING_RAID_FAILED', error.message || '레이드 랭킹 조회 실패');
    }
  }

  private async handleNPCList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const { getNPCsInRoom, NPCS } = require('../story/npc-system');
      
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
      });

      if (!character) {
        throw new Error('Character not found');
      }

      // 현재 방 ID 가져오기
      const currentRoomId = (character as any).roomId || 'START_TOWN';

      // 현재 방의 NPC 목록
      const npcsInRoom = getNPCsInRoom(currentRoomId);
      
      // 모든 NPC 목록 (전체)
      const allNPCs = Object.values(NPCS).map((npc: any) => ({
        id: npc.id,
        name: npc.name,
        title: npc.title,
        roomId: npc.roomId,
        description: npc.description,
        inCurrentRoom: npc.roomId === currentRoomId,
      }));

      this.sendMessage(client, {
        t: 'NPC_LIST',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          npcs: allNPCs,
          npcsInCurrentRoom: npcsInRoom.map((npc: any) => ({
            id: npc.id,
            name: npc.name,
            title: npc.title,
            description: npc.description,
          })),
        },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'NPC_LIST_FAILED', error.message || 'NPC 목록 조회 실패');
    }
  }

  private async handleNPCTalk(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const { npcId, dialogueId, choiceIndex } = message.p;
      const { getNPC, getNPCDialogue } = require('../story/npc-system');

      if (!npcId) {
        throw new Error('NPC ID required');
      }

      const npc = getNPC(npcId);
      if (!npc) {
        throw new Error('NPC not found');
      }

      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        include: {
          inventory: true,
        },
      });

      if (!character) {
        throw new Error('Character not found');
      }

      // TODO: 완료된 퀘스트 목록 가져오기
      const completedQuests: string[] = [];
      const inventory = character.inventory.map((inv) => inv.itemId);

      let dialogue;
      if (dialogueId) {
        // 특정 대화 ID 요청
        dialogue = npc.dialogues.find((d: any) => d.id === dialogueId);
      } else {
        // 조건에 맞는 첫 번째 대화
        dialogue = getNPCDialogue(npcId, character.level, completedQuests, inventory);
      }

      if (!dialogue) {
        throw new Error('Dialogue not found');
      }

      // 선택지 처리
      if (choiceIndex != null && dialogue.choices && dialogue.choices[choiceIndex]) {
        const choice = dialogue.choices[choiceIndex];
        
        if (choice.action) {
          // 액션 처리
          switch (choice.action.type) {
            case 'GIVE_QUEST':
              // TODO: 퀘스트 지급
              this.sendLog(client, 'SYSTEM', `퀘스트를 받았습니다: ${choice.action.data.questId}`);
              break;
            case 'GIVE_ITEM':
              // TODO: 아이템 지급
              this.sendLog(client, 'SYSTEM', `아이템을 받았습니다: ${choice.action.data.itemId}`);
              break;
            case 'REST':
              // 휴식 처리
              await this.handleRest(client, { ...message, p: {} });
              break;
          }
        }

        if (choice.nextDialogueId) {
          // 다음 대화로 이동
          const nextDialogue = npc.dialogues.find((d: any) => d.id === choice.nextDialogueId);
          if (nextDialogue) {
            dialogue = nextDialogue;
          }
        }
      }

      this.sendMessage(client, {
        t: 'NPC_TALK',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          npcId: npc.id,
          npcName: npc.name,
          dialogue: {
            id: dialogue.id,
            text: dialogue.text,
            choices: dialogue.choices?.map((c: any) => ({
              text: c.text,
            })),
          },
        },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'NPC_TALK_FAILED', error.message || 'NPC 대화 실패');
    }
  }

  private async handleTradeOffer(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const { targetCharacterName } = message.p;

      if (!targetCharacterName) {
        throw new Error('Target character name required');
      }

      const target = await this.prisma.character.findFirst({
        where: { name: targetCharacterName },
      });

      if (!target) {
        throw new Error('Character not found');
      }

      // 간단 구현: 타겟에게 초대 알림 전송
      const targetClient = [...this.clients.entries()].find(
        ([_, data]) => data.characterId === target.id,
      );

      if (targetClient) {
        const [targetWs] = targetClient;
        this.sendLog(targetWs, 'PARTY', `${(await this.prisma.character.findUnique({ where: { id: clientData.characterId } }))?.name}님이 파티에 초대했습니다.`);
      }

      this.sendLog(client, 'PARTY', `${targetCharacterName}님에게 파티 초대를 보냈습니다.`);
    } catch (error: any) {
      this.sendError(client, message.reqId, 'PARTY_INVITE_FAILED', error.message || '파티 초대 실패');
    }
  }

  private async handlePartyKick(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const { targetCharacterId } = message.p;

      if (!targetCharacterId) {
        throw new Error('Target character ID required');
      }

      // TODO: 파티장 권한 확인 및 파티원 추방 로직

      this.sendLog(client, 'PARTY', '파티원을 추방했습니다.');
      this.sendLog(client, 'SYSTEM', '⚠️ 파티 관리 시스템은 아직 구현 중입니다.');
    } catch (error: any) {
      this.sendError(client, message.reqId, 'PARTY_KICK_FAILED', error.message || '파티 추방 실패');
    }
  }

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
        const tags = character.room.tags 
          ? (typeof character.room.tags === 'string' ? JSON.parse(character.room.tags) : character.room.tags)
          : [];
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

        // HP와 MP 회복
        await tx.character.update({
          where: { id: clientData.characterId! },
          data: {
            hp: character.hpMax,
            mp: (character as any).mpMax || character.hpMax,
            lastRestAt: new Date(),
          } as any,
        });

        const mpMax = (character as any).mpMax || character.hpMax;
        this.sendLog(client, 'SYSTEM', `휴식을 취했습니다. HP와 MP가 전부 회복되었습니다. (HP: ${character.hpMax}/${character.hpMax}, MP: ${mpMax}/${mpMax})`);
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

      // 길드 경험치 추가 (퀘스트 완료 시)
      await this.addGuildExp(clientData.characterId, rewards.exp);

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

  // ===== TICK-BASED COMBAT HANDLERS =====

  private async handleAttack(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const { target } = message.p;

    if (!target) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'Target required (monsterId)');
      return;
    }

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
      });

      if (!character) {
        throw new Error('Character not found');
      }

      // Check if target monster exists in room
      const roomSpawn = await this.prisma.roomSpawn.findFirst({
        where: {
          roomId: character.roomId,
          monsterId: target,
        },
        include: { monster: true },
      });

      if (!roomSpawn) {
        throw new Error('Target monster not found in this room');
      }

      // Ensure combat instance
      const instance = await this.combatTickService.ensureInstanceForRoom(character.roomId);

      // Ensure combatants
      const { playerCombatant, monsterCombatant } =
        await this.combatTickService.ensureCombatants(instance.id, clientData.characterId, target);

      // Enqueue attack action
      await this.combatTickService.enqueueAction({
        combatantId: playerCombatant.id,
        instanceId: instance.id,
        type: 'ATTACK',
        payload: { targetId: monsterCombatant.id },
        reqId: message.reqId || `attack_${Date.now()}`,
      });

      // Send ACK with combat instance info
      this.sendMessage(client, {
        t: 'ATTACK_ACK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { 
          accepted: true, 
          instanceId: instance.id,
          inCombat: true, // 클라이언트에 전투 시작 알림
        },
      });

      this.sendLog(client, 'COMBAT', `You engage ${roomSpawn.monster.name} in combat!`);
    } catch (error: any) {
      this.sendError(client, message.reqId, 'ATTACK_FAILED', error.message || 'Attack failed');
    }
  }

  private async handleCast(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const spellId = (message.p?.spell || '').toString().trim();
    const targetId = (message.p?.target || '').toString().trim();
    const encounterId = (message.p?.encounterId || '').toString().trim();

    if (!spellId) {
      this.sendError(client, message.reqId, 'CAST_FAILED', 'spell이 필요합니다.');
      return;
    }

    try {
      const { getSpell } = require('../combat-tick/spell-registry');
      const spell = getSpell(spellId);
      if (!spell) {
        throw new Error('주문을 찾을 수 없습니다.');
      }

      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { id: true, name: true, mp: true, mpMax: true },
      });

      if (!character) {
        throw new Error('캐릭터를 찾을 수 없습니다.');
      }

      // MP 소모 체크
      if (character.mp < spell.mpCost) {
        throw new Error(`MP가 부족합니다. (필요: ${spell.mpCost}, 보유: ${character.mp})`);
      }

      // 쿨다운 체크
      if (spell.cooldownMs > 0) {
        const cooldown = await (this.prisma as any).characterSpellCooldown.findUnique({
          where: { characterId_spellId: { characterId: clientData.characterId, spellId } },
        });
        if (cooldown) {
          const cooldownEnd = new Date(cooldown.lastUsedAt.getTime() + spell.cooldownMs);
          if (new Date() < cooldownEnd) {
            const remaining = Math.ceil((cooldownEnd.getTime() - Date.now()) / 1000);
            throw new Error(`쿨다운 중입니다. (${remaining}초 남음)`);
          }
        }
      }

      // 전투 중인지 확인
      if (encounterId) {
        // 전투 중: CombatService의 setCombatAction 사용
        await this.combatService.setCombatAction(encounterId, clientData.characterId, spellId, targetId || undefined);
        
        // MP 차감 및 쿨다운 업데이트
        await this.prisma.$transaction(async (tx) => {
          await tx.character.update({
            where: { id: clientData.characterId },
            data: { mp: { decrement: spell.mpCost } },
          });

          if (spell.cooldownMs > 0) {
            await (tx as any).characterSpellCooldown.upsert({
              where: { characterId_spellId: { characterId: clientData.characterId, spellId } },
              create: {
                characterId: clientData.characterId,
                spellId,
                lastUsedAt: new Date(),
              },
              update: {
                lastUsedAt: new Date(),
              },
            });
          }
        });

        this.sendLog(client, 'COMBAT', `✨ ${spell.name} 시전! (MP -${spell.mpCost})`);
        this.sendMessage(client, {
          t: 'CAST_OK',
          reqId: message.reqId,
          ts: Date.now(),
          p: { spellId, mpCost: spell.mpCost },
        });
        await this.sendStateSync(client, clientData.characterId, message.reqId);
      } else {
        // 전투 외: 즉시 효과 적용
        await this.prisma.$transaction(async (tx) => {
          await tx.character.update({
            where: { id: clientData.characterId },
            data: { mp: { decrement: spell.mpCost } },
          });

          if (spell.cooldownMs > 0) {
            await (tx as any).characterSpellCooldown.upsert({
              where: { characterId_spellId: { characterId: clientData.characterId, spellId } },
              create: {
                characterId: clientData.characterId,
                spellId,
                lastUsedAt: new Date(),
              },
              update: {
                lastUsedAt: new Date(),
              },
            });
          }

          // 즉시 효과 적용
          if (spell.type === 'HEAL' && spell.targetType === 'SELF') {
            const healAmount = spell.power;
            const currentHp = await tx.character.findUnique({
              where: { id: clientData.characterId },
              select: { hp: true, hpMax: true },
            });
            if (currentHp) {
              const newHp = Math.min(currentHp.hp + healAmount, currentHp.hpMax);
              await tx.character.update({
                where: { id: clientData.characterId },
                data: { hp: newHp },
              });
              this.sendLog(client, 'SYSTEM', `✨ ${spell.name} 시전! HP +${healAmount} (${currentHp.hp} → ${newHp})`);
            }
          }
        });

        this.sendLog(client, 'SYSTEM', `✨ ${spell.name} 시전! (MP -${spell.mpCost})`);
        this.sendMessage(client, {
          t: 'CAST_OK',
          reqId: message.reqId,
          ts: Date.now(),
          p: { spellId, mpCost: spell.mpCost },
        });
        await this.sendStateSync(client, clientData.characterId, message.reqId);
      }
    } catch (error: any) {
      this.sendError(client, message.reqId, 'CAST_FAILED', error.message || '주문 시전 실패');
    }
  }

  private async handleCastOld(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const { spell, target } = message.p;

    if (!spell) {
      this.sendError(client, message.reqId, 'INVALID_STATE', 'Spell name required');
      return;
    }

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
      });

      if (!character) {
        throw new Error('Character not found');
      }

      // Find active combat instance (tick-based combat)
      let instance = await this.prisma.combatInstance.findFirst({
        where: {
          roomId: character.roomId,
          state: { in: ['ENGAGED', 'RESOLVING'] },
        },
        include: {
          combatants: true,
        },
      });

      // If no tick-based combat, check for turn-based combat (Encounter)
      if (!instance) {
        const party = await this.prisma.party.findFirst({
          where: {
            members: {
              some: {
                characterId: clientData.characterId,
              },
            },
          },
        });

        if (party) {
          // 클라이언트에서 encounterId를 전달받았으면 그것을 사용, 아니면 최신 활성 Encounter 찾기
          const encounterIdFromClient = message.p['encounterId'] as string | undefined;
          
          let encounter;
          if (encounterIdFromClient) {
            // 클라이언트에서 encounterId를 전달받았으면 그것을 사용
            encounter = await this.prisma.encounter.findUnique({
              where: { id: encounterIdFromClient },
              include: {
                party: {
                  include: {
                    members: true,
                  },
                },
              },
            });
          } else {
            // 최신 활성 Encounter 찾기 (ended가 false인 것 중 가장 최근 것)
            encounter = await this.prisma.encounter.findFirst({
              where: {
                partyId: party.id,
                roomId: character.roomId,
              },
              orderBy: { createdAt: 'desc' },
              include: {
                party: {
                  include: {
                    members: true,
                  },
                },
              },
            });
          }

          if (encounter) {
            const state = JSON.parse((encounter as any).stateString || '{}') as any;
            if (!state.ended) {
              // Turn-based combat: use setCombatAction to queue CAST
              try {
                // Determine target ID for turn-based combat
                let targetId: string | undefined;
                if (target && target !== 'self') {
                  // Find monster in encounter state
                  const enemies = state.enemies || [];
                  const targetMonster = enemies.find((e: any) => e.id === target || e.name === target);
                  if (targetMonster) {
                    targetId = targetMonster.id;
                  }
                }

                // Set CAST action in turn-based combat
                // Store spell ID in action field, and use 'CAST' as the action type
                await this.combatService.setCombatAction(encounter.id, clientData.characterId, spell, targetId);
                
                // Send ACK
                this.sendMessage(client, {
                  t: 'CAST_ACK',
                  reqId: message.reqId,
                  ts: Date.now(),
                  p: { accepted: true, spell, encounterId: encounter.id },
                });

                this.sendLog(client, 'COMBAT', `주문 시전: ${spell}${target ? ` (대상: ${target})` : ''}`);
                return; // Success, exit early
              } catch (error: any) {
                throw new Error(`주문 시전 실패: ${error.message || '알 수 없는 오류'}`);
              }
            }
          }
        }

        // Check if there's an ended instance (combat just finished)
        const endedInstance = await this.prisma.combatInstance.findFirst({
          where: {
            roomId: character.roomId,
            state: 'ENDED',
          },
          orderBy: { updatedAt: 'desc' },
        });
        
        if (endedInstance) {
          throw new Error('전투가 이미 종료되었습니다. 새로운 전투를 시작하세요.');
        }
        throw new Error('전투 중이 아닙니다. 먼저 "사냥" 또는 "공격"으로 전투를 시작하세요.');
      }

      const playerCombatant = instance.combatants.find(
        (c) => c.entityType === 'PLAYER' && c.entityId === clientData.characterId,
      );

      if (!playerCombatant) {
        throw new Error('이 전투에 참여하고 있지 않습니다.');
      }

      // Determine target combatant ID
      let targetCombatantId = playerCombatant.id; // Default to self for heal

      if (target && target !== 'self') {
        // Find monster target
        const monsterCombatant = instance.combatants.find(
          (c) => c.entityType === 'MONSTER' && c.entityId === target,
        );

        if (monsterCombatant) {
          targetCombatantId = monsterCombatant.id;
        }
      }

      // Enqueue CAST action
      await this.combatTickService.enqueueAction({
        combatantId: playerCombatant.id,
        instanceId: instance.id,
        type: 'CAST',
        payload: { spellId: spell, targetId: targetCombatantId },
        reqId: message.reqId || `cast_${Date.now()}`,
      });

      // Send ACK
      this.sendMessage(client, {
        t: 'CAST_ACK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { accepted: true, spell },
      });

      this.sendLog(client, 'COMBAT', `You begin casting ${spell}...`);
    } catch (error: any) {
      this.sendError(client, message.reqId, 'CAST_FAILED', error.message || 'Cast failed');
    }
  }

  private async handleFlee(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
      });

      if (!character) {
        throw new Error('Character not found');
      }

      // Find active combat instance
      const instance = await this.prisma.combatInstance.findFirst({
        where: {
          roomId: character.roomId,
          state: { in: ['ENGAGED', 'RESOLVING'] },
        },
        include: {
          combatants: true,
        },
      });

      if (!instance) {
        throw new Error('Not in combat');
      }

      const playerCombatant = instance.combatants.find(
        (c) => c.entityType === 'PLAYER' && c.entityId === clientData.characterId,
      );

      if (!playerCombatant) {
        throw new Error('Not a combatant in this battle');
      }

      // Enqueue flee action
      await this.combatTickService.enqueueAction({
        combatantId: playerCombatant.id,
        instanceId: instance.id,
        type: 'FLEE',
        payload: {},
        reqId: message.reqId || `flee_${Date.now()}`,
      });

      // Send ACK
      this.sendMessage(client, {
        t: 'FLEE_ACK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { accepted: true },
      });

      this.sendLog(client, 'COMBAT', 'You attempt to flee...');
    } catch (error: any) {
      this.sendError(client, message.reqId, 'FLEE_FAILED', error.message || 'Flee failed');
    }
  }

  private async handleRoomMonsters(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
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
        throw new Error('Character not found');
      }

      const monsters = character.room.spawns.map((spawn) => ({
        id: spawn.monster.id,
        name: spawn.monster.name,
        level: spawn.monster.level,
        weight: spawn.weight,
      }));

      this.sendMessage(client, {
        t: 'ROOM_MONSTERS',
        reqId: message.reqId,
        ts: Date.now(),
        p: {
          roomId: character.roomId,
          monsters,
        },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'ROOM_MONSTERS_FAILED', error.message || 'Failed to get room monsters');
    }
  }

  private async broadcastToRoom(roomId: string, message: any) {
    // Find all clients in this room
    const charactersInRoom = await this.prisma.character.findMany({
      where: { roomId },
      select: { id: true },
    });

    const characterIds = new Set(charactersInRoom.map((c) => c.id));

    for (const [client, data] of this.clients.entries()) {
      if (data.characterId && characterIds.has(data.characterId)) {
        this.sendMessage(client, message);
      }
    }
  }

  // ===== END TICK-BASED COMBAT HANDLERS =====

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

      // Check if in combat - if so, enqueue as combat action
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
        select: { roomId: true },
      });

      if (character) {
        const combatInstance = await this.prisma.combatInstance.findFirst({
          where: {
            roomId: character.roomId,
            state: { in: ['ENGAGED', 'RESOLVING'] },
          },
          include: {
            combatants: true,
          },
        });

        if (combatInstance) {
          // In combat - enqueue action
          const playerCombatant = combatInstance.combatants.find(
            (c) => c.entityType === 'PLAYER' && c.entityId === clientData.characterId,
          );

          if (playerCombatant) {
            // Verify item exists and is consumable
            const item = await this.prisma.item.findUnique({
              where: { id: itemId },
            });

            if (!item || item.type !== 'consumable') {
              throw new Error('This item cannot be used in combat');
            }

            // Enqueue USE_ITEM action
            await this.combatTickService.enqueueAction({
              combatantId: playerCombatant.id,
              instanceId: combatInstance.id,
              type: 'USE_ITEM',
              payload: { itemId, qty },
              reqId: message.reqId || `use_item_${Date.now()}`,
            });

            // Consume item from inventory immediately
            await this.prisma.$transaction(async (tx) => {
              const inventory = await tx.inventory.findUnique({
                where: {
                  characterId_itemId: {
                    characterId: clientData.characterId!,
                    itemId,
                  },
                },
              });

              if (!inventory || inventory.qty < qty) {
                throw new Error('아이템이 부족합니다.');
              }

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
            });

            this.sendLog(client, 'COMBAT', `You prepare to use ${item.name}...`);
            return;
          }
        }
      }

      // Not in combat - use immediately (existing logic)
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
          const effectJson = (item as any).effectString ? JSON.parse((item as any).effectString) as any : null;
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

  // ===== SOCIAL SYSTEM HANDLERS =====

  private async handleFriendList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const friends = await (this.prisma as any).friend.findMany({
        where: {
          OR: [
            { characterId: clientData.characterId, status: 'ACCEPTED' },
            { friendId: clientData.characterId, status: 'ACCEPTED' },
          ],
        },
        include: {
          character: { select: { id: true, name: true, level: true } },
          friend: { select: { id: true, name: true, level: true } },
        },
      });

      const friendList = friends.map((f: any) => ({
        id: f.id,
        friendId: f.characterId === clientData.characterId ? f.friendId : f.characterId,
        friendName: f.characterId === clientData.characterId ? f.friend.name : f.character.name,
        friendLevel: f.characterId === clientData.characterId ? f.friend.level : f.character.level,
        status: f.status,
        createdAt: f.createdAt,
      }));

      this.sendMessage(client, {
        t: 'FRIEND_LIST_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { friends: friendList },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'FRIEND_LIST_FAILED', error.message);
    }
  }

  private async handleFriendAdd(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const friendName = (message.p?.friendName || '').toString().trim();
    if (!friendName) {
      this.sendError(client, message.reqId, 'FRIEND_ADD_FAILED', '친구 이름이 필요합니다.');
      return;
    }

    try {
      const friend = await this.prisma.character.findUnique({
        where: { name: friendName },
      });

      if (!friend) {
        throw new Error('친구를 찾을 수 없습니다.');
      }

      if (friend.id === clientData.characterId) {
        throw new Error('자기 자신을 친구로 추가할 수 없습니다.');
      }

      const existing = await (this.prisma as any).friend.findUnique({
        where: {
          characterId_friendId: {
            characterId: clientData.characterId,
            friendId: friend.id,
          },
        },
      });

      if (existing) {
        throw new Error('이미 친구이거나 요청이 있습니다.');
      }

      await (this.prisma as any).friend.create({
        data: {
          characterId: clientData.characterId,
          friendId: friend.id,
          status: 'PENDING',
        },
      });

      this.sendMessage(client, {
        t: 'FRIEND_ADD_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { message: '친구 요청을 보냈습니다.' },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'FRIEND_ADD_FAILED', error.message);
    }
  }

  private async handleFriendAccept(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const friendRequestId = (message.p?.friendRequestId || '').toString().trim();
    if (!friendRequestId) {
      this.sendError(client, message.reqId, 'FRIEND_ACCEPT_FAILED', '친구 요청 ID가 필요합니다.');
      return;
    }

    try {
      const request = await (this.prisma as any).friend.findUnique({
        where: { id: friendRequestId },
      });

      if (!request || request.friendId !== clientData.characterId) {
        throw new Error('친구 요청을 찾을 수 없습니다.');
      }

      if (request.status !== 'PENDING') {
        throw new Error('이미 처리된 요청입니다.');
      }

      await (this.prisma as any).friend.update({
        where: { id: friendRequestId },
        data: { status: 'ACCEPTED' },
      });

      this.sendMessage(client, {
        t: 'FRIEND_ACCEPT_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { message: '친구 요청을 수락했습니다.' },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'FRIEND_ACCEPT_FAILED', error.message);
    }
  }

  private async handleFriendRemove(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const friendId = (message.p?.friendId || '').toString().trim();
    if (!friendId) {
      this.sendError(client, message.reqId, 'FRIEND_REMOVE_FAILED', '친구 ID가 필요합니다.');
      return;
    }

    try {
      await (this.prisma as any).friend.deleteMany({
        where: {
          OR: [
            { characterId: clientData.characterId, friendId },
            { characterId: friendId, friendId: clientData.characterId },
          ],
        },
      });

      this.sendMessage(client, {
        t: 'FRIEND_REMOVE_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { message: '친구를 삭제했습니다.' },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'FRIEND_REMOVE_FAILED', error.message);
    }
  }

  private async handleBlacklistList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const blacklist = await (this.prisma as any).blacklist.findMany({
        where: { characterId: clientData.characterId },
        include: {
          blocked: { select: { id: true, name: true, level: true } },
        },
      });

      this.sendMessage(client, {
        t: 'BLACKLIST_LIST_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { blacklist },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'BLACKLIST_LIST_FAILED', error.message);
    }
  }

  private async handleBlacklistAdd(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const blockedName = (message.p?.blockedName || '').toString().trim();
    if (!blockedName) {
      this.sendError(client, message.reqId, 'BLACKLIST_ADD_FAILED', '차단할 이름이 필요합니다.');
      return;
    }

    try {
      const blocked = await this.prisma.character.findUnique({
        where: { name: blockedName },
      });

      if (!blocked) {
        throw new Error('차단할 캐릭터를 찾을 수 없습니다.');
      }

      await (this.prisma as any).blacklist.upsert({
        where: {
          characterId_blockedId: {
            characterId: clientData.characterId,
            blockedId: blocked.id,
          },
        },
        create: {
          characterId: clientData.characterId,
          blockedId: blocked.id,
          reason: (message.p?.reason || '').toString().trim() || null,
        },
        update: {},
      });

      this.sendMessage(client, {
        t: 'BLACKLIST_ADD_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { message: '차단 목록에 추가했습니다.' },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'BLACKLIST_ADD_FAILED', error.message);
    }
  }

  private async handleBlacklistRemove(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const blockedId = (message.p?.blockedId || '').toString().trim();
    if (!blockedId) {
      this.sendError(client, message.reqId, 'BLACKLIST_REMOVE_FAILED', '차단 ID가 필요합니다.');
      return;
    }

    try {
      await (this.prisma as any).blacklist.delete({
        where: {
          characterId_blockedId: {
            characterId: clientData.characterId,
            blockedId,
          },
        },
      });

      this.sendMessage(client, {
        t: 'BLACKLIST_REMOVE_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { message: '차단을 해제했습니다.' },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'BLACKLIST_REMOVE_FAILED', error.message);
    }
  }

  private async handleMailList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const mails = await (this.prisma as any).mail.findMany({
        where: {
          toId: clientData.characterId,
          status: { not: 'DELETED' },
        },
        include: {
          from: { select: { id: true, name: true } },
        },
        orderBy: { sentAt: 'desc' },
        take: 50,
      });

      this.sendMessage(client, {
        t: 'MAIL_LIST_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { mails },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'MAIL_LIST_FAILED', error.message);
    }
  }

  private async handleMailSend(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const toName = (message.p?.toName || '').toString().trim();
    const subject = (message.p?.subject || '').toString().trim();
    const content = (message.p?.content || '').toString().trim();
    const gold = parseInt((message.p?.gold || '0').toString()) || 0;
    const items = message.p?.items || [];

    if (!toName || !subject || !content) {
      this.sendError(client, message.reqId, 'MAIL_SEND_FAILED', '받는 사람, 제목, 내용이 필요합니다.');
      return;
    }

    try {
      const to = await this.prisma.character.findUnique({
        where: { name: toName },
      });

      if (!to) {
        throw new Error('받는 사람을 찾을 수 없습니다.');
      }

      // 골드/아이템 확인 및 차감
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
      });

      if (gold > 0 && character!.gold < gold) {
        throw new Error('골드가 부족합니다.');
      }

      if (items.length > 0) {
        for (const item of items) {
          const inventory = await (this.prisma as any).inventory.findUnique({
            where: {
              characterId_itemId: {
                characterId: clientData.characterId,
                itemId: item.itemId,
              },
            },
          });

          if (!inventory || inventory.qty < item.qty) {
            throw new Error(`아이템 ${item.itemId}가 부족합니다.`);
          }
        }
      }

      await this.prisma.$transaction(async (tx) => {
        if (gold > 0) {
          await tx.character.update({
            where: { id: clientData.characterId },
            data: { gold: { decrement: gold } },
          });
        }

        if (items.length > 0) {
          for (const item of items) {
            await tx.inventory.update({
              where: {
                characterId_itemId: {
                  characterId: clientData.characterId!,
                  itemId: item.itemId,
                },
              },
              data: { qty: { decrement: item.qty } },
            });
          }
        }

        await (tx as any).mail.create({
          data: {
            fromId: clientData.characterId!,
            toId: to.id,
            subject,
            content,
            gold,
            itemsString: items.length > 0 ? JSON.stringify(items) : null,
            status: 'UNREAD',
          },
        });
      });

      this.sendMessage(client, {
        t: 'MAIL_SEND_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { message: '메일을 보냈습니다.' },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'MAIL_SEND_FAILED', error.message);
    }
  }

  private async handleMailRead(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const mailId = (message.p?.mailId || '').toString().trim();
    if (!mailId) {
      this.sendError(client, message.reqId, 'MAIL_READ_FAILED', '메일 ID가 필요합니다.');
      return;
    }

    try {
      const mail = await (this.prisma as any).mail.findUnique({
        where: { id: mailId },
        include: {
          from: { select: { id: true, name: true } },
        },
      });

      if (!mail || mail.toId !== clientData.characterId) {
        throw new Error('메일을 찾을 수 없습니다.');
      }

      if (mail.status === 'UNREAD') {
        await (this.prisma as any).mail.update({
          where: { id: mailId },
          data: { status: 'READ', readAt: new Date() },
        });
      }

      this.sendMessage(client, {
        t: 'MAIL_READ_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { mail },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'MAIL_READ_FAILED', error.message);
    }
  }

  private async handleMailDelete(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const mailId = (message.p?.mailId || '').toString().trim();
    if (!mailId) {
      this.sendError(client, message.reqId, 'MAIL_DELETE_FAILED', '메일 ID가 필요합니다.');
      return;
    }

    try {
      await (this.prisma as any).mail.update({
        where: {
          id: mailId,
          toId: clientData.characterId,
        },
        data: { status: 'DELETED', deletedAt: new Date() },
      });

      this.sendMessage(client, {
        t: 'MAIL_DELETE_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { message: '메일을 삭제했습니다.' },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'MAIL_DELETE_FAILED', error.message);
    }
  }

  private async handleMailClaim(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const mailId = (message.p?.mailId || '').toString().trim();
    if (!mailId) {
      this.sendError(client, message.reqId, 'MAIL_CLAIM_FAILED', '메일 ID가 필요합니다.');
      return;
    }

    try {
      const mail = await (this.prisma as any).mail.findUnique({
        where: { id: mailId },
      });

      if (!mail || mail.toId !== clientData.characterId) {
        throw new Error('메일을 찾을 수 없습니다.');
      }

      const items = mail.itemsString ? JSON.parse(mail.itemsString) as any[] : [];
      if (mail.gold === 0 && items.length === 0) {
        throw new Error('받을 보상이 없습니다.');
      }

      await this.prisma.$transaction(async (tx) => {
        if (mail.gold > 0) {
          await tx.character.update({
            where: { id: clientData.characterId },
            data: { gold: { increment: mail.gold } },
          });
        }

        if (items.length > 0) {
          for (const item of items) {
            await tx.inventory.upsert({
              where: {
                characterId_itemId: {
                  characterId: clientData.characterId!,
                  itemId: item.itemId,
                },
              },
              create: {
                characterId: clientData.characterId!,
                itemId: item.itemId,
                qty: item.qty,
              },
              update: {
                qty: { increment: item.qty },
              },
            });
          }
        }

        await (tx as any).mail.update({
          where: { id: mailId },
          data: { gold: 0, itemsString: null },
        });
      });

      await this.sendStateSync(client, clientData.characterId);

      this.sendMessage(client, {
        t: 'MAIL_CLAIM_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { message: '보상을 받았습니다.' },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'MAIL_CLAIM_FAILED', error.message);
    }
  }

  // ===== COLLECTION SYSTEM HANDLERS =====

  private async handleBestiaryList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const bestiary = await (this.prisma as any).bestiary.findMany({
        where: { characterId: clientData.characterId },
        include: {
          monster: true,
        },
        orderBy: { killCount: 'desc' },
      });

      this.sendMessage(client, {
        t: 'BESTIARY_LIST_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { bestiary },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'BESTIARY_LIST_FAILED', error.message);
    }
  }

  private async handleTitleList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const titles = await (this.prisma as any).title.findMany({
        where: { characterId: clientData.characterId },
        orderBy: { unlockedAt: 'desc' },
      });

      this.sendMessage(client, {
        t: 'TITLE_LIST_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { titles },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'TITLE_LIST_FAILED', error.message);
    }
  }

  private async handleTitleEquip(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const titleId = (message.p?.titleId || '').toString().trim();
    if (!titleId) {
      this.sendError(client, message.reqId, 'TITLE_EQUIP_FAILED', '칭호 ID가 필요합니다.');
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // 모든 칭호 비활성화
        await (tx as any).title.updateMany({
          where: { characterId: clientData.characterId },
          data: { isActive: false },
        });

        // 선택한 칭호 활성화
        await (tx as any).title.update({
          where: {
            characterId_titleId: {
              characterId: clientData.characterId,
              titleId,
            },
          },
          data: { isActive: true },
        });
      });

      await this.sendStateSync(client, clientData.characterId);

      this.sendMessage(client, {
        t: 'TITLE_EQUIP_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { message: '칭호를 장착했습니다.' },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'TITLE_EQUIP_FAILED', error.message);
    }
  }

  private async handleCollectibleList(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      const collectibles = await (this.prisma as any).collectible.findMany({
        where: { characterId: clientData.characterId },
        orderBy: { obtainedAt: 'desc' },
      });

      this.sendMessage(client, {
        t: 'COLLECTIBLE_LIST_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { collectibles },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'COLLECTIBLE_LIST_FAILED', error.message);
    }
  }

  // ===== ECONOMY EXPANSION HANDLERS =====

  private async handleBankInfo(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    try {
      let account = await (this.prisma as any).bankAccount.findUnique({
        where: { characterId: clientData.characterId },
      });

      if (!account) {
        account = await (this.prisma as any).bankAccount.create({
          data: {
            characterId: clientData.characterId,
            balance: 0,
            interestRate: 0.01,
          },
        });
      }

      // 이자 계산 (일일 1%)
      const now = new Date();
      const lastInterest = account.lastInterestAt ? new Date(account.lastInterestAt) : account.createdAt;
      const daysSinceInterest = Math.floor((now.getTime() - lastInterest.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceInterest > 0 && account.balance > 0) {
        const interest = Math.floor(account.balance * account.interestRate * daysSinceInterest);
        if (interest > 0) {
          await (this.prisma as any).bankAccount.update({
            where: { id: account.id },
            data: {
              balance: { increment: interest },
              lastInterestAt: now,
            },
          });

          await (this.prisma as any).bankTransaction.create({
            data: {
              accountId: account.id,
              type: 'INTEREST',
              amount: interest,
              balanceAfter: account.balance + interest,
              description: `${daysSinceInterest}일치 이자`,
            },
          });

          account.balance += interest;
          account.lastInterestAt = now;
        }
      }

      this.sendMessage(client, {
        t: 'BANK_INFO_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { account },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'BANK_INFO_FAILED', error.message);
    }
  }

  private async handleBankDeposit(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const amount = parseInt((message.p?.amount || '0').toString()) || 0;
    if (amount <= 0) {
      this.sendError(client, message.reqId, 'BANK_DEPOSIT_FAILED', '입금 금액이 필요합니다.');
      return;
    }

    try {
      const character = await this.prisma.character.findUnique({
        where: { id: clientData.characterId },
      });

      if (character!.gold < amount) {
        throw new Error('골드가 부족합니다.');
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.character.update({
          where: { id: clientData.characterId },
          data: { gold: { decrement: amount } },
        });

        let account = await (tx as any).bankAccount.findUnique({
          where: { characterId: clientData.characterId },
        });

        if (!account) {
          account = await (tx as any).bankAccount.create({
            data: {
              characterId: clientData.characterId,
              balance: 0,
              interestRate: 0.01,
            },
          });
        }

        await (tx as any).bankAccount.update({
          where: { id: account.id },
          data: { balance: { increment: amount } },
        });

        await (tx as any).bankTransaction.create({
          data: {
            accountId: account.id,
            type: 'DEPOSIT',
            amount,
            balanceAfter: account.balance + amount,
            description: '입금',
          },
        });
      });

      await this.sendStateSync(client, clientData.characterId);

      this.sendMessage(client, {
        t: 'BANK_DEPOSIT_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { message: `${amount}골드를 입금했습니다.` },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'BANK_DEPOSIT_FAILED', error.message);
    }
  }

  private async handleBankWithdraw(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const amount = parseInt((message.p?.amount || '0').toString()) || 0;
    if (amount <= 0) {
      this.sendError(client, message.reqId, 'BANK_WITHDRAW_FAILED', '출금 금액이 필요합니다.');
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const account = await (tx as any).bankAccount.findUnique({
          where: { characterId: clientData.characterId },
        });

        if (!account || account.balance < amount) {
          throw new Error('잔액이 부족합니다.');
        }

        await tx.character.update({
          where: { id: clientData.characterId },
          data: { gold: { increment: amount } },
        });

        await (tx as any).bankAccount.update({
          where: { id: account.id },
          data: { balance: { decrement: amount } },
        });

        await (tx as any).bankTransaction.create({
          data: {
            accountId: account.id,
            type: 'WITHDRAW',
            amount,
            balanceAfter: account.balance - amount,
            description: '출금',
          },
        });
      });

      await this.sendStateSync(client, clientData.characterId);

      this.sendMessage(client, {
        t: 'BANK_WITHDRAW_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { message: `${amount}골드를 출금했습니다.` },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'BANK_WITHDRAW_FAILED', error.message);
    }
  }

  private async handleBankHistory(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const limit = parseInt((message.p?.limit || '50').toString()) || 50;

    try {
      const account = await (this.prisma as any).bankAccount.findUnique({
        where: { characterId: clientData.characterId },
      });

      if (!account) {
        this.sendMessage(client, {
          t: 'BANK_HISTORY_OK',
          reqId: message.reqId,
          ts: Date.now(),
          p: { transactions: [] },
        });
        return;
      }

      const transactions = await (this.prisma as any).bankTransaction.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      this.sendMessage(client, {
        t: 'BANK_HISTORY_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { transactions },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'BANK_HISTORY_FAILED', error.message);
    }
  }

  private async handleExchangeList(client: WSClient, message: WSMessage) {
    try {
      const itemId = (message.p?.itemId || '').toString().trim();
      const limit = parseInt((message.p?.limit || '50').toString()) || 50;

      const where: any = { status: 'ACTIVE' };
      if (itemId) {
        where.itemId = itemId;
      }

      const listings = await (this.prisma as any).exchangeListing.findMany({
        where,
        include: {
          item: true,
          seller: { select: { id: true, name: true } },
        },
        orderBy: { price: 'asc' },
        take: limit,
      });

      this.sendMessage(client, {
        t: 'EXCHANGE_LIST_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { listings },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'EXCHANGE_LIST_FAILED', error.message);
    }
  }

  private async handleExchangeSell(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const itemId = (message.p?.itemId || '').toString().trim();
    const qty = parseInt((message.p?.qty || '1').toString()) || 1;
    const price = parseInt((message.p?.price || '0').toString()) || 0;

    if (!itemId || qty <= 0 || price <= 0) {
      this.sendError(client, message.reqId, 'EXCHANGE_SELL_FAILED', '아이템 ID, 수량, 가격이 필요합니다.');
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const inventory = await tx.inventory.findUnique({
          where: {
            characterId_itemId: {
              characterId: clientData.characterId!,
              itemId,
            },
          },
        });

        if (!inventory || inventory.qty < qty) {
          throw new Error('아이템이 부족합니다.');
        }

        await tx.inventory.update({
          where: {
            characterId_itemId: {
              characterId: clientData.characterId!,
              itemId,
            },
          },
          data: { qty: { decrement: qty } },
        });

        await (tx as any).exchangeListing.create({
          data: {
            itemId,
            sellerId: clientData.characterId,
            price,
            qty,
            totalPrice: price * qty,
            status: 'ACTIVE',
          },
        });
      });

      await this.sendStateSync(client, clientData.characterId);

      this.sendMessage(client, {
        t: 'EXCHANGE_SELL_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { message: '거래소에 등록했습니다.' },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'EXCHANGE_SELL_FAILED', error.message);
    }
  }

  private async handleExchangeBuy(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const listingId = (message.p?.listingId || '').toString().trim();
    const qty = parseInt((message.p?.qty || '1').toString()) || 1;

    if (!listingId || qty <= 0) {
      this.sendError(client, message.reqId, 'EXCHANGE_BUY_FAILED', '거래 ID와 수량이 필요합니다.');
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const listing = await (tx as any).exchangeListing.findUnique({
          where: { id: listingId },
          include: { item: true },
        });

        if (!listing || listing.status !== 'ACTIVE') {
          throw new Error('거래를 찾을 수 없습니다.');
        }

        if (listing.qty < qty) {
          throw new Error('수량이 부족합니다.');
        }

        const totalPrice = listing.price * qty;
        const buyer = await tx.character.findUnique({
          where: { id: clientData.characterId },
        });

        if (buyer!.gold < totalPrice) {
          throw new Error('골드가 부족합니다.');
        }

        // 구매자 골드 차감
        await tx.character.update({
          where: { id: clientData.characterId },
          data: { gold: { decrement: totalPrice } },
        });

        // 판매자 골드 지급
        await tx.character.update({
          where: { id: listing.sellerId },
          data: { gold: { increment: totalPrice } },
        });

        // 아이템 전달
        await tx.inventory.upsert({
          where: {
            characterId_itemId: {
              characterId: clientData.characterId!,
              itemId: listing.itemId,
            },
          },
          create: {
            characterId: clientData.characterId!,
            itemId: listing.itemId,
            qty,
          },
          update: {
            qty: { increment: qty },
          },
        });

        // 거래 업데이트
        if (listing.qty === qty) {
          await (tx as any).exchangeListing.update({
            where: { id: listingId },
            data: { status: 'SOLD', soldAt: new Date() },
          });
        } else {
          await (tx as any).exchangeListing.update({
            where: { id: listingId },
            data: { qty: { decrement: qty }, totalPrice: { decrement: totalPrice } },
          });
        }
      });

      await this.sendStateSync(client, clientData.characterId);

      this.sendMessage(client, {
        t: 'EXCHANGE_BUY_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { message: '구매했습니다.' },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'EXCHANGE_BUY_FAILED', error.message);
    }
  }

  private async handleExchangeCancel(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    const listingId = (message.p?.listingId || '').toString().trim();
    if (!listingId) {
      this.sendError(client, message.reqId, 'EXCHANGE_CANCEL_FAILED', '거래 ID가 필요합니다.');
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const listing = await (tx as any).exchangeListing.findUnique({
          where: { id: listingId },
        });

        if (!listing || listing.sellerId !== clientData.characterId) {
          throw new Error('거래를 찾을 수 없습니다.');
        }

        if (listing.status !== 'ACTIVE') {
          throw new Error('취소할 수 없는 거래입니다.');
        }

        // 아이템 반환
        await tx.inventory.upsert({
          where: {
            characterId_itemId: {
              characterId: clientData.characterId!,
              itemId: listing.itemId,
            },
          },
          create: {
            characterId: clientData.characterId!,
            itemId: listing.itemId,
            qty: listing.qty,
          },
          update: {
            qty: { increment: listing.qty },
          },
        });

        await (tx as any).exchangeListing.update({
          where: { id: listingId },
          data: { status: 'CANCELLED' },
        });
      });

      await this.sendStateSync(client, clientData.characterId);

      this.sendMessage(client, {
        t: 'EXCHANGE_CANCEL_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { message: '거래를 취소했습니다.' },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'EXCHANGE_CANCEL_FAILED', error.message);
    }
  }

  // ===== ADMIN TOOLS HANDLERS =====

  private async handleAdminStats(client: WSClient, message: WSMessage) {
    const clientData = this.clients.get(client);
    if (!clientData?.characterId) return;

    // TODO: Admin 권한 체크 필요
    try {
      const stats = {
        totalCharacters: await this.prisma.character.count(),
        totalOnline: this.clients.size,
        totalGold: await this.prisma.character.aggregate({
          _sum: { gold: true },
        }),
        totalItems: await this.prisma.inventory.count(),
        totalParties: await this.prisma.party.count(),
        totalGuilds: await (this.prisma as any).guild.count(),
      };

      this.sendMessage(client, {
        t: 'ADMIN_STATS_OK',
        reqId: message.reqId,
        ts: Date.now(),
        p: { stats },
      });
    } catch (error: any) {
      this.sendError(client, message.reqId, 'ADMIN_STATS_FAILED', error.message);
    }
  }
}

