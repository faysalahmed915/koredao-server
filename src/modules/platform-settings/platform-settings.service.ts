import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import type {
  PlatformSettingValue,
  UpdatePlatformSettingDto,
  GetPlatformSettingDto,
} from './dto/platform-settings.dto.js';

const DEFAULT_PLATFORM_FEE_PERCENTAGE = 10;

@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Get a platform setting by key */
  async getSetting(key: string): Promise<PlatformSettingValue> {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException(`Platform setting '${key}' not found`);
    }

    return {
      key: setting.key,
      value: setting.value,
      description: setting.description ?? undefined,
    };
  }

  /** Get all platform settings */
  async getAllSettings(): Promise<PlatformSettingValue[]> {
    const settings = await this.prisma.platformSetting.findMany();
    return settings.map((s) => ({
      key: s.key,
      value: s.value,
      description: s.description ?? undefined,
    }));
  }

  /** Update a platform setting */
  async updateSetting(
    userId: string,
    dto: UpdatePlatformSettingDto,
  ): Promise<PlatformSettingValue> {
    const { key, value, description } = dto;

    const setting = await this.prisma.platformSetting.upsert({
      where: { key },
      update: {
        value,
        description,
        updatedAt: new Date(),
        updatedById: userId,
      },
      create: {
        key,
        value,
        description,
        updatedAt: new Date(),
        updatedById: userId,
      },
    });

    return {
      key: setting.key,
      value: setting.value,
      description: setting.description ?? undefined,
    };
  }

  /** Get the platform fee percentage (defaults to 10% when not configured) */
  async getPlatformFeePercentage(): Promise<number> {
    try {
      const setting = await this.getSetting('platform_fee_percentage');
      const parsed = parseFloat(setting.value);
      return Number.isFinite(parsed) ? parsed : DEFAULT_PLATFORM_FEE_PERCENTAGE;
    } catch {
      return DEFAULT_PLATFORM_FEE_PERCENTAGE;
    }
  }

  /** Set the platform fee percentage */
  async setPlatformFeePercentage(
    userId: string,
    percentage: number,
  ): Promise<PlatformSettingValue> {
    return this.updateSetting(userId, {
      key: 'platform_fee_percentage',
      value: percentage.toString(),
      description: 'Percentage fee charged by the platform on each order',
    });
  }
}
