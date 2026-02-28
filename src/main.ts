import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

const MAX_URL_LENGTH = 10_000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('app.port');

  // Increase max URL length for Phantom wallet callbacks with long data params
  const httpAdapter = app.getHttpAdapter() as {
    getInstance(): { setMaxUrlLength: (length: number) => void };
  };
  httpAdapter.getInstance().setMaxUrlLength(MAX_URL_LENGTH);

  await app.listen(port);

  const url = await app.getUrl();
  Logger.log(`Application is running on: ${url}`, 'Bootstrap');
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  Logger.error(message, stack, 'Bootstrap');
  process.exitCode = 1;
});
