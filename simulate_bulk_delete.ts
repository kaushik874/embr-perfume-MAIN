import { initDb, db } from "./server/db.js";

async function run() {
  await initDb();
  
  const userId = 1;

  // Insert 5 orders
  const ids: number[] = [];
  for (let i = 0; i < 5; i++) {
    const res = await db.prepare("INSERT INTO orders (user_id, status, total_paise, shipping_name, shipping_email, shipping_phone, shipping_address, shipping_city, shipping_pincode) VALUES (?, 'pending', 100, 'T', 'T', 'T', 'T', 'T', 'T')").run(userId);
    ids.push(res.lastInsertRowid as number);
  }
  
  console.log("Created orders:", ids);
  
  // Now let's try to simulate the exact bulk-delete code
  try {
    const placeholders = ids.map(() => "?").join(",");
    
    console.log(`Deleting items with placeholders: ${placeholders} for ids:`, ids);
    await db.prepare(`DELETE FROM order_items WHERE order_id IN (${placeholders})`).run(...ids);
    console.log("Deleted items");
    
    await db.prepare(`DELETE FROM reviews WHERE order_id IN (${placeholders})`).run(...ids);
    console.log("Deleted reviews");
    
    await db.prepare(`DELETE FROM orders WHERE id IN (${placeholders})`).run(...ids);
    console.log("Deleted orders");
    
  } catch (err) {
    console.error("Simulation failed:", err);
  }
  
  process.exit(0);
}
run();
