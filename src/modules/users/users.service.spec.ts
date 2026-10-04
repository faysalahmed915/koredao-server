import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { UserRole } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };
  let authService: {
    register: ReturnType<typeof vi.fn>;
  };

  const mockUser = {
    id: 'user-123',
    name: 'Alice',
    email: 'alice@example.com',
    emailVerified: false,
    image: null,
    role: UserRole.CUSTOMER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    authService = {
      register: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return a user if found', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById('user-123');
      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated users and total metadata', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('create', () => {
    it('should throw ConflictException if email exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.create({
          name: 'Alice',
          email: 'alice@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should register and return new user if email is available', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // existence check
        .mockResolvedValueOnce(mockUser); // findById after creation

      authService.register.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        cookies: [],
      });

      const result = await service.create({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'Password123!',
      });

      expect(authService.register).toHaveBeenCalledWith({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'Password123!',
        image: undefined,
      });
      expect(result).toEqual(mockUser);
    });

    it('should update user role if an explicit non-default role is requested', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null); // existence check
      authService.register.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        cookies: [],
      });
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        role: UserRole.ADMIN,
      });

      const result = await service.create({
        name: 'Admin Bob',
        email: 'bob@example.com',
        password: 'Password123!',
        role: UserRole.ADMIN,
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: { role: UserRole.ADMIN },
        }),
      );
      expect(result.role).toBe(UserRole.ADMIN);
    });
  });

  describe('update', () => {
    it('should update and return user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, name: 'Alice Updated' });

      const result = await service.update('user-123', { name: 'Alice Updated' });
      expect(result.name).toBe('Alice Updated');
    });

    it('should reject non-admin updating another user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.update(
          'user-123',
          { name: 'Hacked' },
          { id: 'user-attacker', email: 'attacker@example.com', role: UserRole.CUSTOMER },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject non-admin updating their own role', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.update(
          'user-123',
          { role: UserRole.ADMIN },
          { id: 'user-123', email: 'alice@example.com', role: UserRole.CUSTOMER },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject admin promoting someone to super_admin', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.update(
          'user-123',
          { role: UserRole.SUPER_ADMIN },
          { id: 'admin-1', email: 'admin@example.com', role: UserRole.ADMIN },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject admin modifying a super_admin account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: UserRole.SUPER_ADMIN,
      });

      await expect(
        service.update(
          'user-123',
          { name: 'Attempted Change' },
          { id: 'admin-1', email: 'admin@example.com', role: UserRole.ADMIN },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should delete user if exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.delete.mockResolvedValue(mockUser);

      const result = await service.remove('user-123');
      expect(result.message).toContain('deleted successfully');
    });

    it('should reject user attempting self-deletion via admin endpoint', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.remove('user-123', {
          id: 'user-123',
          email: 'admin@example.com',
          role: UserRole.ADMIN,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject standard admin deleting a super_admin', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: UserRole.SUPER_ADMIN,
      });

      await expect(
        service.remove('user-123', {
          id: 'admin-1',
          email: 'admin@example.com',
          role: UserRole.ADMIN,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
