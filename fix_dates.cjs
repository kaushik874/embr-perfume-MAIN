const fs = require('fs');
const path = require('path');

const filesToFix = [
  "server/lib/addresses.ts",
  "server/lib/orders.ts",
  "server/middleware/security.ts",
  "server/routes/about-admin.ts",
  "server/routes/analytics-admin.ts",
  "server/routes/analytics-track.ts",
  "server/routes/auth.ts",
  "server/routes/hero-admin.ts",
  "server/routes/me.ts",
  "server/routes/orders-admin.ts"
];

filesToFix.forEach(relPath => {
  const filepath = path.join(__dirname, relPath);
  if (!fs.existsSync(filepath)) return;
  
  let content = fs.readFileSync(filepath, 'utf8');

  // Replace datetime('now') -> CURRENT_TIMESTAMP
  content = content.replace(/datetime\('now'\)/g, "CURRENT_TIMESTAMP");
  
  // Replace datetime(o.expires_at) -> o.expires_at
  content = content.replace(/datetime\(o\.expires_at\)/g, "o.expires_at");

  // Replace datetime('now', '-30 minutes') -> CURRENT_TIMESTAMP - INTERVAL '30 minutes'
  content = content.replace(/datetime\('now',\s*'([^']+)'\)/g, (match, intervalStr) => {
    // intervalStr e.g. '-30 minutes', '-6 days', '+10 minutes'
    // in Postgres: CURRENT_TIMESTAMP + INTERVAL '-30 minutes' or just CURRENT_TIMESTAMP - INTERVAL '30 minutes'
    // Let's just use CURRENT_TIMESTAMP + INTERVAL 'intervalStr'
    return `CURRENT_TIMESTAMP + INTERVAL '${intervalStr}'`;
  });

  // Fix analytics-track.ts SQLite specific CAST(julianday...
  if (relPath.includes("analytics-track.ts")) {
    content = content.replace(
      /CAST\(\(julianday\(\?\)\s*-\s*julianday\(started_at\)\)\s*\*\s*86400\s*AS\s*INTEGER\)/g,
      "EXTRACT(EPOCH FROM CAST(? AS TIMESTAMP) - started_at)::INTEGER"
    );
  }

  fs.writeFileSync(filepath, content);
  console.log("Fixed:", relPath);
});
