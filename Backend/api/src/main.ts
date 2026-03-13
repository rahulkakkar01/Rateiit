import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from './entities/user.entity';
import { ShopOwnerEntity } from './entities/shopowner.entity';

async function seedDefaultLogins(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(UserEntity);
  const shopOwnerRepo = dataSource.getRepository(ShopOwnerEntity);

  const upsertAccount = async (
    repo: any,
    email: string,
    plainPassword: string,
    role: string,
    name: string,
    address: string,
  ) => {
    const existing = await repo.findOne({ where: { email } });
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    if (existing) {
      // Keep the login credentials fixed across restarts.
      existing.password = hashedPassword;
      existing.role = role;
      existing.name = name;
      existing.address = address;
      await repo.save(existing);
      console.log(`Updated fixed ${role} login: ${email}`);
      return;
    }

    await repo.save({
      email,
      password: hashedPassword,
      role,
      name,
      address,
    });

    console.log(`Seeded fixed ${role} login: ${email}`);
  };

  await upsertAccount(
    userRepo,
    process.env.FIXED_ADMIN_EMAIL || 'admin@rateit.local',
    process.env.FIXED_ADMIN_PASSWORD || 'Rateit@123',
    'admin',
    'System Admin',
    'Admin Office',
  );

  await upsertAccount(
    userRepo,
    process.env.FIXED_USER_EMAIL || 'user@rateit.local',
    process.env.FIXED_USER_PASSWORD || 'Rateit@123',
    'user',
    'Demo User',
    'User Address',
  );

  await upsertAccount(
    shopOwnerRepo,
    process.env.FIXED_SHOPOWNER_EMAIL || 'shopowner@rateit.local',
    process.env.FIXED_SHOPOWNER_PASSWORD || 'Rateit@123',
    'shopowner',
    'Demo Shop Owner',
    'Shop Address',
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS from env
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  // Global validation + transform
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger (skip in production)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('API Docs')
      .setDescription('API endpoints')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  await seedDefaultLogins(app.get(DataSource));

  const port = Number(process.env.PORT) || 3600;
  await app.listen(port);
  console.log(`Application running on port ${port}`);
}
bootstrap();
