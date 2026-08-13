const { randomBytes } = require('node:crypto');
const fs = require('node:fs');

const file = 'backend/.env';
const keys = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'CSRF_SECRET', 'ENCRYPTION_KEY'];

let text = fs.readFileSync(file, 'utf8');
for (const key of keys) {
  const value = randomBytes(32).toString('hex');
  text = text.replace(new RegExp(`^${key}=.*`, 'm'), `${key}=${value}`);
}
fs.writeFileSync(file, text);
