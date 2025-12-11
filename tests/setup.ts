import dotenv from 'dotenv';

// Set default env vars for testing
process.env.PORT = '3000';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Keep logs quiet during tests
process.env.DATABASE_URL = 'file:./test.db';
process.env.MASTER_KEY = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

dotenv.config({ path: '.env.test' });
