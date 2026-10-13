const { Client } = require('pg');
require('dotenv').config();
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
    const res = await client.query('SELECT id, recipient, template, subject, status, error, transport, "createdAt" FROM email_log ORDER BY "createdAt" DESC LIMIT 10');
    console.log('LOGS:', JSON.stringify(res.rows, null, 2));
    await client.end();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
