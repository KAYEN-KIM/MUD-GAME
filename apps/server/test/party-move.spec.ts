import { Test, TestingModule } from '@nestjs/testing';
import { PartyService } from '../modules/party/party.service';
import { WorldService } from '../modules/world/world.service';
import { PrismaService } from '../common/prisma.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';

describe('Party Move', () => {
  let partyService: PartyService;
  let worldService: WorldService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartyService,
        WorldService,
        {
          provide: PrismaService,
          useValue: {
            character: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            partyMember: {
              findFirst: jest.fn(),
            },
            party: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: RateLimitService,
          useValue: {
            checkMoveRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
          },
        },
      ],
    }).compile();

    partyService = module.get<PartyService>(PartyService);
    worldService = module.get<WorldService>(WorldService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('리더 이동 시 follow=true 멤버가 따라가야 함', async () => {
    const leaderId = 'leader1';
    const followerId = 'follower1';

    (prisma.character.findUnique as jest.Mock).mockResolvedValue({
      id: leaderId,
      roomId: 'GH_GATE',
      room: {
        exitsFrom: [{ toRoomId: 'GH_MARKET', label: '시장으로' }],
      },
    });

    (prisma.partyMember.findFirst as jest.Mock).mockResolvedValue({
      characterId: leaderId,
      party: {
        leaderCharacterId: leaderId,
        members: [
          { characterId: leaderId, follow: true },
          { characterId: followerId, follow: true, character: { id: followerId } },
        ],
      },
    });

    await worldService.move(leaderId, 'GH_MARKET');

    expect(prisma.character.update).toHaveBeenCalledWith({
      where: { id: leaderId },
      data: { roomId: 'GH_MARKET' },
    });

    expect(prisma.character.update).toHaveBeenCalledWith({
      where: { id: followerId },
      data: { roomId: 'GH_MARKET' },
    });
  });

  it('follow=false 멤버는 이동하지 않아야 함', async () => {
    const leaderId = 'leader1';
    const nonFollowerId = 'nonfollower1';

    (prisma.character.findUnique as jest.Mock).mockResolvedValue({
      id: leaderId,
      roomId: 'GH_GATE',
      room: {
        exitsFrom: [{ toRoomId: 'GH_MARKET', label: '시장으로' }],
      },
    });

    (prisma.partyMember.findFirst as jest.Mock).mockResolvedValue({
      characterId: leaderId,
      party: {
        leaderCharacterId: leaderId,
        members: [
          { characterId: leaderId, follow: true },
          { characterId: nonFollowerId, follow: false, character: { id: nonFollowerId } },
        ],
      },
    });

    await worldService.move(leaderId, 'GH_MARKET');

    const updateCalls = (prisma.character.update as jest.Mock).mock.calls;
    const nonFollowerUpdate = updateCalls.find((call) => call[0].where.id === nonFollowerId);

    expect(nonFollowerUpdate).toBeUndefined();
  });
});

