import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { BossService } from '../boss/boss.service';
import * as fs from 'fs';
import * as path from 'path';
import { addSeconds } from '../../common/utils/time';
import { rollChance, randomInt } from '../../common/utils/rng';

@Injectable()
export class CombatService {
  private balance: { partyExpBonusPct: number } = { partyExpBonusPct: 20 };
  
  constructor(
    private readonly prisma: PrismaService,
    private readonly bossService: BossService,
  ) {
    this.loadBalance();
  }
  
  private loadBalance() {
    try {
      const balancePath = path.join(process.cwd(), 'content', 'balance.json');
      if (fs.existsSync(balancePath)) {
        const data = fs.readFileSync(balancePath, 'utf-8');
        this.balance = JSON.parse(data);
        console.log(`[CombatService] balance.json 로드 완료: partyExpBonusPct=${this.balance.partyExpBonusPct}`);
      }
    } catch (error) {
      console.error('[CombatService] balance.json 로드 실패:', error);
    }
  }

  async createEncounter(partyId: string, roomId: string, monsterId: string, isBoss = false) {
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

    if (!party) {
      throw new Error('파티를 찾을 수 없습니다.');
    }

    const monster = await this.prisma.monster.findUnique({
      where: { id: monsterId },
    });

    if (!monster) {
      throw new Error('몬스터를 찾을 수 없습니다.');
    }

    const turnSeconds = party.speedMode === 'FAST' ? 3 : 9;
    const turnDeadlineAt = addSeconds(new Date(), turnSeconds);

    const encounter = await this.prisma.encounter.create({
      data: {
        partyId,
        roomId,
        isBoss,
        turnDeadlineAt,
        timeBankRemaining: 1,
        stateJson: {
          party: party.members.map((m) => ({
            id: m.characterId,
            name: m.character.name,
            hp: m.character.hp,
            hpMax: m.character.hpMax,
            action: null,
          })),
          enemies: [
            {
              id: monster.id,
              name: monster.name,
              hp: monster.hp,
              hpMax: monster.hp,
              atk: monster.atk,
              def: monster.def,
            },
          ],
        },
      },
    });

    return encounter;
  }

