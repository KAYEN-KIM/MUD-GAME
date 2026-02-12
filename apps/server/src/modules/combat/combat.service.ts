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
        stateString: JSON.stringify({
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
        }),
      } as any,
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

    const state = JSON.parse((encounter as any).stateString || '{}') as any;
    const participant = state.party.find((p: any) => p.id === characterId);

    if (!participant) {
      throw new Error('전투 참가자가 아닙니다.');
    }

    participant.action = action;
    participant.targetId = targetId;
    
    // If action is a spell ID (not ATTACK/DEFEND/RETREAT), store it in finalAction
    // This allows resolveTurn to recognize it as a spell cast
    if (action !== 'ATTACK' && action !== 'DEFEND' && action !== 'RETREAT') {
      participant.finalAction = action; // Store spell ID (e.g., 'missile', 'heal') in finalAction
      console.log(`[CombatService] setCombatAction: 주문 저장 - characterId=${characterId}, spellId=${action}, targetId=${targetId}, finalAction=${participant.finalAction}`);
    } else {
      // Clear finalAction for regular actions (will be set in resolveTurn)
      participant.finalAction = null;
    }

    await this.prisma.encounter.update({
      where: { id: encounterId },
      data: { stateString: JSON.stringify(state) } as any,
    });
    
    console.log(`[CombatService] setCombatAction: 완료 - encounterId=${encounterId}, participant.action=${participant.action}, participant.finalAction=${participant.finalAction}`);
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

      const state = JSON.parse((encounter as any).stateString || '{}') as any;
      
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

        // 행동 미입력 시 자동 결정 (단, 주문은 자동 결정하지 않음)
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

        // 주문 ID가 action에 저장되어 있으면 그대로 사용, 아니면 일반 액션으로 처리
        // 주문 ID는 'heal', 'missile' 등이고, 일반 액션은 'ATTACK', 'DEFEND', 'RETREAT'
        participant.finalAction = action;
        
        // 디버그 로그
        if (action && action !== 'ATTACK' && action !== 'DEFEND' && action !== 'RETREAT') {
          console.log(`[CombatService] resolveTurn: 주문 감지 - characterId=${member.characterId}, spellId=${action}, finalAction=${participant.finalAction}`);
        }
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
          data: { stateString: JSON.stringify(state) } as any,
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
          data: { stateString: JSON.stringify(state) } as any,
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
        } else if (participant.finalAction && participant.finalAction !== 'ATTACK' && participant.finalAction !== 'DEFEND' && participant.finalAction !== 'RETREAT') {
          // 주문 시전 처리 (finalAction에 주문 ID가 저장됨: 'heal', 'missile' 등)
          const char = encounter.party.members.find((m) => m.characterId === participant.id)?.character;
          if (!char) {
            console.log(`[CombatService] resolveTurn: 주문 처리 실패 - character를 찾을 수 없음: participant.id=${participant.id}`);
            continue;
          }

          const spellId = participant.finalAction; // finalAction에 주문 ID가 저장됨
          const targetId = participant.targetId;
          
          console.log(`[CombatService] resolveTurn: 주문 처리 시작 - spellId=${spellId}, targetId=${targetId}, participant.hp=${participant.hp}`);

          // 주문 처리 (spell-registry 사용, 시너지 효과 포함)
          try {
            const { getSpell, getSpellSynergy, applySpellSynergy } = require('../combat-tick/spell-registry');
            const spell = getSpell(spellId);
            
            console.log(`[CombatService] resolveTurn: 주문 조회 - spellId=${spellId}, spell=${spell ? spell.name : 'null'}`);

            if (spell) {
              // 최근 사용한 스펠 목록 (시너지 체크용, 간단히 최근 2개만 체크)
              const recentSpells: string[] = [];
              for (const p of aliveParty) {
                if (p.finalAction && p.finalAction !== 'ATTACK' && p.finalAction !== 'DEFEND' && p.finalAction !== 'RETREAT') {
                  recentSpells.push(p.finalAction);
                }
              }
              const synergy = getSpellSynergy(recentSpells);
              const enhancedSpell = applySpellSynergy(spell, synergy);

              if (spell.type === 'DAMAGE') {
                // 데미지 주문
                const target = targetId ? state.enemies.find((e: any) => e.id === targetId) : enemy;
                if (target && target.hp > 0) {
                  const variance = Math.floor((Math.random() * 6) - 2); // -2 to +3
                  const dmg = Math.max(1, enhancedSpell.power + variance);
                  target.hp = Math.max(0, target.hp - dmg);
                  const synergyText = synergy ? ' (시너지 발동!)' : '';
                  logs.push(`${participant.name}의 ${spell.name}${synergyText}이(가) ${target.name}에게 ${dmg} 피해를 입혔습니다! (${target.hp}/${target.hpMax})`);
                  
                  console.log(`[CombatService] resolveTurn: 데미지 주문 실행 - dmg=${dmg}, synergy=${synergy ? 'YES' : 'NO'}, target.hp=${target.hp}`);
                  
                  if (target.hp <= 0) {
                    break;
                  }
                } else {
                  console.log(`[CombatService] resolveTurn: 데미지 주문 실패 - target를 찾을 수 없음 또는 이미 죽음`);
                }
              } else if (spell.type === 'HEAL') {
                // 회복 주문 (시너지 효과 포함)
                const target = targetId ? state.party.find((p: any) => p.id === targetId) : participant;
                if (target && target.hp > 0) {
                  const variance = Math.floor((Math.random() * 4) - 1); // -1 to +2
                  const heal = Math.max(1, enhancedSpell.power + variance);
                  const maxHp = target.hpMax || 200;
                  const oldHp = target.hp;
                  target.hp = Math.min(maxHp, target.hp + heal);
                  const synergyText = synergy ? ' (시너지 발동!)' : '';
                  logs.push(`${participant.name}의 ${spell.name}${synergyText}이(가) ${target.name}의 체력을 ${heal} 회복시켰습니다! (${oldHp} → ${target.hp}/${maxHp})`);
                  
                  console.log(`[CombatService] resolveTurn: 회복 주문 실행 - heal=${heal}, synergy=${synergy ? 'YES' : 'NO'}, target.hp=${target.hp}`);
                  
                  // 캐릭터 HP 업데이트
                  if (target.id === participant.id) {
                    await this.prisma.character.update({
                      where: { id: char.id },
                      data: { hp: target.hp },
                    });
                  }
                } else {
                  console.log(`[CombatService] resolveTurn: 회복 주문 실패 - target를 찾을 수 없음`);
                }
              } else if (spell.type === 'SHIELD') {
                // 보호막 주문 (turn-based에서는 간단히 로그만)
                logs.push(`${participant.name}의 ${spell.name}이(가) 보호막을 생성했습니다! (${spell.power} 피해 흡수)`);
                console.log(`[CombatService] resolveTurn: 보호막 주문 실행 - absorption=${spell.power}`);
              } else if (spell.type === 'BUFF') {
                // 버프 주문
                logs.push(`${participant.name}의 ${spell.name}이(가) 공격력을 ${spell.power} 증가시켰습니다!`);
                console.log(`[CombatService] resolveTurn: 버프 주문 실행 - attackBoost=${spell.power}`);
                // Note: turn-based combat에서는 버프 효과를 다음 턴에 적용하는 것이 복잡하므로 로그만 표시
              } else if (spell.type === 'DEBUFF') {
                // 디버프 주문
                const target = targetId ? state.enemies.find((e: any) => e.id === targetId) : enemy;
                if (target) {
                  logs.push(`${participant.name}의 ${spell.name}이(가) ${target.name}의 방어력을 ${spell.power} 감소시켰습니다!`);
                  console.log(`[CombatService] resolveTurn: 디버프 주문 실행 - defenseReduction=${spell.power}`);
                  // Note: turn-based combat에서는 디버프 효과를 다음 턴에 적용하는 것이 복잡하므로 로그만 표시
                }
              }
            } else {
              console.log(`[CombatService] resolveTurn: 주문을 찾을 수 없음 - spellId=${spellId}`);
              logs.push(`${participant.name}이(가) 알 수 없는 주문을 시전하려고 했습니다.`);
            }
          } catch (error) {
            console.error('[CombatService] Spell casting error:', error);
            logs.push(`${participant.name}의 주문 시전이 실패했습니다.`);
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
          data: { stateString: JSON.stringify(state) } as any,
        });

        // 보상 적용
        const enemyId = enemy?.id || '';
        const rewards = await this.applyRewards(encounter, enemyId);

        // 던전/레이드 클리어 체크
        const roomId = encounter.roomId;
        const partyId = encounter.partyId;
        if (enemyId && roomId && partyId) {
          await this.checkDungeonRaidProgress(partyId, roomId, encounter.isBoss);
        }

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
          data: { stateString: JSON.stringify(state) } as any,
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
          stateString: JSON.stringify(state),
        } as any,
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

    // 던전/레이드 배율 체크
    let expMult = 1.0;
    let goldMult = 1.0;
    let itemMult = 1.0;

    // 던전 인스턴스 확인
    const dungeonInstance = await (this.prisma as any).dungeonInstance.findFirst({
      where: {
        partyId: encounter.partyId,
        status: 'ACTIVE',
      },
      include: { dungeon: true },
    });

    if (dungeonInstance) {
      const difficultyMultipliers: Record<string, { exp: number; gold: number; item: number }> = {
        EASY: { exp: 0.8, gold: 0.8, item: 0.8 },
        NORMAL: { exp: 1.0, gold: 1.0, item: 1.0 },
        HARD: { exp: 1.5, gold: 1.5, item: 1.5 },
        NIGHTMARE: { exp: 2.5, gold: 2.5, item: 2.5 },
      };
      const multiplier = difficultyMultipliers[dungeonInstance.difficulty] || difficultyMultipliers.NORMAL;
      expMult = dungeonInstance.dungeon.expMultiplier * multiplier.exp;
      goldMult = dungeonInstance.dungeon.goldMultiplier * multiplier.gold;
      itemMult = dungeonInstance.dungeon.itemDropMultiplier * multiplier.item;
    } else {
      // 레이드 인스턴스 확인
      const raidInstance = await (this.prisma as any).raidInstance.findFirst({
        where: {
          partyId: encounter.partyId,
          status: 'ACTIVE',
        },
        include: { raid: true },
      });

      if (raidInstance) {
        expMult = raidInstance.raid.expMultiplier;
        goldMult = raidInstance.raid.goldMultiplier;
        itemMult = raidInstance.raid.itemDropMultiplier;
      } else {
        // 보스 멀티플라이 체크
        const bossSpawn = this.bossService.getSpawnByRoom(encounter.roomId);
        if (bossSpawn && encounter.isBoss) {
          expMult = bossSpawn.reward.expMult;
          goldMult = bossSpawn.reward.goldMult;
          // 보스 킬 기록
          this.bossService.markBossKilled(encounter.roomId);
        }
      }
    }

    // 기본 보상 (고정값)
    let baseExp = 50;
    let baseGold = 20;

    // 보스 멀티플라이 적용
    baseExp = Math.floor(baseExp * expMult);
    baseGold = Math.floor(baseGold * goldMult);

    // 보스 보장 보상 아이템 (트로피) 추출
    const bossGuaranteedItems: Array<{ itemId: string; qty: number }> = [];
    const bossSpawnCheck = this.bossService.getSpawnByRoom(encounter.roomId);
    if (bossSpawnCheck && encounter.isBoss && bossSpawnCheck.rewardItemsGuaranteed) {
          for (const rewardItem of bossSpawnCheck.rewardItemsGuaranteed) {
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

    // 몬스터 ID 추출 (도감 업데이트용)
    const state = JSON.parse((encounter as any).stateString || '{}') as any;
    const currentMonsterId = state?.enemies?.[0]?.id;

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

        // 길드 버프 적용
        let guildExpBonus = 0;
        let guildGoldBonus = 0;
        try {
          const guildMember = await (tx as any).guildMember.findUnique({
            where: { characterId: character.id },
            include: { guild: { include: { buff: true } } },
          });
          if (guildMember?.guild?.buff) {
            const buff = guildMember.guild.buff;
            guildExpBonus = Math.floor(finalExp * (buff.expBonus || 0) / 100);
            guildGoldBonus = Math.floor(baseGold * (buff.goldBonus || 0) / 100);
            finalExp += guildExpBonus;
          }
        } catch {
          // 길드 버프 조회 실패는 무시
        }
        
        // 경험치/골드 지급
        let newExp = character.exp + finalExp;
        const newGold = character.gold + baseGold + guildGoldBonus;

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

        // 도감 업데이트 (몬스터 처치 기록)
        if (currentMonsterId) {
          const existing = await (tx as any).bestiary.findUnique({
            where: {
              characterId_monsterId: {
                characterId: character.id,
                monsterId: currentMonsterId,
              },
            },
          });

          if (existing) {
            await (tx as any).bestiary.update({
              where: {
                characterId_monsterId: {
                  characterId: character.id,
                  monsterId: currentMonsterId,
                },
              },
              data: {
                killCount: { increment: 1 },
                lastKillAt: new Date(),
              },
            });
          } else {
            await (tx as any).bestiary.create({
              data: {
                characterId: character.id,
                monsterId: currentMonsterId,
                killCount: 1,
                firstKillAt: new Date(),
                lastKillAt: new Date(),
              },
            });
          }
        }

        // 드랍 처리: 이제 인벤토리에 즉시 지급하지 않고 "바닥 아이템(RoomGroundItem)"으로 떨어뜨린다.
        // 파티 전체에 대해 1회만 생성 (첫 번째 멤버 기준)
        const droppedItems: Array<{ itemId: string; qty: number }> = [];
        const isFirstMember = member === encounter.party.members[0];

        if (isFirstMember) {
          // 보스 보장 보상
        if (bossGuaranteedItems.length > 0) {
          for (const guaranteedItem of bossGuaranteedItems) {
              await (tx as any).roomGroundItem.upsert({
                where: { roomId_itemId: { roomId: encounter.roomId, itemId: guaranteedItem.itemId } },
                create: { roomId: encounter.roomId, itemId: guaranteedItem.itemId, qty: guaranteedItem.qty },
                update: { qty: { increment: guaranteedItem.qty } },
            });
            droppedItems.push(guaranteedItem);
          }
        }

        if (monster.drops && monster.drops.length > 0) {
          for (const drop of monster.drops) {
            if (rollChance(drop.chanceBp)) {
              const qty = randomInt(drop.minQty, drop.maxQty);
                await (tx as any).roomGroundItem.upsert({
                  where: { roomId_itemId: { roomId: encounter.roomId, itemId: drop.itemId } },
                  create: { roomId: encounter.roomId, itemId: drop.itemId, qty },
                  update: { qty: { increment: qty } },
              });
                droppedItems.push({ itemId: drop.itemId, qty });
            }
          }
        } else {
            // fallback: 드랍 테이블이 비어있으면 기본 소비 아이템 1개를 바닥에 드랍
            const defaultItem = await tx.item.findFirst({ where: { type: 'consumable' } });
          if (defaultItem) {
              await (tx as any).roomGroundItem.upsert({
                where: { roomId_itemId: { roomId: encounter.roomId, itemId: defaultItem.id } },
                create: { roomId: encounter.roomId, itemId: defaultItem.id, qty: 1 },
                update: { qty: { increment: 1 } },
            });
              droppedItems.push({ itemId: defaultItem.id, qty: 1 });
            }
          }
        }

        // 첫 번째 멤버의 보상만 반환 (파티 전체는 동일)
        if (member === encounter.party.members[0]) {
          rewards.expGained = finalExp;
          rewards.goldGained = baseGold;
          rewards.items = droppedItems;
        }

        // 길드 경험치 추가 (몬스터 처치 시)
        await this.addGuildExp(character.id, finalExp);

        // 길드 퀘스트 진행도 업데이트 (몬스터 처치)
        // WsGateway의 updateGuildQuestProgress를 호출하기 위해 이벤트 발행 또는 직접 호출
        // 여기서는 간단히 처리 (실제로는 이벤트 시스템 사용 권장)
        try {
          const guildMember = await (tx as any).guildMember.findUnique({
            where: { characterId: character.id },
            include: { guild: { include: { quests: true } } },
          });
          if (guildMember) {
            const activeQuests = (guildMember.guild.quests || []).filter((q: any) => q.status === 'ACTIVE');
            for (const quest of activeQuests) {
              if (quest.questId.includes('kill') || quest.questId.includes('monster')) {
                const newProgress = Math.min(quest.progress + 1, quest.target);
                await (tx as any).guildQuest.update({
                  where: { id: quest.id },
                  data: { progress: newProgress },
                });
              }
            }
          }
        } catch {
          // 길드 퀘스트 업데이트 실패는 무시
        }
      });
    }
    
    // 파티 보너스 적용 로그
    if (partyBonusApplied) {
      console.log(`[PARTY] 파티 보너스 적용: +${this.balance.partyExpBonusPct}% EXP (${baseExp} -> ${Math.floor(baseExp * (1 + this.balance.partyExpBonusPct / 100))})`);
    }

    return rewards;
  }

  // 길드 경험치 추가
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
      }
    } catch (e: any) {
      // 길드 경험치 추가 실패는 조용히 처리
      console.error(`[GUILD] 경험치 추가 실패: characterId=${characterId}, error=${e?.message}`);
    }
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

  async checkDungeonRaidProgress(partyId: string, roomId: string, isBoss: boolean) {
    try {
      // 던전 인스턴스 확인
      const dungeonInstance = await (this.prisma as any).dungeonInstance.findFirst({
        where: {
          partyId,
          status: 'ACTIVE',
        },
        include: { dungeon: true },
      });

      if (dungeonInstance) {
        const clearedRooms = JSON.parse(dungeonInstance.clearedRooms || '[]') as string[];
        if (!clearedRooms.includes(roomId)) {
          clearedRooms.push(roomId);
        }

        // 모든 방 클리어 체크
        const allCleared = clearedRooms.length >= dungeonInstance.dungeon.roomCount;
        
        if (allCleared) {
          await (this.prisma as any).dungeonInstance.update({
            where: { id: dungeonInstance.id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
              clearedRooms: JSON.stringify(clearedRooms),
            },
          });

          // 던전 완료 보상 지급
          await this.grantDungeonCompletionRewards(dungeonInstance, partyId);
        } else {
          await (this.prisma as any).dungeonInstance.update({
            where: { id: dungeonInstance.id },
            data: { clearedRooms: JSON.stringify(clearedRooms) },
          });
        }
      } else {
        // 레이드 인스턴스 확인
        const raidInstance = await (this.prisma as any).raidInstance.findFirst({
          where: {
            partyId,
            status: 'ACTIVE',
          },
          include: { raid: true },
        });

        if (raidInstance) {
          const clearedRooms = JSON.parse(raidInstance.clearedRooms || '[]') as string[];
          if (!clearedRooms.includes(roomId)) {
            clearedRooms.push(roomId);
          }

          // 보스 처치 추적
          if (isBoss) {
            const defeatedBosses = (raidInstance.defeatedBosses || '').split(',').filter(Boolean);
            if (!defeatedBosses.includes(roomId)) {
              defeatedBosses.push(roomId);
            }

            // 모든 보스 처치 및 방 클리어 체크
            const allBossesDefeated = defeatedBosses.length >= raidInstance.raid.bossCount;
            const allCleared = clearedRooms.length >= raidInstance.raid.roomCount;

            if (allBossesDefeated && allCleared) {
              await (this.prisma as any).raidInstance.update({
                where: { id: raidInstance.id },
                data: {
                  status: 'COMPLETED',
                  completedAt: new Date(),
                  clearedRooms: JSON.stringify(clearedRooms),
                  defeatedBosses: defeatedBosses.join(','),
                },
              });

              // 레이드 완료 보상 지급
              await this.grantRaidCompletionRewards(raidInstance, partyId);
            } else {
              await (this.prisma as any).raidInstance.update({
                where: { id: raidInstance.id },
                data: {
                  clearedRooms: JSON.stringify(clearedRooms),
                  defeatedBosses: defeatedBosses.join(','),
                },
              });
            }
          } else {
            await (this.prisma as any).raidInstance.update({
              where: { id: raidInstance.id },
              data: { clearedRooms: JSON.stringify(clearedRooms) },
            });
          }
        }
      }
    } catch (error) {
      console.error('[CombatService] 던전/레이드 진행 체크 실패:', error);
    }
  }

  private async grantDungeonCompletionRewards(dungeonInstance: any, partyId: string) {
    try {
      const party = await this.prisma.party.findUnique({
        where: { id: partyId },
        include: { members: { include: { character: true } } },
      });

      if (!party) return;

      const difficultyMultipliers: Record<string, number> = {
        EASY: 0.8,
        NORMAL: 1.0,
        HARD: 1.5,
        NIGHTMARE: 2.5,
      };

      const multiplier = difficultyMultipliers[dungeonInstance.difficulty] || 1.0;
      const bonusExp = Math.floor(100 * multiplier);
      const bonusGold = Math.floor(50 * multiplier);

      for (const member of party.members) {
        await this.prisma.character.update({
          where: { id: member.characterId },
          data: {
            exp: { increment: bonusExp },
            gold: { increment: bonusGold },
          },
        });

        // 랭킹 업데이트
        await (this.prisma as any).dungeonRanking.upsert({
          where: { characterId: member.characterId },
          create: {
            characterId: member.characterId,
            dungeonId: dungeonInstance.dungeonId,
            difficulty: dungeonInstance.difficulty,
            clearCount: 1,
            totalExp: bonusExp,
            totalGold: bonusGold,
          },
          update: {
            clearCount: { increment: 1 },
            totalExp: { increment: bonusExp },
            totalGold: { increment: bonusGold },
          },
        });
      }
    } catch (error) {
      console.error('[CombatService] 던전 완료 보상 지급 실패:', error);
    }
  }

  private async grantRaidCompletionRewards(raidInstance: any, partyId: string) {
    try {
      const party = await this.prisma.party.findUnique({
        where: { id: partyId },
        include: { members: { include: { character: true } } },
      });

      if (!party) return;

      const bonusExp = 500;
      const bonusGold = 200;

      for (const member of party.members) {
        await this.prisma.character.update({
          where: { id: member.characterId },
          data: {
            exp: { increment: bonusExp },
            gold: { increment: bonusGold },
          },
        });

        // 랭킹 업데이트
        await (this.prisma as any).raidRanking.upsert({
          where: { characterId_raidId: { characterId: member.characterId, raidId: raidInstance.raidId } },
          create: {
            characterId: member.characterId,
            raidId: raidInstance.raidId,
            clearCount: 1,
            totalExp: bonusExp,
            totalGold: bonusGold,
          },
          update: {
            clearCount: { increment: 1 },
            totalExp: { increment: bonusExp },
            totalGold: { increment: bonusGold },
          },
        });
      }
    } catch (error) {
      console.error('[CombatService] 레이드 완료 보상 지급 실패:', error);
    }
  }
}

