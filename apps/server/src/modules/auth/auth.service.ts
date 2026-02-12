import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { RegisterDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const email = (dto.email || '').trim().toLowerCase();
    // 이메일 중복 확인
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('이미 사용 중인 이메일입니다.');
    }

    // 캐릭터 이름 중복 확인
    const existingCharacter = await this.prisma.character.findUnique({
      where: { name: dto.characterName },
    });

    if (existingCharacter) {
      throw new BadRequestException('이미 사용 중인 캐릭터 이름입니다.');
    }

    // 비밀번호 해싱
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 유저 및 캐릭터 생성
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        characters: {
          create: {
            name: dto.characterName,
            roomId: 'START_TOWN', // 시작 위치 (시드에서 생성되는 첫 번째 룸)
            hp: 200,
            hpMax: 200,
            mp: 200, // intStat * 10 (기본값: 20 * 10 = 200)
            mpMax: 200,
            str: 20,
            dex: 20,
            intStat: 20,
            gold: 1000,
          },
        },
      },
      include: {
        characters: true,
      },
    });

    const character = user.characters[0];

    // 스타터 장비/아이템 지급 (UX: 처음 접속 시 확인할 것이 있도록)
    // - 무기 1개(WEAPON) + 갑옷 1개(BODY) 자동 장착
    // - HP/MP 포션 소량 지급
    await this.prisma.$transaction(async (tx) => {
      const DEFAULT_WEAPON_ID = 'ITEM_SWORD_IRON';
      const DEFAULT_ARMOR_ID = 'ITEM_ARMOR_CLOTH';
      const DEFAULT_HP_POTION_ID = 'ITEM_POTION_HP_S';
      const DEFAULT_MP_POTION_ID = 'ITEM_MP_POTION';

      const wantedIds = [
        DEFAULT_WEAPON_ID,
        DEFAULT_ARMOR_ID,
        DEFAULT_HP_POTION_ID,
        DEFAULT_MP_POTION_ID,
      ];

      const found = await tx.item.findMany({
        where: { id: { in: wantedIds } },
      });
      const map = new Map(found.map((i) => [i.id, i]));

      const weapon =
        map.get(DEFAULT_WEAPON_ID) ||
        (await tx.item.findFirst({
          where: { type: 'weapon', slot: 'WEAPON' },
          orderBy: { priceBuy: 'asc' },
        }));

      const armor =
        map.get(DEFAULT_ARMOR_ID) ||
        (await tx.item.findFirst({
          where: { type: 'armor', slot: 'BODY' },
          orderBy: { priceBuy: 'asc' },
        }));

      const hpPotion = map.get(DEFAULT_HP_POTION_ID);
      const mpPotion = map.get(DEFAULT_MP_POTION_ID);

      const giveInventory = async (itemId: string, qty: number) => {
        await tx.inventory.upsert({
          where: {
            characterId_itemId: {
              characterId: character.id,
              itemId,
            },
          },
          create: { characterId: character.id, itemId, qty },
          update: { qty: { increment: qty } },
        });
      };

      if (weapon) {
        await giveInventory(weapon.id, 1);
        await tx.equipment.upsert({
          where: {
            characterId_slot: {
              characterId: character.id,
              slot: weapon.slot || 'WEAPON',
            },
          },
          create: {
            characterId: character.id,
            slot: weapon.slot || 'WEAPON',
            itemId: weapon.id,
          },
          update: { itemId: weapon.id },
        });
      }

      if (armor) {
        await giveInventory(armor.id, 1);
        await tx.equipment.upsert({
          where: {
            characterId_slot: {
              characterId: character.id,
              slot: armor.slot || 'BODY',
            },
          },
          create: {
            characterId: character.id,
            slot: armor.slot || 'BODY',
            itemId: armor.id,
          },
          update: { itemId: armor.id },
        });
      }

      if (hpPotion) await giveInventory(hpPotion.id, 3);
      if (mpPotion) await giveInventory(mpPotion.id, 2);
    });

    // JWT 토큰 생성
    const token = this.generateToken(user.id, character.id);

    return {
      token,
      character: {
        id: character.id,
        name: character.name,
      },
    };
  }

  async login(dto: LoginDto) {
    const email = (dto.email || '').trim().toLowerCase();
    // 유저 찾기
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        characters: {
          take: 1,
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    // 비밀번호 확인
    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    if (user.characters.length === 0) {
      throw new BadRequestException('캐릭터가 없습니다.');
    }

    const character = user.characters[0];

    // BAN 확인
    const punishment = await this.prisma.punishment.findFirst({
      where: {
        targetName: character.name,
        type: 'BAN',
        OR: [{ untilAt: null }, { untilAt: { gt: new Date() } }],
      },
    });

    if (punishment) {
      throw new UnauthorizedException(
        `계정이 정지되었습니다. 사유: ${punishment.note}`,
      );
    }

    // JWT 토큰 생성
    const token = this.generateToken(user.id, character.id);

    return {
      token,
      character: {
        id: character.id,
        name: character.name,
      },
    };
  }

  generateToken(userId: string, characterId: string): string {
    const secret = process.env.JWT_SECRET || 'change-me';
    return jwt.sign({ userId, characterId }, secret, {
      expiresIn: '7d',
    });
  }

  verifyToken(token: string): { userId: string; characterId: string } | null {
    try {
      const secret = process.env.JWT_SECRET || 'change-me';
      const decoded = jwt.verify(token, secret) as {
        userId: string;
        characterId: string;
      };
      return decoded;
    } catch {
      return null;
    }
  }
}

