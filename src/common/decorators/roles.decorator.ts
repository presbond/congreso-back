import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'allowedRoles';
/**
 * Acepta NOMBRES de type_user (p.ej. 'Admin') o IDs numéricos (p.ej. 99).
 * Ej: @Roles('Admin')  o  @Roles(99)
 */
export const Roles = (...roles: (string | number)[]) => SetMetadata(ROLES_KEY, roles);
