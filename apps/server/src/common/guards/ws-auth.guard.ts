import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../modules/auth/auth.service';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const data = context.switchToWs().getData();

    // AUTH 이벤트는 통과
    if (data.t === 'AUTH') {
      return true;
    }

    // 인증 확인
    if (!client.userId || !client.characterId) {
      throw new UnauthorizedException('인증이 필요합니다.');
    }

    return true;
  }
}

