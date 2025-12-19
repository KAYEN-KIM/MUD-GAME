import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const adminKey = request.headers['x-admin-key'];
    const expectedKey = process.env.ADMIN_KEY || 'change-me';

    if (adminKey !== expectedKey) {
      throw new ForbiddenException('관리자 권한이 필요합니다.');
    }

    return true;
  }
}

