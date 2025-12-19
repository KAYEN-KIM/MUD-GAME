import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ReportResult {
  success: boolean;
  reportId?: string;
  error?: string;
}

export async function createReport(
  reporterUserId: string,
  reportedCharacterId: string | null,
  reportedMessageId: string | null,
  reason: string
): Promise<ReportResult> {
  if (!reason || reason.trim().length === 0) {
    return {
      success: false,
      error: '신고 사유를 입력해주세요.'
    };
  }

  // 유저 확인
  const user = await prisma.user.findUnique({
    where: { id: reporterUserId }
  });

  if (!user) {
    return {
      success: false,
      error: '유저를 찾을 수 없습니다.'
    };
  }

  // 신고 생성
  const report = await prisma.report.create({
    data: {
      reporterId: reporterUserId,
      reportedCharacterId,
      reportedMessageId,
      reason,
      status: 'PENDING'
    }
  });

  return {
    success: true,
    reportId: report.id
  };
}

