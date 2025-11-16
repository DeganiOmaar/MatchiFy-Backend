import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ CORS pour Android / Web
  app.enableCors({
    origin: '*', // tu pourras restreindre plus tard
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ✅ Validation globale des DTO (whitelist = ne garde que les champs du DTO)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // ✅ Servir les fichiers statiques (images) depuis /uploads
  //    -> /uploads/profile/xxx.jpg, /uploads/banner/xxx.jpg, /uploads/portfolio/xxx.jpg
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  // ✅ Swagger (optionnel mais utile)
  const config = new DocumentBuilder()
    .setTitle('Matchify API')
    .setDescription('API pour l’application Matchify')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap();