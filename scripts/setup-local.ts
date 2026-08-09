import { setupLocal } from './lib/setup-local.js';

setupLocal().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
