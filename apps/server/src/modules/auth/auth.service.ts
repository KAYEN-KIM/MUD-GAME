import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { RegisterDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    // 이메일 중복 확인
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
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
        email: dto.email,
        passwordHash,
        characters: {
          create: {
            name: dto.characterName,
            roomId: 'GH_GATE', // 시작 위치
          },
        },
      },
      include: {
        characters: true,
      },
    });

    const character = user.characters[0];

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
    // 유저 찾기
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
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

