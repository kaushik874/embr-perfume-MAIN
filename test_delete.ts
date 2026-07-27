import { initDb, db } from "./server/db.js";

async function test() {
  await initDb();
  
  try {
    const ids = [1, 2, 3];
    const placeholders = ids.map(() => "?").join(",");
    
    // First let's check if the table has any rows for these ids
    const items = await db.prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`).all(...ids);
    console.log("Items to delete:", items.length);
    
    await db.prepare(`DELETE FROM order_items WHERE order_id IN (${placeholders})`).run(...ids);
    console.log("Deleted order items");
    
    await db.prepare(`DELETE FROM orders WHERE id IN (${placeholders})`).run(...ids);
    console.log("Deleted orders");
    
  } catch (err) {
    console.error("Test failed:", err);
  }
  process.exit(0);
}
test();
