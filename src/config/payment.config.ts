import { registerAs } from '@nestjs/config';

export const paymentConfig = registerAs('payment', () => ({
  aamarpay: {
    storeId: process.env.AAMARPAY_STORE_ID || 'aamarpaytest',
    signatureKey: process.env.AAMARPAY_SIGNATURE_KEY || 'dbb74894e82415a2f7ff0ec3a97e4183',
    isSandbox: process.env.AAMARPAY_IS_SANDBOX !== 'false',
    initiateUrl:
      process.env.AAMARPAY_IS_SANDBOX !== 'false'
        ? 'https://sandbox.aamarpay.com/jsonpost.php'
        : 'https://secure.aamarpay.com/jsonpost.php',
    verifyUrl:
      process.env.AAMARPAY_IS_SANDBOX !== 'false'
        ? 'https://sandbox.aamarpay.com/api/v1/trxcheck/request.php'
        : 'https://secure.aamarpay.com/api/v1/trxcheck/request.php',
  },
  piprapay: {
    apiKey: process.env.PIPRAPAY_API_KEY || 'demo_piprapay_key',
    merchantId: process.env.PIPRAPAY_MERCHANT_ID || 'demo_piprapay_merchant',
    isSandbox: process.env.PIPRAPAY_IS_SANDBOX !== 'false',
    initiateUrl: 'https://api.piprapay.com/v1/payment/create',
    verifyUrl: 'https://api.piprapay.com/v1/payment/verify',
  },
  returnUrl: process.env.PAYMENT_RETURN_URL || 'http://localhost:3001/orders',
  cancelUrl: process.env.PAYMENT_CANCEL_URL || 'http://localhost:3001/orders',
}));
