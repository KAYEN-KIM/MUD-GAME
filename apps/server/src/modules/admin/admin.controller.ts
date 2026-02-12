import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from '../../common/guards/admin.guard';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('reports')
  async getReports() {
    return this.adminService.getReports();
  }

  @Post('punishments')
  async createPunishment(
    @Body()
    body: {
      targetName: string;
      type: 'MUTE' | 'BAN';
      untilAt?: string;
      note: string;
    },
  ) {
    const untilAt = body.untilAt ? new Date(body.untilAt) : null;
    return this.adminService.createPunishment(body.targetName, body.type, untilAt, body.note);
  }

  @Delete('punishments/:id')
  async deletePunishment(@Param('id') id: string) {
    await this.adminService.deletePunishment(id);
    return { success: true };
  }

  @Get('characters')
  async searchCharacters(@Query('name') name: string) {
    if (!name) {
      return [];
    }
    return this.adminService.searchCharacters(name);
  }

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('logs')
  async getAdminLogs(@Query('limit') limit?: string) {
    return this.adminService.getAdminLogs(limit ? parseInt(limit) : 100);
  }

  @Get('game-stats/:key')
  async getGameStats(@Param('key') key: string, @Query('limit') limit?: string) {
    return this.adminService.getGameStats(key, limit ? parseInt(limit) : 100);
  }

  @Post('game-stats')
  async recordGameStat(@Body() body: { key: string; value: any }) {
    return this.adminService.recordGameStat(body.key, body.value);
  }
}

