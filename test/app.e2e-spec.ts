import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { AppValidationPipe } from '../src/common/pipes/app-validation.pipe.js';

describe('Enterprise Starter End-to-End Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new AppValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / should return standardized envelope and correlation header', async () => {
    const res = await request(app.getHttpServer())
      .get('/')
      .expect(200);

    expect(res.headers['x-correlation-id']).toBeDefined();
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('statusCode', 200);
    expect(res.body.data).toHaveProperty('name', 'Enterprise NestJS Starter');
    expect(res.body.data).toHaveProperty('status', 'online');
  });

  it('GET /health/live should respond with 200 OK', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);

    expect(res.body.data).toHaveProperty('status', 'ok');
  });

  it('POST /auth/login with invalid payload should return 400 with structured validation errors', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'invalid-email', password: '123' })
      .expect(400);

    expect(res.body).toHaveProperty('statusCode', 400);
    expect(res.body).toHaveProperty('message', 'Validation failed');
    expect(res.body).toHaveProperty('errors');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it('POST /auth/login should reject unexpected properties (forbidNonWhitelisted)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'developer@example.com',
        password: 'ValidPassword123!',
        unauthorizedRole: 'ADMIN', // Injection attempt
      })
      .expect(400);

    expect(res.body.errors[0].constraints).toHaveProperty(
      'whitelistValidation',
    );
  });
});