  async setCombatAction(encounterId: string, characterId: string, action: string, targetId?: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
    });

    if (!encounter) {
      throw new Error('전투를 찾을 수 없습니다.');
    }

    const state = encounter.stateJson as any;
    const participant = state.party.find((p: any) => p.id === characterId);

    if (!participant) {
      throw new Error('전투 참가자가 아닙니다.');
    }

    participant.action = action;
    participant.targetId = targetId;

    await this.prisma.encounter.update({
      where: { id: encounterId },
      data: { stateJson: state },
    });
  }

  async useTimeBank(encounterId: string, characterId: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        party: true,
      },
    });

    if (!encounter || !encounter.party) {
      throw new Error('전투를 찾을 수 없습니다.');
    }

    if (encounter.party.leaderCharacterId !== characterId) {
      throw new Error('파티 리더만 타임뱅크를 사용할 수 있습니다.');
    }

    if (encounter.timeBankRemaining <= 0) {
      throw new Error('타임뱅크를 모두 사용했습니다.');
    }

    const newDeadline = addSeconds(encounter.turnDeadlineAt, 3);

    await this.prisma.encounter.update({
      where: { id: encounterId },
      data: {
        turnDeadlineAt: newDeadline,
        timeBankRemaining: encounter.timeBankRemaining - 1,
      },
    });
  }

  // 전투 락 (동시 호출 방지)
  private resolvingEncounters = new Set<string>();

  async resolveTurn(encounterId: string) {
    // 중복 호출 방지
    if (this.resolvingEncounters.has(encounterId)) {
      return null;
    }

    this.resolvingEncounters.add(encounterId);

    try {
      // Encounter 조회
      const encounter = await this.prisma.encounter.findUnique({
        where: { id: encounterId },
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

      if (!encounter || !encounter.party) {
        return null;
      }

      const state = encounter.stateJson as any;
      
      // 이미 종료된 전투
      if (state.ended) {
        return null;
      }

      const logs: string[] = [];

      // 1. 플레이어 행동 결정
      for (const member of encounter.party.members) {
        const participant = state.party.find((p: any) => p.id === member.characterId);
        if (!participant || participant.hp <= 0) continue;

        let action = participant.action;

        // 행동 미입력 시 자동 결정
        if (!action) {
          if (member.autoEnabled) {
            // 프리셋 기반
            const preset = member.autoPreset;
            if (preset === 'AGGRO' || preset === 'SAVER') {
              action = 'ATTACK';
            } else if (preset === 'GUARD' || preset === 'SUSTAIN' || preset === 'SUPPORT') {
              action = 'DEFEND';
            } else if (preset === 'RETREAT') {
              action = 'RETREAT';
            } else {
              action = 'ATTACK';
            }
          } else {
            action = 'ATTACK';
          }
        }

        participant.finalAction = action;
      }

      // 2. RETREAT 투표 확인
      const aliveParty = state.party.filter((p: any) => p.hp > 0);
      const retreatVotes = aliveParty.filter((p: any) => p.finalAction === 'RETREAT').length;
      const totalAlive = aliveParty.length;

      if (retreatVotes > totalAlive / 2) {
        // 도주 성공
        state.ended = true;
        state.result = 'RETREAT';
        state.endedAt = new Date();

        await this.prisma.encounter.update({
          where: { id: encounterId },
          data: { stateJson: state },
        });

        return {
          encounter,
          result: 'RETREAT',
          resolvePayload: { turnNo: encounter.turnNo, actions: [] },
          endPayload: { result: 'RETREAT', rewards: {} },
          logs: ['파티가 도주했습니다.'],
        };
      }

      // 3. 플레이어 공격 처리
      const enemy = state.enemies[0];
      if (!enemy || enemy.hp <= 0) {
        state.ended = true;
        state.result = 'WIN';
        state.endedAt = new Date();

        await this.prisma.encounter.update({
          where: { id: encounterId },
          data: { stateJson: state },
        });

        return {
          encounter,
          result: 'WIN',
          resolvePayload: { turnNo: encounter.turnNo, actions: [] },
          endPayload: { result: 'WIN', rewards: { exp: 100, gold: 50 } },
          logs: ['승리했습니다!'],
        };
      }

      for (const participant of aliveParty) {
        if (participant.finalAction === 'ATTACK') {
          const char = encounter.party.members.find((m) => m.characterId === participant.id)?.character;
          if (!char) continue;

          // 장비 보너스 계산
          const equipment = await this.prisma.equipment.findMany({
            where: { characterId: char.id },
            include: { item: true },
          });

          let equipAtk = 0;
          let equipDef = 0;
          for (const eq of equipment) {
            equipAtk += eq.item.atk;
            equipDef += eq.item.def;
          }

          const baseAtk = Math.max(1, (char.str || 5) + (char.level || 1));
          const totalAtk = baseAtk + equipAtk;
          const dmg = Math.max(1, totalAtk - (enemy.def || 0));

          console.log(`[STAT] ${char.name}: baseAtk=${baseAtk}, equipAtk=${equipAtk}, totalAtk=${totalAtk}, dmg=${dmg}`);

          enemy.hp = Math.max(0, enemy.hp - dmg);
          logs.push(`${participant.name}이(가) ${enemy.name}에게 ${dmg} 피해를 입혔습니다. (${enemy.hp}/${enemy.hpMax})`);

          if (enemy.hp <= 0) {
            break;
          }
        } else if (participant.finalAction === 'DEFEND') {
          logs.push(`${participant.name}이(가) 방어 자세를 취했습니다.`);
        }
      }

      // 4. 적 처치 확인
      if (enemy.hp <= 0) {
        state.ended = true;
        state.result = 'WIN';
        state.endedAt = new Date();

        await this.prisma.encounter.update({
          where: { id: encounterId },
          data: { stateJson: state },
        });

        // 보상 적용
        const rewards = await this.applyRewards(encounter, enemy.id);

        return {
          encounter,
          result: 'WIN',
          resolvePayload: { turnNo: encounter.turnNo, actions: logs },
          endPayload: { result: 'WIN', rewards },
          logs,
        };
      }

      // 5. 몬스터 공격
      const aliveTargets = aliveParty.filter((p: any) => p.hp > 0);
      if (aliveTargets.length > 0) {
        const target = aliveTargets[0]; // 첫 번째 대상
        const targetMember = encounter.party.members.find((m) => m.characterId === target.id);
        
        if (targetMember) {
          const char = targetMember.character;

          // 장비 방어력 계산
          const equipment = await this.prisma.equipment.findMany({
            where: { characterId: char.id },
            include: { item: true },
          });

          let equipDef = 0;
          for (const eq of equipment) {
            equipDef += eq.item.def;
          }

          const baseDef = Math.max(0, (char.dex || 3));
          const totalDef = baseDef + equipDef;
          let mdmg = Math.max(1, (enemy.atk || 5) - totalDef);

          console.log(`[STAT] ${char.name}: baseDef=${baseDef}, equipDef=${equipDef}, totalDef=${totalDef}, incomingDmg=${mdmg}`);

          // 방어 중이면 피해 50% 감소
          if (target.finalAction === 'DEFEND') {
            mdmg = Math.ceil(mdmg * 0.5);
          }

          target.hp = Math.max(0, target.hp - mdmg);
          logs.push(`${enemy.name}이(가) ${target.name}에게 ${mdmg} 피해를 입혔습니다. (${target.hp}/${target.hpMax})`);
        }
      }

      // 6. 파티 전멸 확인
      const remainingAlive = state.party.filter((p: any) => p.hp > 0).length;
      if (remainingAlive === 0) {
        state.ended = true;
        state.result = 'LOSE';
        state.endedAt = new Date();

        await this.prisma.encounter.update({
          where: { id: encounterId },
          data: { stateJson: state },
        });

        // 사망 처리: 파티원 전체에 대해
        for (const member of encounter.party.members) {
          await this.applyDeath(member.characterId);
          logs.push(`${member.character.name}이(가) 사망했습니다. START_TOWN에서 부활합니다...`);
        }

        return {
          encounter,
          result: 'LOSE',
          resolvePayload: { turnNo: encounter.turnNo, actions: logs },
          endPayload: { result: 'LOSE', rewards: {}, deaths: encounter.party.members.map(m => m.characterId) },
          logs,
        };
      }

      // 7. 다음 턴 준비
      const turnSeconds = encounter.party.speedMode === 'FAST' ? 3 : 9;
      const now = new Date();
      const newDeadline = addSeconds(now, turnSeconds);
      console.log(`[resolveTurn] encounterId=${encounterId.substring(0, 8)}, speedMode=${encounter.party.speedMode}, turnSeconds=${turnSeconds}, now=${now.getTime()}, newDeadline=${newDeadline.getTime()}`);

      // 행동 초기화
      for (const participant of state.party) {
        participant.action = null;
        participant.finalAction = null;
      }

      await this.prisma.encounter.update({
        where: { id: encounterId },
        data: {
          turnNo: encounter.turnNo + 1,
          turnDeadlineAt: newDeadline,
          stateJson: state,
        },
      });

      return {
        encounter: { ...encounter, turnNo: encounter.turnNo + 1, turnDeadlineAt: newDeadline },
        result: null,
        resolvePayload: { turnNo: encounter.turnNo, actions: logs, state },
        endPayload: null,
        logs,
      };
    } finally {
      this.resolvingEncounters.delete(encounterId);
    }
  }

  // 보상 적용 (경험치, 골드, 드랍, 레벨업)
  private async applyRewards(encounter: any, monsterId: string) {
    const rewards = {
      expGained: 0,
      goldGained: 0,
      items: [] as Array<{ itemId: string; qty: number }>,
    };

    // 몬스터 정보 조회
    const monster = await this.prisma.monster.findUnique({
      where: { id: monsterId },
      include: {
        drops: {
          include: {
            item: true,
          },
        },
      },
    });

    if (!monster) {
      return rewards;
    }

    // 보스 멀티플라이 체크
    let expMult = 1.0;
    let goldMult = 1.0;
    const bossSpawn = this.bossService.getSpawnByRoom(encounter.roomId);
    if (bossSpawn && encounter.isBoss) {
      expMult = bossSpawn.reward.expMult;
      goldMult = bossSpawn.reward.goldMult;
      // 보스 킬 기록
      this.bossService.markBossKilled(encounter.roomId);
    }

    // 기본 보상 (고정값)
    let baseExp = 50;
    let baseGold = 20;

    // 보스 멀티플라이 적용
    baseExp = Math.floor(baseExp * expMult);
    baseGold = Math.floor(baseGold * goldMult);

    // 보스 보장 보상 아이템 (트로피) 추출
    const bossGuaranteedItems: Array<{ itemId: string; qty: number }> = [];
    if (bossSpawn && encounter.isBoss && bossSpawn.rewardItemsGuaranteed) {
      for (const rewardItem of bossSpawn.rewardItemsGuaranteed) {
        bossGuaranteedItems.push({
          itemId: rewardItem.itemId,
          qty: rewardItem.qty,
        });
      }
    }

    // 파티 보너스 체크: 2명 이상 + 같은 방
    const partyMembersInSameRoom = encounter.party.members.filter(
      (m: any) => m.character && m.character.roomId === encounter.roomId
    );
    const hasPartyBonus = partyMembersInSameRoom.length >= 2;
    let partyBonusApplied = false;

    // 파티 멤버들에게 보상 지급
    for (const member of encounter.party.members) {
      const character = member.character;
      if (!character || character.hp <= 0) continue;

      // 트랜잭션으로 보상 적용
      await this.prisma.$transaction(async (tx) => {
        // 파티 보너스 적용
        let finalExp = baseExp;
        if (hasPartyBonus && character.roomId === encounter.roomId) {
          finalExp = Math.floor(baseExp * (1 + this.balance.partyExpBonusPct / 100));
          partyBonusApplied = true;
        }
        
        // 경험치/골드 지급
        let newExp = character.exp + finalExp;
        const newGold = character.gold + baseGold;

        // 레벨업 처리
        let newLevel = character.level;
        let newHpMax = character.hpMax;
        let newStaminaMax = character.staminaMax;

        while (true) {
          const nextExp = 50 * newLevel;
          if (newExp >= nextExp) {
            newLevel++;
            newHpMax += 5;
            newStaminaMax += 3;
            newExp -= nextExp;
          } else {
            break;
          }
        }

        // 캐릭터 업데이트
        await tx.character.update({
          where: { id: character.id },
          data: {
            exp: newExp,
            gold: newGold,
            level: newLevel,
            hpMax: newHpMax,
            staminaMax: newStaminaMax,
            hp: newHpMax, // 최대치로 회복
            stamina: newStaminaMax, // 최대치로 회복
          },
        });

        // 드랍 처리
        const droppedItems: Array<{ itemId: string; qty: number }> = [];

        // 보스 보장 보상 먼저 지급
        if (bossGuaranteedItems.length > 0) {
          for (const guaranteedItem of bossGuaranteedItems) {
            await tx.inventory.upsert({
              where: {
                characterId_itemId: {
                  characterId: character.id,
                  itemId: guaranteedItem.itemId,
                },
              },
              update: {
                qty: {
                  increment: guaranteedItem.qty,
                },
              },
              create: {
                characterId: character.id,
                itemId: guaranteedItem.itemId,
                qty: guaranteedItem.qty,
              },
            });
            droppedItems.push(guaranteedItem);
          }
        }

        if (monster.drops && monster.drops.length > 0) {
          for (const drop of monster.drops) {
            if (rollChance(drop.chanceBp)) {
              const qty = randomInt(drop.minQty, drop.maxQty);

              // 인벤토리에 추가 (upsert)
              await tx.inventory.upsert({
                where: {
                  characterId_itemId: {
                    characterId: character.id,
                    itemId: drop.itemId,
                  },
                },
                update: {
                  qty: {
                    increment: qty,
                  },
                },
                create: {
                  characterId: character.id,
                  itemId: drop.itemId,
                  qty,
                },
              });

              droppedItems.push({
                itemId: drop.itemId,
                qty,
              });
            }
          }
        } else {
          // TODO: 드랍 테이블이 비어있으면 임시로 기본 아이템 1개 드랍
          // 실제 게임에서는 seed에 드랍이 설정되어 있어야 함
          const defaultItem = await tx.item.findFirst({
            where: { type: 'consumable' },
          });

          if (defaultItem) {
            await tx.inventory.upsert({
              where: {
                characterId_itemId: {
                  characterId: character.id,
                  itemId: defaultItem.id,
                },
              },
              update: {
                qty: {
                  increment: 1,
                },
              },
              create: {
                characterId: character.id,
                itemId: defaultItem.id,
                qty: 1,
              },
            });

            droppedItems.push({
              itemId: defaultItem.id,
              qty: 1,
            });
          }
        }

        // 첫 번째 멤버의 보상만 반환 (파티 전체는 동일)
        if (member === encounter.party.members[0]) {
          rewards.expGained = finalExp;
          rewards.goldGained = baseGold;
          rewards.items = droppedItems;
        }
      });
    }
    
    // 파티 보너스 적용 로그
    if (partyBonusApplied) {
      console.log(`[PARTY] 파티 보너스 적용: +${this.balance.partyExpBonusPct}% EXP (${baseExp} -> ${Math.floor(baseExp * (1 + this.balance.partyExpBonusPct / 100))})`);
    }

    return rewards;
  }

  // 사망 처리
  async applyDeath(characterId: string) {
    const RESPAWN_ROOM = 'START_TOWN';
    const GOLD_PENALTY_PERCENT = 0.1; // 10%
    const HP_RESPAWN_PERCENT = 0.5; // 50%

    await this.prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { id: characterId },
      });

      if (!character) return;

      // 골드 페널티 (10% 감소, 최소 0)
      const goldLost = Math.floor(character.gold * GOLD_PENALTY_PERCENT);
      const newGold = Math.max(0, character.gold - goldLost);

      // HP 50%로 부활 (최소 1 보장)
      const respawnHp = Math.max(1, Math.floor(character.hpMax * HP_RESPAWN_PERCENT));

      await tx.character.update({
        where: { id: characterId },
        data: {
          hp: respawnHp,
          gold: newGold,
          roomId: RESPAWN_ROOM,
        },
      });

      console.log(`[DEATH] ${character.name}: goldLost=${goldLost}, respawnHp=${respawnHp}, respawnRoom=${RESPAWN_ROOM}`);
    });
  }
}

