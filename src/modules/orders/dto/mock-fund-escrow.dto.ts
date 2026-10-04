import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MockFundEscrowDto {
  @ApiPropertyOptional({
    description: 'Payment gateway identifier',
    example: 'AAMARPAY',
    default: 'MOCK_SANDBOX',
  })
  @IsOptional()
  @IsString()
  paymentGateway?: string = 'MOCK_SANDBOX';

  @ApiPropertyOptional({
    description: 'Mock or simulated transaction reference',
    example: 'MOCK-TXN-998822',
  })
  @IsOptional()
  @IsString()
  transactionRef?: string;
}
