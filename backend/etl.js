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

async function runETL() {
  console.log("Starting ETL process for Loymalila...");
  
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`Error: Excel file not found at ${EXCEL_PATH}`);
    process.exit(1);
  }

  // 1. Read Excel file
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetNames = workbook.SheetNames;
  console.log("Sheets in workbook:", sheetNames);

  // 2. Parse sheets into memory
  const sheetsData = {};
  sheetNames.forEach(name => {
    const sheet = workbook.Sheets[name];
    sheetsData[name] = XLSX.utils.sheet_to_json(sheet);
  });

  const salesSheetKey = 'FactSales';
  const customerSheetKey = 'DimCustomer';
  const productSheetKey = 'DimProduct';
  const provinceSheetKey = 'DimProvince';
  const dateSheetKey = 'DimDate';

  const rawSales = sheetsData[salesSheetKey] || [];
  const rawCustomers = sheetsData[customerSheetKey] || [];
  const rawProducts = sheetsData[productSheetKey] || [];
  const rawProvinces = sheetsData[provinceSheetKey] || [];
  const rawDates = sheetsData[dateSheetKey] || [];

  console.log(`Loaded from Excel:`);
  console.log(`  - FactSales: ${rawSales.length} rows`);
  console.log(`  - DimCustomer: ${rawCustomers.length} rows`);
  console.log(`  - DimProduct: ${rawProducts.length} rows`);
  console.log(`  - DimProvince: ${rawProvinces.length} rows`);
  console.log(`  - DimDate: ${rawDates.length} rows`);

  // Index dimensional tables for quick lookup joins
  const customerMap = {};
  rawCustomers.forEach(c => {
    customerMap[c.CustomerKey] = c;
  });

  const productMap = {};
  rawProducts.forEach(p => {
    productMap[p.ProductKey] = p;
  });

  const provinceMap = {};
  rawProvinces.forEach(p => {
    provinceMap[p.ProvinceKey] = p;
  });

  const dateMap = {};
  rawDates.forEach(d => {
    dateMap[d.DateKey] = d.Date; // Holds Date ISO string like "2025-01-01"
  });

  const consolidatedData = [];

  rawSales.forEach((sale, index) => {
    const customer = customerMap[sale.CustomerKey] || {};
    const product = productMap[sale.ProductKey] || {};
    const province = provinceMap[sale.ProvinceKey] || {};
    const dateStr = dateMap[sale.DateKey] || '2025-06-15';
    
    // Format date properly for SQL Server
    const orderDate = new Date(dateStr);
    const sqlDateStr = orderDate.toISOString().slice(0, 19).replace('T', ' ');

    consolidatedData.push({
      OrderID: String(sale.SalesKey),
      OrderDate: sqlDateStr,
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
  });

  console.log(`Successfully flattened and joined ${consolidatedData.length} records in memory.`);

  // 4. Connect to database and load data
  let pool;
  try {
    console.log(`Connecting to MSSQL database: ${dbConfig.server}...`);
    pool = await sql.connect(dbConfig);
    console.log("Connected successfully.");

    // Table definition SQL
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

    // Drop and Create pumpui_erp
    console.log("Recreating table pumpui_erp...");
    await pool.request().query(`
      IF OBJECT_ID('pumpui_erp', 'U') IS NOT NULL DROP TABLE pumpui_erp;
      CREATE TABLE pumpui_erp (${tableDefinition});
    `);

    // Drop and Create pumpui_show
    console.log("Recreating table pumpui_show...");
    await pool.request().query(`
      IF OBJECT_ID('pumpui_show', 'U') IS NOT NULL DROP TABLE pumpui_show;
      CREATE TABLE pumpui_show (${tableDefinition});
    `);

    // Bulk insert records into pumpui_erp
    console.log("Inserting records into pumpui_erp...");
    
    // We use a transaction and prepare statement or batch insertions
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      const request = new sql.Request(transaction);
      
      // Batch inserts of 100 records at a time
      const batchSize = 100;
      for (let i = 0; i < consolidatedData.length; i += batchSize) {
        const batch = consolidatedData.slice(i, i + batchSize);
        let insertQuery = "INSERT INTO pumpui_erp (OrderID, OrderDate, CustomerID, CustomerName, CustomerType, ProductID, ProductName, ProductCategory, Price, Quantity, NetAmount, Province, Region) VALUES ";
        
        const valueStrings = batch.map((r) => {
          const escapedCustName = r.CustomerName.replace(/'/g, "''");
          const escapedProdName = r.ProductName.replace(/'/g, "''");
          const escapedCategory = r.ProductCategory.replace(/'/g, "''");
          const escapedProvince = r.Province.replace(/'/g, "''");
          const escapedRegion = r.Region.replace(/'/g, "''");
          
          return `('${r.OrderID}', '${r.OrderDate}', '${r.CustomerID}', N'${escapedCustName}', N'${escapedCustomerType(r.CustomerType)}', '${r.ProductID}', N'${escapedProdName}', N'${escapedCategory}', ${r.Price}, ${r.Quantity}, ${r.NetAmount}, N'${escapedProvince}', N'${escapedRegion}')`;
        });
        
        insertQuery += valueStrings.join(", ") + ";";
        await request.query(insertQuery);
      }
      
      await transaction.commit();
      console.log("ETL script loaded data into pumpui_erp successfully!");

      // Copy to pumpui_show for initial setup
      console.log("Syncing initial data to pumpui_show...");
      await pool.request().query("INSERT INTO pumpui_show SELECT * FROM pumpui_erp;");
      console.log("Initial sync complete. Both tables are identical.");

    } catch (err) {
      await transaction.rollback();
      throw err;
    }

  } catch (err) {
    console.error("Database ETL Error:", err.message);
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

runETL();
