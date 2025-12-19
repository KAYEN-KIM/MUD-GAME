import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { RedisService } from '../common/redis.service';

describe('RateLimitService', () => {
  let service: RateLimitService;
  let redisService: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue({
              incr: jest.fn(),
              expire: jest.fn(),
              ttl: jest.fn(),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
    redisService = module.get<RedisService>(RedisService);
  });

  it('레이트 리밋이 정상 동작해야 함', async () => {
    const client = redisService.getClient();
    (client.incr as jest.Mock).mockResolvedValue(1);
    (client.ttl as jest.Mock).mockResolvedValue(1);

    const result = await service.checkChatRateLimit('char1');

    expect(result.allowed).toBe(true);
    expect(client.incr).toHaveBeenCalled();
  });

  it('레이트 리밋 초과 시 차단되어야 함', async () => {
    const client = redisService.getClient();
    (client.incr as jest.Mock).mockResolvedValue(100);
    (client.ttl as jest.Mock).mockResolvedValue(1);

    const result = await service.checkChatRateLimit('char1');

    expect(result.allowed).toBe(false);
  });
});

