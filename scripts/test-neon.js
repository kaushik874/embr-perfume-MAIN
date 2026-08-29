const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_aikCM42gPleh@ep-aged-unit-adzixo2v-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require' });
pool.query('SELECT 1').then(() => {
  console.log('NEON_SUCCESS');
  process.exit(0);
}).catch(e => {
  console.error('NEON_ERROR', e.code || e.message);
  process.exit(1);
});
