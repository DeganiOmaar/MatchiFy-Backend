import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ValidationExceptionFilter } from './common/filters/validation-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files from uploads directory
  // Use process.cwd() to get the project root directory
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  console.log('📁 Serving static files from:', join(process.cwd(), 'uploads'));

  // Enable CORS
  app.enableCors();

  // Global validation pipe with detailed error messages
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
          const constraints = error.constraints || {};
          const firstConstraint = Object.values(constraints)[0];
          return firstConstraint || `${error.property} is invalid`;
        });
        return new BadRequestException(messages);
      },
    }),
  );

  // Global exception filter for validation errors
  app.useGlobalFilters(new ValidationExceptionFilter());

  // Swagger configuration 
  const config = new DocumentBuilder()
    .setTitle('MatchiFy API')
    .setDescription('Recruitment platform API for talents and recruiters')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('talent', 'Talent management')
    .addTag('recruiter', 'Recruiter management')
    .addTag('user', 'User management')
    .addTag('portfolio', 'Portfolio management')
    .addTag('skills', 'Skills management (ESCO)')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`📚 Swagger documentation: http://localhost:${process.env.PORT ?? 3000}/api/docs`);
}
bootstrap();
