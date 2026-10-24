import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.enableCors({
    origin: ['http://localhost:3001', 'http://127.0.0.1:3001'],
  });
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0', (err, addr) => console.log(err ?? `The app is running on ${addr}`));
}
void bootstrap();
