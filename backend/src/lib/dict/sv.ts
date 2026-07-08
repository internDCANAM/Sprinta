export const sv = {
  auth: {
    token: 'Access token saknas.',
    unauthorized: 'Du är inte inloggad.',
    invalidCredentials: 'Fel e-post eller lösenord.',
    refreshTokenMissing: 'Refresh-token saknas.',
    refreshTokenInvalid: 'Ogiltig refresh-token.',
    refreshTokenRevoked: 'Refresh-token återkallad.',
    userInactive: 'Kontot är inaktiverat.',
    success: 'Inloggning lyckades.',
  },
  format: {
    regex: 'Bankkontonumret får endast innehålla siffror, mellanslag och bindestreck.',
  },
  http: {
    badRequest: 'Ogiltig förfrågan.',
    unauthorized: 'Autentisering krävs.',
    forbidden: 'Åtkomst nekad.',
    notFound: 'Resursen hittades inte.',
    conflict: 'Konflikt.',
    rateLimited: 'För många försök, försök igen senare.',
    internalError: 'Något gick fel. Försök igen.',
  },
  db: {
    dealNotFound: 'Deal hittades inte.',
    customerProfileMissing: 'Kundprofil saknas.',
  },
  input: {
    validationFailed: 'Valideringsfel.',
    emailTaken: 'E-postadressen används redan.',
  },
} as const;
