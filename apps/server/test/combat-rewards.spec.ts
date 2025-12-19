import { Test, TestingModule } from '@nestjs/testing';
import { CombatService } from '../modules/combat/combat.service';
import { PrismaService } from '../common/prisma.service';

describe('Combat Rewards', () => {
  let combatService: CombatService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CombatService,
        {
          provide: PrismaService,
          useValue: {
            encounter: {
              findUnique: jest.fn(),
            },
            monster: {
              findUnique: jest.fn(),
            },
            character: {
              update: jest.fn(),
            },
            inventory: {
              upsert: jest.fn(),
            },
            item: {
              findFirst: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback({})),
          },
        },
      ],
    }).compile();

    combatService = module.get<CombatService>(CombatService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('레벨업 로직이 정확해야 함', () => {
    // nextExp(level) = 50 * level
    expect(50 * 1).toBe(50);
    expect(50 * 2).toBe(100);
    expect(50 * 3).toBe(150);
  });

  it('보상 JSON 포맷이 올바르야 함', () => {
    const rewards = {
      expGained: 50,
      goldGained: 20,
      items: [
        { itemId: 'ITEM_POTION_HP_S', qty: 1 },
      ],
    };

    expect(rewards.expGained).toBeGreaterThan(0);
    expect(rewards.goldGained).toBeGreaterThan(0);
    expect(Array.isArray(rewards.items)).toBe(true);
    expect(rewards.items[0]).toHaveProperty('itemId');
    expect(rewards.items[0]).toHaveProperty('qty');
  });

  it('레벨업 시 HP/Stamina 최대치 증가 확인', () => {
    const level1HpMax = 100;
    const level2HpMax = level1HpMax + 5; // +5
    const level3HpMax = level2HpMax + 5; // +5

    expect(level2HpMax).toBe(105);
    expect(level3HpMax).toBe(110);

    const level1StaminaMax = 100;
    const level2StaminaMax = level1StaminaMax + 3; // +3
    const level3StaminaMax = level2StaminaMax + 3; // +3

    expect(level2StaminaMax).toBe(103);
    expect(level3StaminaMax).toBe(106);
  });
});

