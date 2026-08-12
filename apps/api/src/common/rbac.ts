/**
 * RBAC — mirrors packages/types (kept in sync intentionally so the API image
 * needs no monorepo build context). V1 reads the role from the `x-role` header;
 * V2 replaces this with Keycloak/OIDC token claims.
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export type Role = 'administrator' | 'editor' | 'contributor' | 'viewer';
export type Permission =
  | 'plot:view' | 'plot:attr:update' | 'plot:rename' | 'plot:geometry:update'
  | 'plot:create' | 'plot:delete' | 'doc:manage' | 'opportunity:manage'
  | 'admin:optionlists' | 'admin:users' | 'audit:view' | 'settings:manage' | 'export:view';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  administrator: [
    'plot:view','plot:attr:update','plot:rename','plot:geometry:update','plot:create','plot:delete',
    'doc:manage','opportunity:manage','admin:optionlists','admin:users','audit:view','settings:manage','export:view',
  ],
  editor: ['plot:view','plot:attr:update','plot:rename','plot:geometry:update','plot:create','doc:manage','opportunity:manage','audit:view','export:view'],
  contributor: ['plot:view','plot:attr:update','doc:manage','opportunity:manage','export:view'],
  viewer: ['plot:view','export:view'],
};

export function can(role: Role, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export const PERMISSION_KEY = 'permission';
export const RequirePermission = (p: Permission) => SetMetadata(PERMISSION_KEY, p);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.get<Permission>(PERMISSION_KEY, ctx.getHandler());
    if (!required) return true;
    const req = ctx.switchToHttp().getRequest();
    const role = (req.headers['x-role'] as Role) || 'viewer';
    if (!can(role, required)) throw new ForbiddenException(`role '${role}' lacks '${required}'`);
    req.role = role;
    return true;
  }
}
