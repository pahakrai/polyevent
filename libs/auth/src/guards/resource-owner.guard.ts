import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const RESOURCE_CHECK = 'resource_check';

/**
 * Decorator for methods that need resource ownership validation.
 * - 'vendor:self'  — compares req.user.sub to :userId param (for /vendors/user/:userId)
 * - 'vendor:id'    — compares req.user.vendorId to :id param (for /vendors/:id)
 * ADMIN role always bypasses ownership checks.
 */
export const ResourceOwner = (checkType: string) =>
  SetMetadata(RESOURCE_CHECK, checkType);

@Injectable()
export class ResourceOwnerGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const checkType = this.reflector.get<string>(RESOURCE_CHECK, context.getHandler());
    if (!checkType) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;

    if (user.role === 'ADMIN') return true;

    switch (checkType) {
      case 'vendor:self':
        return user.sub === request.params.userId;

      case 'vendor:id':
        return user.vendorId === request.params.id;

      default:
        return false;
    }
  }
}
