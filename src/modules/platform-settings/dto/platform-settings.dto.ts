export interface PlatformSettingValue {
  key: string;
  value: string;
  description?: string;
}

export interface UpdatePlatformSettingDto {
  key: string;
  value: string;
  description?: string;
}

export interface GetPlatformSettingDto {
  key: string;
}