import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user account',
    description:
      'Creates a new user with password hashing and returns the user object and session token.',
  })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully with session created.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or invalid input data.',
  })
  @ApiResponse({
    status: 422,
    description: 'Email already registered.',
  })
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { data, cookies } = await this.authService.register(
      registerDto,
      req.headers,
    );

    if (cookies && cookies.length > 0) {
      res.setHeader('Set-Cookie', cookies);
    }

    return data;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in with email and password',
    description:
      'Validates credentials, creates an active session, and sets session cookies.',
  })
  @ApiResponse({
    status: 200,
    description: 'User authenticated successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid email or password.',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { data, cookies } = await this.authService.login(
      loginDto,
      req.headers,
    );

    if (cookies && cookies.length > 0) {
      res.setHeader('Set-Cookie', cookies);
    }

    return data;
  }

  @Public()
  @Get('google')
  @ApiOperation({
    summary: 'Initiate Google / Gmail OAuth sign-in',
    description:
      'Generates and redirects to the Google OAuth consent screen or returns the redirect authorization URL.',
  })
  @ApiQuery({
    name: 'callbackURL',
    required: false,
    description: 'URL to redirect to after successful Google authentication',
    example: 'http://localhost:3000/api/v1/auth/me',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects browser to Google OAuth consent screen.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the Google OAuth authorization URL.',
  })
  async googleSignIn(
    @Query('callbackURL') callbackURL: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.authService.signInSocial(
      'google',
      callbackURL,
      req.headers,
    );

    if (result && 'url' in result && result.url) {
      return res.redirect(result.url);
    }

    return res.status(HttpStatus.OK).json(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Log out and invalidate current session',
  })
  @ApiResponse({
    status: 200,
    description: 'Session invalidated and cookies cleared successfully.',
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { data, cookies } = await this.authService.logout(req.headers);

    if (cookies && cookies.length > 0) {
      res.setHeader('Set-Cookie', cookies);
    }

    return data;
  }

  @Get('me')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get current authenticated user profile & session info',
  })
  @ApiResponse({
    status: 200,
    description: 'Current session user profile retrieved successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing session cookie.',
  })
  getMe(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return {
      user,
      session: (req as any).session,
    };
  }
}
