import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getReports() {
    return this.prisma.report.findMany({
      include: {
        reporterCharacter: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });
  }

  async createPunishment(targetName: string, type: 'MUTE' | 'BAN', untilAt: Date | null, note: string) {
    return this.prisma.punishment.create({
      data: {
        targetName,
        type,
        untilAt,
        note,
      },
    });
  }

  async deletePunishment(id: string) {
    await this.prisma.punishment.delete({
      where: { id },
    });
  }

  async searchCharacters(name: string) {
    return this.prisma.character.findMany({
      where: {
        name: {
          contains: name,
          mode: 'insensitive',
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      take: 20,
    });
  }
}

