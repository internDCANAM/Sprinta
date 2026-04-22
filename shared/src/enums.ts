export const UserRole = {
  CUSTOMER: "CUSTOMER",
  ADMIN: "ADMIN",
  SUPERADMIN: "SUPERADMIN",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const DealType = {
  SLUTAVVERKNING: "SLUTAVVERKNING",
  GALLRING: "GALLRING",
  ENERGIVIRKE: "ENERGIVIRKE",
  OVRIGT: "OVRIGT",
} as const;
export type DealType = (typeof DealType)[keyof typeof DealType];

export const DealStatus = {
  PLANERAD: "PLANERAD",
  PAGAENDE: "PAGAENDE",
  KLAR: "KLAR",
  FAKTURERAD: "FAKTURERAD",
  AVSLUTAD: "AVSLUTAD",
} as const;
export type DealStatus = (typeof DealStatus)[keyof typeof DealStatus];

export const DealEventType = {
  AVTAL_SIGNERAT: "AVTAL_SIGNERAT",
  AVVERKNING_START: "AVVERKNING_START",
  AVVERKNING_SLUT: "AVVERKNING_SLUT",
  MATBESKED: "MATBESKED",
  UTBETALNING: "UTBETALNING",
  OVRIGT: "OVRIGT",
} as const;
export type DealEventType = (typeof DealEventType)[keyof typeof DealEventType];

export const DocumentType = {
  AVTAL: "AVTAL",
  AVRAKNING: "AVRAKNING",
  MATBESKED: "MATBESKED",
  STANFORD: "STANFORD",
  OVRIGT: "OVRIGT",
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const MessageSenderRole = {
  CUSTOMER: "CUSTOMER",
  ADMIN: "ADMIN",
} as const;
export type MessageSenderRole =
  (typeof MessageSenderRole)[keyof typeof MessageSenderRole];

export const PaymentStatus = {
  PLANERAD: "PLANERAD",
  GENOMFORD: "GENOMFORD",
  MISSLYCKAD: "MISSLYCKAD",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
