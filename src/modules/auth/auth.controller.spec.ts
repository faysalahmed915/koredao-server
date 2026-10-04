import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
  };

  const mockResponse = () => {
    const res: any = {};
    res.setHeader = vi.fn().mockReturnValue(res);
    return res;
  };

  const mockRequest = () =>
    ({
      headers: {},
      session: { id: 'sess-1' },
      user: { id: 'usr-1', email: 'test@example.com' },
    }) as any;

  beforeEach(async () => {
    authService = {
      register: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      getSession: vi.fn(),
      signInSocial: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register user and set session cookies', async () => {
      authService.register.mockResolvedValue({
        data: { user: { id: 'usr-1', email: 'test@example.com' }, token: 'token-123' },
        cookies: ['session_token=abc; Path=/; HttpOnly'],
      });

      const res = mockResponse();
      const req = mockRequest();

      const result = await controller.register(
        {
          name: 'Test',
          email: 'test@example.com',
          password: 'Password123!',
        },
        req,
        res,
      );

      expect(authService.register).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', [
        'session_token=abc; Path=/; HttpOnly',
      ]);
      expect(result).toHaveProperty('user');
    });
  });

  describe('login', () => {
    it('should authenticate user and set cookies', async () => {
      authService.login.mockResolvedValue({
        data: { user: { id: 'usr-1', email: 'test@example.com' }, token: 'token-123' },
        cookies: ['session_token=abc; Path=/; HttpOnly'],
      });

      const res = mockResponse();
      const req = mockRequest();

      const result = await controller.login(
        {
          email: 'test@example.com',
          password: 'Password123!',
        },
        req,
        res,
      );

      expect(authService.login).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', [
        'session_token=abc; Path=/; HttpOnly',
      ]);
      expect(result).toHaveProperty('user');
    });
  });

  describe('logout', () => {
    it('should call logout and clear cookies', async () => {
      authService.logout.mockResolvedValue({
        data: { success: true },
        cookies: ['session_token=; Max-Age=0'],
      });

      const res = mockResponse();
      const req = mockRequest();

      const result = await controller.logout(req, res);

      expect(authService.logout).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', [
        'session_token=; Max-Age=0',
      ]);
      expect(result).toEqual({ success: true });
    });
  });

  describe('getMe', () => {
    it('should return current user and session from request', () => {
      const user = { id: 'usr-1', email: 'test@example.com' };
      const req = mockRequest();

      const result = controller.getMe(user, req);
      expect(result).toEqual({
        user,
        session: { id: 'sess-1' },
      });
    });
  });

  describe('googleSignIn', () => {
    it('should redirect browser to Google OAuth URL', async () => {
      const redirectUrl = 'https://accounts.google.com/o/oauth2/v2/auth?...';
      authService.signInSocial.mockResolvedValue({
        url: redirectUrl,
        redirect: true,
      });

      const res = { redirect: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
      const req = mockRequest();

      await controller.googleSignIn('http://localhost:3000/callback', req, res);

      expect(authService.signInSocial).toHaveBeenCalledWith(
        'google',
        'http://localhost:3000/callback',
        req.headers,
      );
      expect(res.redirect).toHaveBeenCalledWith(redirectUrl);
    });
  });
});
