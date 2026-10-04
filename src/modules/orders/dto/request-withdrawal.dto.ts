import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export enum PayoutMethod {
  BKASH = 'BKASH',
  NAGAD = 'NAGAD',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export class RequestWithdrawalDto {
  @ApiProperty({
    example: 500,
    description: 'Withdrawal amount in BDT (Minimum ৳100)',
    minimum: 100,
  })
  @IsNumber()
  @Min(100, { message: 'Minimum withdrawal amount is ৳100' })
  amount!: number;

  @ApiProperty({
    enum: PayoutMethod,
    example: PayoutMethod.BKASH,
    description: 'Payout channel (BKASH, NAGAD, or BANK_TRANSFER)',
  })
  @IsEnum(PayoutMethod)
  payoutMethod!: PayoutMethod;

  @ApiProperty({
    example: '01700000000',
    description: 'Phone number or bank account number for receiving payout',
  })
  @IsString()
  @IsNotEmpty()
  payoutAccount!: string;
}
