import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from '../modules/chat/chat.service';
import { PrismaService } from '../common/prisma.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';

describe('Chat Mute', () => {
  let chatService: ChatService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: PrismaService,
          useValue: {
            character: {
              findUnique: jest.fn(),
            },
            punishment: {
              findFirst: jest.fn(),
            },
            chatMessage: {
              create: jest.fn(),
            },
            partyMember: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: RateLimitService,
          useValue: {
            checkChatRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
          },
        },
      ],
    }).compile();

    chatService = module.get<ChatService>(ChatService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('MUTE 상태일 때 채팅이 차단되어야 함', async () => {
    (prisma.character.findUnique as jest.Mock).mockResolvedValue({
      id: 'char1',
      name: 'TestChar',
      roomId: 'GH_GATE',
    });

    (prisma.punishment.findFirst as jest.Mock).mockResolvedValue({
      id: 'pun1',
      targetName: 'TestChar',
      type: 'MUTE',
      note: '욕설 사용',
      untilAt: new Date(Date.now() + 100000),
    });

    await expect(chatService.sendChat('char1', 'GLOBAL', 'Hello')).rejects.toThrow(
      '채팅이 금지되었습니다',
    );

    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it('MUTE가 아닐 때 채팅이 허용되어야 함', async () => {
    (prisma.character.findUnique as jest.Mock).mockResolvedValue({
      id: 'char1',
      name: 'TestChar',
      roomId: 'GH_GATE',
    });

    (prisma.punishment.findFirst as jest.Mock).mockResolvedValue(null);

    (prisma.chatMessage.create as jest.Mock).mockResolvedValue({
      id: 'msg1',
      channel: 'GLOBAL',
      text: 'Hello',
    });

    await chatService.sendChat('char1', 'GLOBAL', 'Hello');

    expect(prisma.chatMessage.create).toHaveBeenCalled();
  });
});

