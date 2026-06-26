const XLSX = require('xlsx');
const sql = require('mssql');
const path = require('path');
const fs = require('fs');
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

const EXCEL_PATH = path.join(__dirname, '..', 'Loymalila_SalesDataMart.xlsx');

async function runUpdate() {
  console.log("Starting Loymalila Database Update Script...");
  
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`Error: Excel file not found at ${EXCEL_PATH}`);
    process.exit(1);
  }

  // 1. Read and parse Excel file
  console.log("Reading Excel data mart...");
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetsData = {};
  workbook.SheetNames.forEach(name => {
    const sheet = workbook.Sheets[name];
    sheetsData[name] = XLSX.utils.sheet_to_json(sheet);
  });

  const rawSales = sheetsData['FactSales'] || [];
  const rawCustomers = sheetsData['DimCustomer'] || [];
  const rawProducts = sheetsData['DimProduct'] || [];
  const rawProvinces = sheetsData['DimProvince'] || [];
  const rawDates = sheetsData['DimDate'] || [];

  console.log(`Loaded from Excel: ${rawSales.length} sales records.`);

  // Create dimension lookups
  const customerMap = {};
  rawCustomers.forEach(c => { customerMap[c.CustomerKey] = c; });

  const productMap = {};
  rawProducts.forEach(p => { productMap[p.ProductKey] = p; });

  const provinceMap = {};
  rawProvinces.forEach(p => { provinceMap[p.ProvinceKey] = p; });

  const dateMap = {};
  rawDates.forEach(d => { dateMap[d.DateKey] = d.Date; });

  const consolidatedData = [];

  // Generate 2025 baseline and 2026 data up to 2026-06-24
  rawSales.forEach((sale) => {
    const customer = customerMap[sale.CustomerKey] || {};
    const product = productMap[sale.ProductKey] || {};
    const province = provinceMap[sale.ProvinceKey] || {};
    const dateStr = dateMap[sale.DateKey] || '2025-06-15';
    
    const orderDate2025 = new Date(dateStr);
    
    // Add the 2025 record
    const sqlDateStr2025 = orderDate2025.toISOString().slice(0, 19).replace('T', ' ');
    consolidatedData.push({
      OrderID: String(sale.SalesKey),
      OrderDate: sqlDateStr2025,
      CustomerID: String(sale.CustomerKey),
      CustomerName: customer.CustomerName || 'Unknown Customer',
      CustomerType: customer.CustomerType || 'Individual',
      ProductID: String(sale.ProductKey),
      ProductName: product.ProductName || 'Unknown Product',
      ProductCategory: product.Category || 'General',
      Price: sale.UnitPrice || product.StandardUnitPrice || 0,
      Quantity: sale.Qty || 0,
      NetAmount: sale.NetAmount || (sale.Qty * (sale.UnitPrice || product.StandardUnitPrice || 0)),
      Province: province.ProvinceName || 'Unknown Province',
      Region: province.Region || 'ภาคกลาง'
    });

    // Check if duplicate for 2026 is <= 2026-06-24
    const orderDate2026 = new Date(orderDate2025);
    orderDate2026.setFullYear(2026);
    
    const cutOffDate = new Date('2026-06-24T23:59:59');
    if (orderDate2026 <= cutOffDate) {
      const sqlDateStr2026 = orderDate2026.toISOString().slice(0, 19).replace('T', ' ');
      consolidatedData.push({
        OrderID: String(Number(sale.SalesKey) + 200000), // Unique OrderID offset for 2026
        OrderDate: sqlDateStr2026,
        CustomerID: String(sale.CustomerKey),
        CustomerName: customer.CustomerName || 'Unknown Customer',
        CustomerType: customer.CustomerType || 'Individual',
        ProductID: String(sale.ProductKey),
        ProductName: product.ProductName || 'Unknown Product',
        ProductCategory: product.Category || 'General',
        Price: sale.UnitPrice || product.StandardUnitPrice || 0,
        Quantity: sale.Qty || 0,
        NetAmount: sale.NetAmount || (sale.Qty * (sale.UnitPrice || product.StandardUnitPrice || 0)),
        Province: province.ProvinceName || 'Unknown Province',
        Region: province.Region || 'ภาคกลาง'
      });
    }
  });

  // Force the latest 2026 record to end exactly on 2026-06-24
  const records2026 = consolidatedData.filter(r => r.OrderDate.startsWith('2026'));
  if (records2026.length > 0) {
    records2026.sort((a, b) => new Date(a.OrderDate) - new Date(b.OrderDate));
    const latestRecord = records2026[records2026.length - 1];
    latestRecord.OrderDate = '2026-06-24 12:00:00';
    console.log(`Forced latest 2026 record (OrderID: ${latestRecord.OrderID}) date to: ${latestRecord.OrderDate}`);
  }

  console.log(`Generated ${consolidatedData.length} total records (2025 baseline + 2026 to June 24).`);

  let pool;
  try {
    console.log(`Connecting to MSSQL database: ${dbConfig.server}...`);
    pool = await sql.connect(dbConfig);
    console.log("Connected successfully.");

    const tableDefinition = `
      OrderID VARCHAR(50) NOT NULL,
      OrderDate DATETIME NOT NULL,
      CustomerID VARCHAR(50),
      CustomerName NVARCHAR(255),
      CustomerType NVARCHAR(50),
      ProductID VARCHAR(50),
      ProductName NVARCHAR(255),
      ProductCategory NVARCHAR(100),
      Price FLOAT,
      Quantity INT,
      NetAmount FLOAT,
      Province NVARCHAR(100),
      Region NVARCHAR(100)
    `;

    // Drop and Create tables
    console.log("Recreating table pumpui_erp...");
    await pool.request().query(`
      IF OBJECT_ID('pumpui_erp', 'U') IS NOT NULL DROP TABLE pumpui_erp;
      CREATE TABLE pumpui_erp (${tableDefinition});
    `);

    console.log("Recreating Star Schema tables and view for pumpui_show...");
    await pool.request().query(`
      IF OBJECT_ID('pumpui_show', 'V') IS NOT NULL DROP VIEW pumpui_show;
      IF OBJECT_ID('pumpui_show', 'U') IS NOT NULL DROP TABLE pumpui_show;
      IF OBJECT_ID('pumpui_show_fact', 'U') IS NOT NULL DROP TABLE pumpui_show_fact;
      IF OBJECT_ID('pumpui_show_dim_customer', 'U') IS NOT NULL DROP TABLE pumpui_show_dim_customer;
      IF OBJECT_ID('pumpui_show_dim_product', 'U') IS NOT NULL DROP TABLE pumpui_show_dim_product;
      IF OBJECT_ID('pumpui_show_dim_geography', 'U') IS NOT NULL DROP TABLE pumpui_show_dim_geography;

      CREATE TABLE pumpui_show_dim_customer (
          CustomerID VARCHAR(50) NOT NULL PRIMARY KEY,
          CustomerName NVARCHAR(255) NOT NULL,
          CustomerType NVARCHAR(50) NOT NULL
      );

      CREATE TABLE pumpui_show_dim_product (
          ProductID VARCHAR(50) NOT NULL PRIMARY KEY,
          ProductName NVARCHAR(255) NOT NULL,
          ProductCategory NVARCHAR(100) NOT NULL
      );

      CREATE TABLE pumpui_show_dim_geography (
          Province NVARCHAR(100) NOT NULL PRIMARY KEY,
          Region NVARCHAR(100) NOT NULL
      );

      CREATE TABLE pumpui_show_fact (
          OrderID VARCHAR(50) NOT NULL PRIMARY KEY,
          OrderDate DATETIME NOT NULL,
          CustomerID VARCHAR(50) NOT NULL,
          ProductID VARCHAR(50) NOT NULL,
          Province NVARCHAR(100) NOT NULL,
          Price FLOAT NOT NULL,
          Quantity INT NOT NULL,
          NetAmount FLOAT NOT NULL,
          CONSTRAINT FK_ShowFact_Customer FOREIGN KEY (CustomerID) REFERENCES pumpui_show_dim_customer(CustomerID),
          CONSTRAINT FK_ShowFact_Product FOREIGN KEY (ProductID) REFERENCES pumpui_show_dim_product(ProductID),
          CONSTRAINT FK_ShowFact_Geography FOREIGN KEY (Province) REFERENCES pumpui_show_dim_geography(Province)
      );
    `);

    await pool.request().query(`
      CREATE VIEW pumpui_show AS
      SELECT 
          f.OrderID,
          f.OrderDate,
          f.CustomerID,
          c.CustomerName,
          c.CustomerType,
          f.ProductID,
          p.ProductName,
          p.ProductCategory,
          f.Price,
          f.Quantity,
          f.NetAmount,
          f.Province,
          g.Region
      FROM pumpui_show_fact f
      LEFT JOIN pumpui_show_dim_customer c ON f.CustomerID = c.CustomerID
      LEFT JOIN pumpui_show_dim_product p ON f.ProductID = p.ProductID
      LEFT JOIN pumpui_show_dim_geography g ON f.Province = g.Province;
    `);

    // Bulk insert
    console.log("Inserting records into pumpui_erp...");
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const request = new sql.Request(transaction);
      const batchSize = 100;
      for (let i = 0; i < consolidatedData.length; i += batchSize) {
        const batch = consolidatedData.slice(i, i + batchSize);
        let insertQuery = "INSERT INTO pumpui_erp (OrderID, OrderDate, CustomerID, CustomerName, CustomerType, ProductID, ProductName, ProductCategory, Price, Quantity, NetAmount, Province, Region) VALUES ";
        
        const valueStrings = batch.map((r) => {
          const escapedCustName = r.CustomerName.replace(/'/g, "''");
          const escapedProdName = r.ProductName.replace(/'/g, "''");
          const escapedCategory = r.ProductCategory.replace(/'/g, "''");
          const escapedProvince = r.Province.replace(/'/g, "''");
          const escapedRegion = r.Region ? r.Region.replace(/'/g, "''") : 'NULL';
          
          const regionVal = r.Region ? `N'${escapedRegion}'` : 'NULL';
          const provinceVal = r.Province ? `N'${escapedProvince}'` : 'NULL';
          const custNameVal = r.CustomerName ? `N'${escapedCustName}'` : 'NULL';
          const prodNameVal = r.ProductName ? `N'${escapedProdName}'` : 'NULL';
          const catVal = r.ProductCategory ? `N'${escapedCategory}'` : 'NULL';
          
          return `('${r.OrderID}', '${r.OrderDate}', '${r.CustomerID}', ${custNameVal}, N'${escapedCustomerType(r.CustomerType)}', '${r.ProductID}', ${prodNameVal}, ${catVal}, ${r.Price}, ${r.Quantity}, ${r.NetAmount}, ${provinceVal}, ${regionVal})`;
        });
        
        insertQuery += valueStrings.join(", ") + ";";
        await request.query(insertQuery);
      }
      await transaction.commit();
      console.log("ERP insertion complete.");
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    // Corrupt exactly 7% of records
    console.log("Introducing exactly 7% errors into pumpui_erp...");
    const countToUpdate = Math.round(consolidatedData.length * 0.07);
    
    // Shuffling order ids to select random records
    const allOrderIds = consolidatedData.map(r => r.OrderID);
    for (let i = allOrderIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allOrderIds[i], allOrderIds[j]] = [allOrderIds[j], allOrderIds[i]];
    }
    const targetOrderIds = allOrderIds.slice(0, countToUpdate);
    console.log(`Selected ${countToUpdate} records to corrupt.`);

    const updateTransaction = new sql.Transaction(pool);
    await updateTransaction.begin();
    try {
      const request = new sql.Request(updateTransaction);
      for (let i = 0; i < targetOrderIds.length; i++) {
        const orderId = targetOrderIds[i];
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
      await updateTransaction.commit();
      console.log(`Corrupted exactly ${countToUpdate} records in pumpui_erp.`);
    } catch (err) {
      await updateTransaction.rollback();
      throw err;
    }

    // Simulating n8n synchronization
    console.log("Synchronizing valid records to pumpui_show...");
    const syncQuery = `
      IF OBJECT_ID('pumpui_sync_log', 'U') IS NULL
      BEGIN
          CREATE TABLE pumpui_sync_log (
              SyncID INT IDENTITY(1,1) PRIMARY KEY,
              SyncDate DATETIME DEFAULT GETDATE(),
              NewRecords INT,
              ModifiedRecords INT,
              TotalRecords INT,
              errorDetails NVARCHAR(MAX)
          );
      END
      ELSE
      BEGIN
          IF COL_LENGTH('pumpui_sync_log', 'errorDetails') IS NULL
          BEGIN
              ALTER TABLE pumpui_sync_log ADD errorDetails NVARCHAR(MAX);
          END
      END

      DECLARE @ModifiedDetails TABLE (
          OrderID VARCHAR(50),
          CustomerName NVARCHAR(255),
          ProductName NVARCHAR(255),
          OldNetAmount FLOAT,
          NewNetAmount FLOAT,
          OldQuantity INT,
          NewQuantity INT,
          OldPrice FLOAT,
          NewPrice FLOAT
      );

      INSERT INTO @ModifiedDetails
      SELECT 
          e.OrderID,
          e.CustomerName,
          e.ProductName,
          s.NetAmount AS OldNetAmount,
          e.NetAmount AS NewNetAmount,
          s.Quantity AS OldQuantity,
          e.Quantity AS NewQuantity,
          s.Price AS OldPrice,
          e.Price AS NewPrice
      FROM pumpui_erp e
      INNER JOIN pumpui_show s ON s.OrderID = e.OrderID
      WHERE s.NetAmount <> e.NetAmount OR s.Quantity <> e.Quantity OR s.Price <> e.Price;

      DECLARE @new_count INT;
      DECLARE @mod_count INT;
      DECLARE @total_count INT;
      DECLARE @error_count INT;
      DECLARE @error_details_str NVARCHAR(MAX);

      SELECT @new_count = COUNT(*) 
      FROM pumpui_erp e
      WHERE NOT EXISTS (SELECT 1 FROM pumpui_show s WHERE s.OrderID = e.OrderID);

      SELECT @mod_count = COUNT(*) FROM @ModifiedDetails;

      SELECT @total_count = COUNT(*) FROM pumpui_erp;

      -- Calculate dynamic errorDetails string
      DECLARE @ErrorOrderIDs TABLE (OrderID VARCHAR(50));
      INSERT INTO @ErrorOrderIDs
      SELECT OrderID FROM pumpui_erp
      WHERE OrderID IS NULL OR OrderDate IS NULL OR CustomerID IS NULL OR ProductID IS NULL OR NetAmount IS NULL OR NetAmount < 0 OR Quantity IS NULL OR Quantity < 0 OR Price IS NULL OR Price < 0 OR Region IS NULL OR Region = '' OR Province IS NULL OR Province = '';

      SELECT @error_count = COUNT(*) FROM @ErrorOrderIDs;

      DECLARE @Top5 NVARCHAR(MAX);
      SET @Top5 = '';

      SELECT @Top5 = COALESCE(@Top5 + ', ', '') + OrderID
      FROM (
          SELECT TOP 5 OrderID FROM @ErrorOrderIDs ORDER BY OrderID
      ) t;

      IF LEN(@Top5) > 2
      BEGIN
          SET @Top5 = SUBSTRING(@Top5, 3, LEN(@Top5) - 2);
      END

      IF @error_count > 5
      BEGIN
          DECLARE @remaining INT;
          SET @remaining = @error_count - 5;
          SET @error_details_str = @Top5 + N' (และอีก ' + CAST(@remaining AS NVARCHAR(50)) + N' รายการ)';
      END
      ELSE
      BEGIN
          SET @error_details_str = @Top5;
      END

      INSERT INTO pumpui_sync_log (SyncDate, NewRecords, ModifiedRecords, TotalRecords, errorDetails)
      VALUES (GETDATE(), @new_count, @mod_count, @total_count, @error_details_str);

      DELETE FROM pumpui_show_fact;
      DELETE FROM pumpui_show_dim_customer;
      DELETE FROM pumpui_show_dim_product;
      DELETE FROM pumpui_show_dim_geography;

      INSERT INTO pumpui_show_dim_geography (Province, Region)
      SELECT DISTINCT Province, Region
      FROM pumpui_erp
      WHERE OrderID IS NOT NULL AND OrderDate IS NOT NULL AND CustomerID IS NOT NULL AND ProductID IS NOT NULL AND NetAmount IS NOT NULL AND NetAmount >= 0 AND Quantity IS NOT NULL AND Quantity >= 0 AND Price IS NOT NULL AND Price >= 0 AND Region IS NOT NULL AND Region <> '' AND Province IS NOT NULL AND Province <> '';

      INSERT INTO pumpui_show_dim_customer (CustomerID, CustomerName, CustomerType)
      SELECT DISTINCT CustomerID, CustomerName, CustomerType
      FROM pumpui_erp
      WHERE OrderID IS NOT NULL AND OrderDate IS NOT NULL AND CustomerID IS NOT NULL AND ProductID IS NOT NULL AND NetAmount IS NOT NULL AND NetAmount >= 0 AND Quantity IS NOT NULL AND Quantity >= 0 AND Price IS NOT NULL AND Price >= 0 AND Region IS NOT NULL AND Region <> '' AND Province IS NOT NULL AND Province <> '';

      INSERT INTO pumpui_show_dim_product (ProductID, ProductName, ProductCategory)
      SELECT DISTINCT ProductID, ProductName, ProductCategory
      FROM pumpui_erp
      WHERE OrderID IS NOT NULL AND OrderDate IS NOT NULL AND CustomerID IS NOT NULL AND ProductID IS NOT NULL AND NetAmount IS NOT NULL AND NetAmount >= 0 AND Quantity IS NOT NULL AND Quantity >= 0 AND Price IS NOT NULL AND Price >= 0 AND Region IS NOT NULL AND Region <> '' AND Province IS NOT NULL AND Province <> '';

      INSERT INTO pumpui_show_fact (OrderID, OrderDate, CustomerID, ProductID, Province, Price, Quantity, NetAmount)
      SELECT OrderID, OrderDate, CustomerID, ProductID, Province, Price, Quantity, NetAmount
      FROM pumpui_erp
      WHERE OrderID IS NOT NULL AND OrderDate IS NOT NULL AND CustomerID IS NOT NULL AND ProductID IS NOT NULL AND NetAmount IS NOT NULL AND NetAmount >= 0 AND Quantity IS NOT NULL AND Quantity >= 0 AND Price IS NOT NULL AND Price >= 0 AND Region IS NOT NULL AND Region <> '' AND Province IS NOT NULL AND Province <> '';
    `;
    await pool.request().query(syncQuery);
    console.log("Synchronization complete.");

    // Verification Report
    console.log("\n--- VERIFICATION REPORT ---");
    const erpCountRes = await pool.request().query("SELECT COUNT(*) as cnt FROM pumpui_erp");
    const erpTotal = erpCountRes.recordset[0].cnt;
    console.log(`Total records in pumpui_erp : ${erpTotal}`);

    const showCountRes = await pool.request().query("SELECT COUNT(*) as cnt FROM pumpui_show");
    const showTotal = showCountRes.recordset[0].cnt;
    console.log(`Total records in pumpui_show: ${showTotal}`);

    const errorCountRes = await pool.request().query(`
      SELECT COUNT(*) as cnt FROM pumpui_erp 
      WHERE Quantity < 0 OR NetAmount IS NULL OR Region IS NULL OR Region = '' OR CustomerID IS NULL
    `);
    const erpErrors = errorCountRes.recordset[0].cnt;
    console.log(`Corrupted records in pumpui_erp : ${erpErrors}`);
    
    const calculatedErrorRate = (erpErrors / erpTotal * 100).toFixed(2);
    console.log(`Actual Error Rate: ${calculatedErrorRate}% (Target: 7.00%)`);

    const dateRangeRes = await pool.request().query("SELECT MIN(OrderDate) as minDate, MAX(OrderDate) as maxDate FROM pumpui_erp");
    console.log(`Date range in pumpui_erp : Min = ${dateRangeRes.recordset[0].minDate.toISOString()}, Max = ${dateRangeRes.recordset[0].maxDate.toISOString()}`);
    console.log("---------------------------\n");

    console.log("Database update completed successfully!");

  } catch (err) {
    console.error("Database error occurred:", err.message);
  } finally {
    if (pool) {
      await sql.close();
      console.log("Database connection closed.");
    }
  }
}

function escapedCustomerType(type) {
  if (!type) return 'Individual';
  if (type.toLowerCase().includes('company') || type.includes('บริษัท')) {
    return 'Company';
  }
  return 'Individual';
}

runUpdate();
