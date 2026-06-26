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

async function introduceErrors() {
  console.log("Connecting to database to introduce errors into pumpui_erp...");
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    console.log("Connected successfully.");

    // Fetch all OrderIDs from pumpui_erp
    const result = await pool.request().query("SELECT OrderID FROM pumpui_erp");
    const records = result.recordset;
    console.log(`Found ${records.length} records in pumpui_erp.`);

    if (records.length === 0) {
      console.warn("No records found in pumpui_erp. Please run ETL script first.");
      return;
    }

    // Shuffle the records to pick a random 5%
    const shuffled = [...records].sort(() => 0.5 - Math.random());
    const countToUpdate = Math.floor(records.length * 0.05); // 5% of records
    const targets = shuffled.slice(0, countToUpdate);
    console.log(`Introducing errors into ${countToUpdate} records (5%)...`);

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = new sql.Request(transaction);
      
      for (let i = 0; i < targets.length; i++) {
        const orderId = targets[i].OrderID;
        
        // Distribute different types of errors
        const errorType = i % 5;
        let updateQuery = "";

        if (errorType === 0) {
          // Negative values
          updateQuery = `UPDATE pumpui_erp SET Quantity = -5, NetAmount = -150 WHERE OrderID = '${orderId}'`;
        } else if (errorType === 1) {
          // Null numeric values
          updateQuery = `UPDATE pumpui_erp SET NetAmount = NULL WHERE OrderID = '${orderId}'`;
        } else if (errorType === 2) {
          // Null dimension values
          updateQuery = `UPDATE pumpui_erp SET Region = NULL, Province = NULL WHERE OrderID = '${orderId}'`;
        } else if (errorType === 3) {
          // Empty strings
          updateQuery = `UPDATE pumpui_erp SET Region = '', Province = '' WHERE OrderID = '${orderId}'`;
        } else {
          // Multiple null values
          updateQuery = `UPDATE pumpui_erp SET CustomerID = NULL, ProductID = NULL WHERE OrderID = '${orderId}'`;
        }

        await request.query(updateQuery);
      }

      await transaction.commit();
      console.log(`Successfully corrupted ${countToUpdate} records in pumpui_erp with negative/null/empty errors!`);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

  } catch (err) {
    console.error("Database Error:", err.message);
  } finally {
    if (pool) {
      await sql.close();
      console.log("Database connection closed.");
    }
  }
}

introduceErrors();
