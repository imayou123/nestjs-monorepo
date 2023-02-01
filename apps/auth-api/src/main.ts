import { HttpStatus, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { description, name, version } from 'apps/auth-api/package.json';
import { bold } from 'colorette';

import { ILoggerService } from '@/libs/infra/logger';
import { ISecretsService } from '@/libs/infra/secrets';
import { DEFAULT_TAG, SWAGGER_API_ROOT } from '@/libs/utils/documentation/constants';
import { AppExceptionFilter } from '@/libs/utils/filters/http-exception.filter';
import { ExceptionInterceptor } from '@/libs/utils/interceptors/exception/http-exception.interceptor';
import { HttpLoggerInterceptor } from '@/libs/utils/interceptors/logger/http-logger.interceptor';
import { TracingInterceptor } from '@/libs/utils/interceptors/logger/http-tracing.interceptor';

import { MainModule } from './modules/module';

async function bootstrap() {
  const app = await NestFactory.create(MainModule, {
    bufferLogs: true,
    cors: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      errorHttpStatusCode: HttpStatus.PRECONDITION_FAILED,
    }),
  );

  const loggerService = app.get(ILoggerService);

  loggerService.setApplication(name);
  app.useGlobalFilters(new AppExceptionFilter(loggerService));

  app.useGlobalInterceptors(
    new ExceptionInterceptor(),
    new HttpLoggerInterceptor(loggerService),
    new TracingInterceptor({ app: name, version }, loggerService),
  );

  const {
    authAPI: { port: PORT, url },
    ENV,
    KIBANA_URL,
    JEAGER_URL,
    REDIS_COMMANDER_URL,
  } = app.get(ISecretsService);

  app.useLogger(loggerService);

  app.useGlobalPipes(new ValidationPipe({ errorHttpStatusCode: HttpStatus.PRECONDITION_FAILED }));

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  const config = new DocumentBuilder()
    .setTitle(name)
    .setDescription(description)
    .setVersion(version)
    .addTag(DEFAULT_TAG)
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_API_ROOT, app, document);

  loggerService.info({ message: `🟢 ${name} listening at ${bold(PORT)} on ${bold(ENV?.toUpperCase())} 🟢` });

  loggerService.log('Database connected!\n');

  await app.listen(PORT);

  const openApiURL = `${url}/${SWAGGER_API_ROOT}`;

  loggerService.log(`🔵 swagger listening at ${bold(openApiURL)}`);
  loggerService.log(`🔵 redis-commander listening at ${bold(REDIS_COMMANDER_URL)}`);
  loggerService.log(`🔵 kibana listening at ${bold(KIBANA_URL)}`);
  loggerService.log(`🔵 jeager listening at ${bold(JEAGER_URL)}`);
}
bootstrap();
