const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

async function checkDb() {
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    console.log("Connected to database successfully.");
    
    const countResult = await pool.request().query("SELECT COUNT(*) as cnt FROM pumpui_erp");
    console.log("Total records in pumpui_erp:", countResult.recordset[0].cnt);
    
    const dateResult = await pool.request().query("SELECT MIN(OrderDate) as minDate, MAX(OrderDate) as maxDate FROM pumpui_erp");
    console.log("Date range in pumpui_erp:", dateResult.recordset[0]);

    const errorCountResult = await pool.request().query(`
      SELECT COUNT(*) as err_cnt FROM pumpui_erp 
      WHERE Quantity < 0 OR NetAmount IS NULL OR Region IS NULL OR Region = '' OR CustomerID IS NULL
    `);
    console.log("Records with errors in pumpui_erp:", errorCountResult.recordset[0].err_cnt);

  } catch (err) {
    console.error("Error checking db:", err.message);
  } finally {
    if (pool) {
      await sql.close();
    }
  }
}

checkDb();
