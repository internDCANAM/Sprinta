export const en = {
  auth: {
    token: 'Missing access token.',
    unauthorized: 'You must be logged in.',
    invalidCredentials: 'Invalid email or password.',
    refreshTokenMissing: 'Refresh token missing.',
    refreshTokenInvalid: 'Invalid refresh token.',
    refreshTokenRevoked: 'Refresh token revoked.',
    userInactive: 'User account is inactive.',
    success: 'Login successful.',
  },
  format: {
    regex: 'Bank account number can only contain digits, spaces, and hyphens.',
  },
  http: {
    badRequest: 'Invalid request.',
    unauthorized: 'Authentication required.',
    forbidden: 'Access denied.',
    notFound: 'Resource not found.',
    conflict: 'Conflict.',
    rateLimited: 'Too many attempts, please try again later.',
    internalError: 'Something went wrong. Please try again.',
  },
  db: {
    dealNotFound: 'Deal not found.',
    customerProfileMissing: 'Customer profile not found.',
  },
  input: {
    validationFailed: 'Validation failed.',
    emailTaken: 'This email address is already in use.',
  },
} as const;
