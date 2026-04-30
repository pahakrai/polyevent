import {
  Injectable,
  Optional,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { db } from '../database/client';
import { users } from '../database/schema';
import { eq } from 'drizzle-orm';
import { BaseProducer, USER_ACTIVITY_TOPIC, UserActivityMessage } from '@polydom/kafka-client';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Optional() private readonly kafkaProducer?: BaseProducer,
  ) {}

  async register(dto: RegisterDto) {
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
        role: dto.role || 'USER',
      })
      .returning();

    this.logger.log(`User registered: ${user.email}`);

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    await this.trackUserActivity(user.id, 'register');
    await this.trackUserActivity(user.id, 'login'); // auto-login after register

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
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

    const payload = { sub: user.id, email: user.email, role: user.role };
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
