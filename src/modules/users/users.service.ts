import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '@prisma/client';

export const USER_SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) { }

  /**
   * Creates a new user with password hashing via Better Auth.
   * Enforces role assignment safety checks when an authenticated actor is present.
   */
  async create(dto: CreateUserDto, currentUser?: AuthenticatedUser) {
    if (dto.role && dto.role !== UserRole.CUSTOMER && currentUser) {
      if (
        currentUser.role !== UserRole.ADMIN &&
        currentUser.role !== UserRole.SUPER_ADMIN
      ) {
        throw new ForbiddenException(
          'You do not have permission to assign user roles',
        );
      }

      if (
        dto.role === UserRole.SUPER_ADMIN &&
        currentUser.role !== UserRole.SUPER_ADMIN
      ) {
        throw new ForbiddenException(
          'Only super administrators can create users with the super_admin role',
        );
      }
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    // Register user with password hashing via Better Auth API
    const authResult = await this.authService.register({
      name: dto.name,
      email: dto.email.toLowerCase(),
      password: dto.password,
      image: dto.image,
    });

    const user = (authResult.data as { user: { id: string } }).user;

    // If an explicit role was requested and differs from DEFAULT_ROLE, update it
    if (dto.role && dto.role !== UserRole.CUSTOMER && user?.id) {
      return this.prisma.user.update({
        where: { id: user.id },
        data: { role: dto.role },
        select: USER_SAFE_SELECT,
      });
    }

    return this.findById(user.id);
  }

  /**
   * Retrieves a paginated list of users with optional filtering and search.
   */
  async findAll(query: QueryUsersDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: USER_SAFE_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Finds a user by ID. Throws NotFoundException if not found.
   */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SAFE_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    return user;
  }

  /**
   * Finds a user by email address.
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: USER_SAFE_SELECT,
    });
  }

  /**
   * Retrieves full profile information for the authenticated user,
   * including active sessions and linked account provider names.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...USER_SAFE_SELECT,
        accounts: {
          select: {
            id: true,
            providerId: true,
            createdAt: true,
          },
        },
        sessions: {
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            expiresAt: true,
            createdAt: true,
          },
        },
        vendorProfile: {
          include: {
            handwritingSamples: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        customerProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID '${userId}' not found`);
    }

    return user;
  }

  /**
   * Updates user details.
   * Enforces privilege checks:
   * - Prevents non-admins from modifying other user accounts.
   * - Prevents non-admins from altering user roles.
   * - Prevents administrators from promoting to super_admin or modifying super_admin accounts.
   */
  async update(id: string, dto: UpdateUserDto, currentUser?: AuthenticatedUser) {
    const targetUser = await this.findById(id);

    if (currentUser) {
      const isSelf = currentUser.id === id;
      const isSuperAdmin = currentUser.role === UserRole.SUPER_ADMIN;
      const isAdmin = currentUser.role === UserRole.ADMIN || isSuperAdmin;

      // Non-admins cannot edit other users
      if (!isSelf && !isAdmin) {
        throw new ForbiddenException(
          'You are not authorized to update other user accounts',
        );
      }

      // Role change validation
      if (dto.role !== undefined) {
        if (!isAdmin) {
          throw new ForbiddenException(
            'You do not have permission to modify user roles',
          );
        }

        if (dto.role === UserRole.SUPER_ADMIN && !isSuperAdmin) {
          throw new ForbiddenException(
            'Only super administrators can assign the super_admin role',
          );
        }
      }

      // Admins cannot modify super_admin accounts unless they are super_admin
      if (targetUser.role === UserRole.SUPER_ADMIN && !isSuperAdmin && !isSelf) {
        throw new ForbiddenException(
          'Administrators cannot modify super administrator accounts',
        );
      }
    }

    if (dto.email) {
      const emailLower = dto.email.toLowerCase();
      const existing = await this.prisma.user.findUnique({
        where: { email: emailLower },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Email address already in use by another account');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email.toLowerCase() } : {}),
        ...(dto.image !== undefined ? { image: dto.image } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
      },
      select: USER_SAFE_SELECT,
    });
  }

  /**
   * Deletes a user by ID.
   * Enforces safety checks:
   * - Users cannot delete their own account via this endpoint.
   * - Standard administrators cannot delete super administrator accounts.
   */
  async remove(id: string, currentUser?: AuthenticatedUser) {
    const targetUser = await this.findById(id);

    if (currentUser) {
      if (currentUser.id === id) {
        throw new ForbiddenException(
          'You cannot delete your own account via this endpoint',
        );
      }

      const isSuperAdmin = currentUser.role === UserRole.SUPER_ADMIN;
      if (targetUser.role === UserRole.SUPER_ADMIN && !isSuperAdmin) {
        throw new ForbiddenException(
          'Administrators cannot delete super administrator accounts',
        );
      }
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return {
      message: `User '${id}' deleted successfully`,
    };
  }
}
