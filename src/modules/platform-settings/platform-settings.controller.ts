import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service.js';
import type {
  UpdatePlatformSettingDto,
  GetPlatformSettingDto,
  PlatformSettingValue,
} from './dto/platform-settings.dto.js';
import { UserRole } from '@prisma/client';
import type { RequestWithUser } from '../../common/interfaces/index.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { MinRole } from '../../common/decorators/min-role.decorator.js';

@Controller('settings')
@UseGuards(RolesGuard)
export class PlatformSettingsController {
  constructor(
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  /** GET /settings/:key - Retrieve a platform setting by key */
  @Get(':key')
  @HttpCode(HttpStatus.OK)
  async getSetting(
    @Param() param: GetPlatformSettingDto,
    @Req() req: RequestWithUser,
  ): Promise<PlatformSettingValue> {
    return this.platformSettingsService.getSetting(param.key);
  }

  /** GET /settings - Retrieve all platform settings */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllSettings(): Promise<PlatformSettingValue[]> {
    return this.platformSettingsService.getAllSettings();
  }

  /** PATCH /settings/:key - Update a platform setting (admin only) */
  @Patch(':key')
  @HttpCode(HttpStatus.OK)
  @MinRole(UserRole.ADMIN)
  async updateSetting(
    @Param() param: GetPlatformSettingDto,
    @Body() dto: UpdatePlatformSettingDto,
    @Req() req: RequestWithUser,
  ): Promise<PlatformSettingValue> {
    return this.platformSettingsService.updateSetting(req.user.id, {
      ...dto,
      key: param.key,
    });
  }
}