import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants/security.constants.js';

/**
 * Decorator to bypass global authentication guards on public routes
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
