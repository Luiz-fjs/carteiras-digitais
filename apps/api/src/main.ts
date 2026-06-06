import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*' });
  const port = process.env.API_PORT ?? 3000;
  await app.listen(port);
  console.log(`AccessChain API rodando em http://localhost:${port}`);
}
bootstrap();
