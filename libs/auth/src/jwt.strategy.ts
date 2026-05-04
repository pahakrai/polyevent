import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '@polydom/shared-types';

export interface JwtUser {
  sub: string;
  email: string;
  role: string;
  permissions: string[];
  vendorId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(secretOrKey: string) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions ?? [],
      vendorId: payload.vendorId,
    };
  }
}
