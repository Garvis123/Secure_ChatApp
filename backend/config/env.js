// config/env.js
import dotenv from 'dotenv';

// Load environment variables immediately
dotenv.config();

// Validate critical environment variables
const requiredEnvVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'JWT_SECRET',
  'MONGODB_URI'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  process.exit(1);
}

console.log('✅ Environment variables loaded successfully');

export default process.env;