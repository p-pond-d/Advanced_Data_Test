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
async function run() {
  console.log("Connecting to database...");
  const pool = await sql.connect(dbConfig);
  try {
    console.log("Checking if pumpui_sync_log table exists...");
    const checkTable = await pool.request().query("SELECT OBJECT_ID('pumpui_sync_log', 'U') as tableId");
    if (checkTable.recordset[0].tableId) {
      console.log("Table exists. Checking errorDetails column...");
      const checkCol = await pool.request().query("SELECT COL_LENGTH('pumpui_sync_log', 'errorDetails') as colLen");
      if (checkCol.recordset[0].colLen === null) {
        console.log("Column errorDetails is missing. Adding it...");
        await pool.request().query("ALTER TABLE pumpui_sync_log ADD errorDetails NVARCHAR(MAX)");
        console.log("Column added successfully.");
      } else {
        console.log("Column errorDetails already exists.");
      }
    } else {
      console.log("Table pumpui_sync_log does not exist. Creating it...");
      await pool.request().query(`
        CREATE TABLE pumpui_sync_log (
            SyncID INT IDENTITY(1,1) PRIMARY KEY,
            SyncDate DATETIME DEFAULT GETDATE(),
            NewRecords INT,
            ModifiedRecords INT,
            TotalRecords INT,
            errorDetails NVARCHAR(MAX)
        );
      `);
      console.log("Table created successfully.");
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await sql.close();
    console.log("Connection closed.");
  }
}
run();
