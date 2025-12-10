import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '@prisma/prisma.service';

/**
 * Valida que el usuario autenticado pertenezca a un type_user permitido.
 * Funciona con NOMBRES (name_type) o IDs (type_user_id).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const allowed = this.reflector.getAllAndOverride<(string | number)[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!allowed?.length) return true;

    const req = ctx.switchToHttp().getRequest();
    // JwtAuthGuard debe haber puesto req.user.userId
    const uid = req?.user?.userId;
    if (!uid) return false;

    const user = await this.prisma.users.findUnique({
      where: { user_id: BigInt(uid) },
      select: { type_user_id: true, type_user: { select: { name_type: true } } },
    });
    if (!user) return false;

    const name = user.type_user?.name_type?.trim();
    const id = Number(user.type_user_id);

    return allowed.some(a => {
      if (typeof a === 'number') return a === id;
      return a.toLowerCase() === (name || '').toLowerCase();
    });
  }
}
