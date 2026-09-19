export type PaymentProviderType = 'manual' | 'fampay' | 'razorpay' | 'stripe';

export type PaymentMethod =
  'cash' | 'upi' | 'bank_transfer' | 'fampay' | 'card' | 'cheque' | 'other';

export type PaymentStatus =
  | 'pending'
  | 'pending_verification'
  | 'completed'
  | 'rejected'
  | 'failed'
  | 'refunded'
  | 'disputed';

export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void' | 'overdue';

export interface CreateOrderParams {
  invoiceId: string;
  academyId: string;
  amount: number;
  currency: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  idempotencyKey: string;
}

export interface PaymentOrderResult {
  provider: PaymentProviderType;
  orderId: string;
  amount: number;
  currency: string;
  clientPayload: Record<string, unknown>;
}

export interface PaymentWebhookVerificationResult {
  isValid: boolean;
  event: string;
  paymentId?: string;
  orderId?: string;
  amount?: number;
  status: 'completed' | 'failed' | 'refunded';
  rawPayload: Record<string, unknown>;
}

export interface PaymentGatewayProvider {
  readonly providerType: PaymentProviderType;
  createPaymentOrder(params: CreateOrderParams): Promise<PaymentOrderResult>;
  verifyWebhook(headers: Headers, bodyText: string): Promise<PaymentWebhookVerificationResult>;
}
