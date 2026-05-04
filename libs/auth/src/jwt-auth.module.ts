import { Module, DynamicModule, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

export interface JwtAuthModuleOptions {
  secret: string;
  expiresIn?: string;
}

@Global()
@Module({})
export class JwtAuthModule {
  static forRoot(options: JwtAuthModuleOptions): DynamicModule {
    return {
      module: JwtAuthModule,
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: options.secret,
          signOptions: { expiresIn: options.expiresIn || '7d' },
        }),
      ],
      providers: [
        {
          provide: 'JWT_SECRET',
          useValue: options.secret,
        },
        {
          provide: JwtStrategy,
          useFactory: (secret: string) => new JwtStrategy(secret),
          inject: ['JWT_SECRET'],
        },
      ],
      exports: [PassportModule, JwtModule, JwtStrategy],
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: any[]) => Promise<JwtAuthModuleOptions> | JwtAuthModuleOptions;
    inject?: any[];
    imports?: any[];
  }): DynamicModule {
    return {
      module: JwtAuthModule,
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
          imports: options.imports || [],
          inject: options.inject || [],
          useFactory: options.useFactory,
        }),
        ...(options.imports || []),
      ],
      providers: [
        {
          provide: JwtStrategy,
          useFactory: (jwtSecret: string) => new JwtStrategy(jwtSecret),
          inject: ['JWT_SECRET'],
        },
        {
          provide: 'JWT_SECRET',
          useFactory: async (...args: any[]) => {
            const opts = await options.useFactory(...args);
            return opts.secret;
          },
          inject: options.inject || [],
        },
      ],
      exports: [PassportModule, JwtModule, JwtStrategy],
    };
  }
}
