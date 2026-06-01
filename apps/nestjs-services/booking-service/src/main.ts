import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Webhook endpoint needs raw body — disable JSON parsing for /webhooks
  app.use('/webhooks/stripe', (await import('express')).raw({ type: 'application/json' }));

  app.enableCors();

  const port = process.env.PORT || 3007;
  await app.listen(port);
  console.log(`Booking Service running on port ${port}`);
}

bootstrap();
