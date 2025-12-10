// src/auth/validation/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    
    // 🔥 FORZAR TOKEN DESDE COOKIES SI NO HAY EN HEADER
    if (!request.headers.authorization) {
      const token = request.cookies?.access_token;
      if (token) {
        request.headers.authorization = `Bearer ${token}`;
      }
    }
    
    return super.canActivate(context);
  }
}