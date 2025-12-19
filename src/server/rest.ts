import express from 'express';
import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from '../utils/bcrypt';
import { signToken } from '../utils/jwt';

const prisma = new PrismaClient();
const router = express.Router();

// 회원가입
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, characterName } = req.body;

    if (!email || !password || !characterName) {
      return res.status(400).json({
        error: '이메일, 비밀번호, 캐릭터 이름이 필요합니다.'
      });
    }

    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        error: '이미 사용 중인 이메일입니다.'
      });
    }

    // 캐릭터 이름 중복 확인
    const existingCharacter = await prisma.character.findUnique({
      where: { name: characterName }
    });

    if (existingCharacter) {
      return res.status(400).json({
        error: '이미 사용 중인 캐릭터 이름입니다.'
      });
    }

    // 비밀번호 해시
    const hashedPassword = await hashPassword(password);

    // 시작 룸 찾기 (도시 첫 번째 룸)
    const startRoom = await prisma.room.findUnique({
      where: { id: 'GH_00' }
    });

    if (!startRoom) {
      return res.status(500).json({
        error: '시작 룸을 찾을 수 없습니다.'
      });
    }

    // 유저 및 캐릭터 생성
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        characters: {
          create: {
            name: characterName,
            currentRoomId: startRoom.id
          }
        }
      },
      include: {
        characters: true
      }
    });

    const character = user.characters[0];

    // JWT 토큰 생성
    const token = signToken({
      userId: user.id,
      characterId: character.id
    });

    res.json({
      token,
      character: {
        id: character.id,
        name: character.name
      }
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({
      error: error.message || '회원가입 중 오류가 발생했습니다.'
    });
  }
});

// 로그인
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: '이메일과 비밀번호가 필요합니다.'
      });
    }

    // 유저 찾기
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        characters: {
          take: 1
        }
      }
    });

    if (!user) {
      return res.status(401).json({
        error: '이메일 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    // 비밀번호 확인
    const passwordMatch = await comparePassword(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({
        error: '이메일 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    if (user.characters.length === 0) {
      return res.status(400).json({
        error: '캐릭터가 없습니다.'
      });
    }

    const character = user.characters[0];

    // JWT 토큰 생성
    const token = signToken({
      userId: user.id,
      characterId: character.id
    });

    res.json({
      token,
      character: {
        id: character.id,
        name: character.name
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      error: error.message || '로그인 중 오류가 발생했습니다.'
    });
  }
});

// 관리자 미들웨어
function adminMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const adminKey = req.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_KEY || 'change-this-admin-key';

  if (adminKey !== expectedKey) {
    return res.status(403).json({
      error: '관리자 권한이 필요합니다.'
    });
  }

  next();
}

// 신고 목록 조회
router.get('/admin/reports', adminMiddleware, async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        },
        character: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(reports);
  } catch (error: any) {
    console.error('Get reports error:', error);
    res.status(500).json({
      error: error.message || '신고 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// 제재 생성
router.post('/admin/punishments', adminMiddleware, async (req, res) => {
  try {
    const { userId, characterId, type, reason, duration } = req.body;

    if (!userId || !type || !reason) {
      return res.status(400).json({
        error: 'userId, type, reason이 필요합니다.'
      });
    }

    // 관리자 ID는 헤더에서 가져오거나 세션에서 가져와야 함
    // MVP에서는 임시로 첫 번째 유저를 관리자로 사용
    const adminUser = await prisma.user.findFirst();
    if (!adminUser) {
      return res.status(500).json({
        error: '관리자 유저를 찾을 수 없습니다.'
      });
    }

    const expiresAt = duration ? new Date(Date.now() + duration * 1000) : null;

    const punishment = await prisma.punishment.create({
      data: {
        userId,
        characterId,
        type,
        reason,
        duration,
        expiresAt,
        adminId: adminUser.id
      }
    });

    res.json(punishment);
  } catch (error: any) {
    console.error('Create punishment error:', error);
    res.status(500).json({
      error: error.message || '제재 생성 중 오류가 발생했습니다.'
    });
  }
});

// 제재 삭제
router.delete('/admin/punishments/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.punishment.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete punishment error:', error);
    res.status(500).json({
      error: error.message || '제재 삭제 중 오류가 발생했습니다.'
    });
  }
});

// 캐릭터 검색
router.get('/admin/characters', adminMiddleware, async (req, res) => {
  try {
    const { name } = req.query;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'name 쿼리 파라미터가 필요합니다.'
      });
    }

    const characters = await prisma.character.findMany({
      where: {
        name: {
          contains: name,
          mode: 'insensitive'
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      },
      take: 20
    });

    res.json(characters);
  } catch (error: any) {
    console.error('Search characters error:', error);
    res.status(500).json({
      error: error.message || '캐릭터 검색 중 오류가 발생했습니다.'
    });
  }
});

export default router;

