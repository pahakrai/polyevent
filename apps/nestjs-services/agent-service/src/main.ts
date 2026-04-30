import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['http://localhost:3005', 'http://localhost:3000'],
    credentials: true,
  });
  const port = process.env.PORT || 3010;
  await app.listen(port);
  console.log(`Agent service running on port ${port}`);
}
bootstrap();
