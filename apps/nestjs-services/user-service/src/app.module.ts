import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NatsModule } from '@polydom/nats-client';
import { HealthController } from './health.controller';
import { UserModule } from './user/user.module';
import { GroupModule } from './group/group.module';

const imports: any[] = [
  ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: ['.env', '../../../.env'],
  }),
  UserModule,
  GroupModule,
];

if (process.env.NATS_SERVERS) {
  imports.push(
    NatsModule.register({
      servers: process.env.NATS_SERVERS.split(','),
      producer: true,
    }),
  );
}

@Module({
  imports,
  controllers: [HealthController],
})
export class AppModule {}
