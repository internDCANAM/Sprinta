import { DealStatus, DealType, PaymentStatus } from './enums.js';

export interface DomainConfig {
  dealTypes: DealType[];
  dealStatuses: DealStatus[];
  paymentStatuses: PaymentStatus[];
}

export function domainConfig(): DomainConfig {
  return {
    dealTypes: Object.values(DealType),
    dealStatuses: Object.values(DealStatus),
    paymentStatuses: Object.values(PaymentStatus),
  };
}
