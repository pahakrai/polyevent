import {
  Injectable,
  Optional,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { db } from '../database/client';
import { users } from '../database/schema';
import { eq } from 'drizzle-orm';
import { BaseProducer, USER_ACTIVITY_TOPIC, UserActivityMessage } from '@polydom/kafka-client';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SagaExecutor } from './saga-executor';
import {
  SagaContext,
  SagaStep,
  ROLE_PERMISSIONS,
  JwtPayload,
} from '@polydom/shared-types';
import { firstValueFrom } from 'rxjs';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly sagaExecutor: SagaExecutor,
    @Optional() private readonly kafkaProducer?: BaseProducer,
  ) {}

  async register(dto: RegisterDto) {
    const resolvedRole = dto.role || (dto.vendor ? 'VENDOR' : 'USER');
    const vendorServiceUrl =
      this.configService.get<string>('VENDOR_SERVICE_URL') || 'http://vendor-service:3000';
    const internalKey =
      this.configService.get<string>('INTERNAL_SERVICE_KEY') || 'internal-secret';
    const idempotencyKey = `reg_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const context: SagaContext = { idempotencyKey, steps: [] };

    const sagaSteps: SagaStep[] = [
      {
        name: 'CREATE_USER',
        execute: async () => {
          const existing = await db
            .select()
            .from(users)
            .where(eq(users.email, dto.email))
            .limit(1);
          if (existing.length > 0) {
            throw new ConflictException('Email already registered');
          }
          const hashed = await bcrypt.hash(dto.password, 10);
          const [user] = await db
            .insert(users)
            .values({
              email: dto.email,
              password: hashed,
              firstName: dto.firstName,
              lastName: dto.lastName,
              phone: dto.phone,
              role: resolvedRole,
            })
            .returning();
          context.userId = user.id;
        },
        compensate: async () => {
          if (context.userId) {
            await db.delete(users).where(eq(users.id, context.userId));
            this.logger.warn(`Compensated: deleted user ${context.userId}`);
          }
        },
      },
      {
        name: 'CREATE_VENDOR_PROFILE',
        execute: async () => {
          if (resolvedRole !== 'VENDOR' || !dto.vendor) return;
          const { data } = await firstValueFrom(
            this.httpService.post(
              `${vendorServiceUrl}/internal/vendors`,
              {
                userId: context.userId,
                idempotencyKey,
                ...dto.vendor,
              },
              { headers: { 'x-internal-key': internalKey } },
            ),
          );
          context.vendorId = data.id;
        },
        compensate: async () => {
          if (context.vendorId) {
            try {
              await firstValueFrom(
                this.httpService.delete(
                  `${vendorServiceUrl}/internal/vendors/${context.vendorId}`,
                  { headers: { 'x-internal-key': internalKey } },
                ),
              );
              this.logger.warn(`Compensated: deleted vendor ${context.vendorId}`);
            } catch (e) {
              this.logger.error(`Failed to compensate vendor deletion: ${(e as Error).message}`);
            }
          }
        },
      },
    ];

    await this.sagaExecutor.execute(context, sagaSteps);

    // Build JWT with role-derived permissions
    const permissions = ROLE_PERMISSIONS[resolvedRole] ?? [];
    const payload: JwtPayload = {
      sub: context.userId!,
      email: dto.email,
      role: resolvedRole,
      permissions,
      vendorId: context.vendorId,
    };
    const token = this.jwtService.sign(payload);

    this.logger.log(`User registered: ${dto.email} (${resolvedRole})`);

    await this.trackUserActivity(context.userId!, 'register');
    await this.trackUserActivity(context.userId!, 'login');

    return {
      accessToken: token,
      user: {
        id: context.userId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: resolvedRole,
        permissions,
        vendorId: context.vendorId,
      },
    };
  }

  async login(dto: LoginDto) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Resolve vendorId for VENDOR role users
    let vendorId: string | undefined;
    if (user.role === 'VENDOR') {
      try {
        const vendorServiceUrl =
          this.configService.get<string>('VENDOR_SERVICE_URL') || 'http://vendor-service:3000';
        const internalKey =
          this.configService.get<string>('INTERNAL_SERVICE_KEY') || 'internal-secret';
        const { data } = await firstValueFrom(
          this.httpService.get(
            `${vendorServiceUrl}/internal/vendors/by-user/${user.id}`,
            { headers: { 'x-internal-key': internalKey } },
          ),
        );
        vendorId = data?.id;
      } catch {
        // Vendor profile might not exist yet — that's OK
      }
    }

    const permissions = ROLE_PERMISSIONS[user.role] ?? [];
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions,
      vendorId,
    };
    const token = this.jwtService.sign(payload);

    this.logger.log(`User logged in: ${user.email}`);

    await this.trackUserActivity(user.id, 'login');

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permissions,
        vendorId,
      },
    };
  }

  async getProfile(userId: string) {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private async trackUserActivity(userId: string, type: string): Promise<void> {
    if (!this.kafkaProducer) return;
    try {
      const message: UserActivityMessage = {
        userId,
        sessionId: `auth_${userId}`,
        type: type as any,
        timestamp: new Date().toISOString(),
        pageUrl: '',
        userAgent: 'auth-service',
        metadata: { source: 'auth-service' },
      };

      await this.kafkaProducer.send(USER_ACTIVITY_TOPIC, message, userId);
      this.logger.debug(`Tracked ${type} for user ${userId}`);
    } catch (error) {
      this.logger.warn(`Failed to track activity: ${(error as Error).message}`);
    }
  }
}
