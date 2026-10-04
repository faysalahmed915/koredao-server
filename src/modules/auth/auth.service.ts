import {
  Injectable,
  Inject,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';

import { BETTER_AUTH } from './auth.constants.js';
import type { Auth } from './better-auth.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';

export interface AuthActionResult<T = unknown> {
  data: T;
  cookies: string[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(BETTER_AUTH)
    private readonly auth: Auth,
  ) { }

  get instance(): Auth {
    return this.auth;
  }

  get api() {
    return this.auth.api;
  }

  /**
   * Helper to normalize Node or Web headers to Fetch Headers instance
   */
  private normalizeHeaders(
    headers?: IncomingHttpHeaders | Headers,
  ): Headers {
    if (!headers) return new Headers();
    return headers instanceof Headers ? headers : fromNodeHeaders(headers);
  }

  /**
   * Registers a new user with Better Auth.
   * Returns authenticated user info and any Set-Cookie session headers.
   */
  async register(
    dto: RegisterDto,
    headers?: IncomingHttpHeaders | Headers,
  ): Promise<AuthActionResult> {
    try {
      const resp = await this.auth.api.signUpEmail({
        body: {
          email: dto.email,
          password: dto.password,
          name: dto.name,
          ...(dto.image ? { image: dto.image } : {}),
        },
        headers: this.normalizeHeaders(headers),
        asResponse: true,
      });

      if (!resp.ok) {
        const errorData = (await resp.json().catch(() => ({}))) as {
          message?: string;
          code?: string;
        };
        throw new HttpException(
          errorData.message || 'Registration failed',
          resp.status || HttpStatus.BAD_REQUEST,
        );
      }

      const cookies = resp.headers.getSetCookie();
      const data = await resp.json();
      return { data, cookies };
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }

      const apiErr = err as { message?: string; statusCode?: number; status?: number };
      const status = apiErr.statusCode || apiErr.status || HttpStatus.BAD_REQUEST;
      throw new HttpException(apiErr.message || 'Registration failed', status);
    }
  }

  /**
   * Authenticates user credentials via Better Auth.
   * Returns authenticated user, session token, and Set-Cookie session headers.
   */
  async login(
    dto: LoginDto,
    headers?: IncomingHttpHeaders | Headers,
  ): Promise<AuthActionResult> {
    try {
      const resp = await this.auth.api.signInEmail({
        body: {
          email: dto.email,
          password: dto.password,
          ...(dto.rememberMe !== undefined ? { rememberMe: dto.rememberMe } : {}),
        },
        headers: this.normalizeHeaders(headers),
        asResponse: true,
      });

      if (!resp.ok) {
        const errorData = (await resp.json().catch(() => ({}))) as {
          message?: string;
          code?: string;
        };
        throw new HttpException(
          errorData.message || 'Invalid email or password',
          resp.status || HttpStatus.UNAUTHORIZED,
        );
      }

      const cookies = resp.headers.getSetCookie();
      const data = await resp.json();
      return { data, cookies };
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }

      const apiErr = err as { message?: string; statusCode?: number; status?: number };
      const status = apiErr.statusCode || apiErr.status || HttpStatus.UNAUTHORIZED;
      throw new HttpException(apiErr.message || 'Invalid email or password', status);
    }
  }

  /**
   * Signs out the user and clears the session cookies.
   */
  async logout(headers?: IncomingHttpHeaders | Headers): Promise<AuthActionResult> {
    try {
      const resp = await this.auth.api.signOut({
        headers: this.normalizeHeaders(headers),
        asResponse: true,
      });

      const cookies = resp.headers.getSetCookie();
      const data = await resp.json().catch(() => ({ success: true }));
      return { data, cookies };
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }

      const apiErr = err as { message?: string; statusCode?: number; status?: number };
      const status = apiErr.statusCode || apiErr.status || HttpStatus.BAD_REQUEST;
      throw new HttpException(apiErr.message || 'Logout failed', status);
    }
  }

  /**
   * Initiates social sign-in (e.g. Google) and returns the OAuth authorization URL.
   */
  async signInSocial(
    provider: 'google' | (string & {}),
    callbackURL?: string,
    headers?: IncomingHttpHeaders | Headers,
  ) {
    try {
      return await this.auth.api.signInSocial({
        body: {
          provider,
          callbackURL,
        },
        headers: this.normalizeHeaders(headers),
      });
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }

      const apiErr = err as { message?: string; statusCode?: number; status?: number };
      const status = apiErr.statusCode || apiErr.status || HttpStatus.BAD_REQUEST;
      throw new HttpException(
        apiErr.message || `Failed to initiate social login for provider '${provider}'`,
        status,
      );
    }
  }

  /**
   * Validates and returns active session data for incoming request headers.
   */
  async getSession(headers: IncomingHttpHeaders | Headers) {
    const parsedHeaders = this.normalizeHeaders(headers);

    return this.auth.api.getSession({
      headers: parsedHeaders,
    });
  }
}
