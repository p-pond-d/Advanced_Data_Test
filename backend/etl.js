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
  const provincesList = Object.values(provinceMap); // 77 provinces
  const datesList = rawDates; // 365 days of 2025

  rawSales.forEach((sale, index) => {
    const customer = customerMap[sale.CustomerKey] || {};
    const product = productMap[sale.ProductKey] || {};
    
    // Distribute provinces evenly to ensure all 77 provinces are represented
    const province = provincesList[index % provincesList.length] || {};
    
    // Distribute dates evenly to ensure all months of 2025 are covered
    const dateObj = datesList[index % datesList.length] || {};
    const dateStr = dateObj.Date || '2025-06-15';
    
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
      ProvinceID: province.ProvinceKey ? String(province.ProvinceKey) : 'UnknownID',
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
        ProvinceID: province.ProvinceKey ? String(province.ProvinceKey) : 'UnknownID',
        Province: province.ProvinceName || 'Unknown Province',
        Region: province.Region || 'ภาคกลาง'
      });
    }
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
      ProvinceID VARCHAR(50),
      Province NVARCHAR(100),
      Region NVARCHAR(100)
    `;

    // Drop and Create pumpui_erp
    console.log("Recreating table pumpui_erp...");
    await pool.request().query(`
      IF OBJECT_ID('pumpui_erp', 'U') IS NOT NULL DROP TABLE pumpui_erp;
      CREATE TABLE pumpui_erp (${tableDefinition});
    `);

    // Drop and Create pumpui_show Star Schema
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
          ProvinceID VARCHAR(50) NOT NULL PRIMARY KEY,
          Province NVARCHAR(100) NOT NULL,
          Region NVARCHAR(100) NOT NULL
      );

      CREATE TABLE pumpui_show_fact (
          OrderID VARCHAR(50) NOT NULL PRIMARY KEY,
          OrderDate DATETIME NOT NULL,
          CustomerID VARCHAR(50) NOT NULL,
          ProductID VARCHAR(50) NOT NULL,
          ProvinceID VARCHAR(50) NOT NULL,
          Price FLOAT NOT NULL,
          Quantity INT NOT NULL,
          NetAmount FLOAT NOT NULL,
          CONSTRAINT FK_ShowFact_Customer FOREIGN KEY (CustomerID) REFERENCES pumpui_show_dim_customer(CustomerID),
          CONSTRAINT FK_ShowFact_Product FOREIGN KEY (ProductID) REFERENCES pumpui_show_dim_product(ProductID),
          CONSTRAINT FK_ShowFact_Geography FOREIGN KEY (ProvinceID) REFERENCES pumpui_show_dim_geography(ProvinceID)
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
          g.Province,
          g.Region
      FROM pumpui_show_fact f
      LEFT JOIN pumpui_show_dim_customer c ON f.CustomerID = c.CustomerID
      LEFT JOIN pumpui_show_dim_product p ON f.ProductID = p.ProductID
      LEFT JOIN pumpui_show_dim_geography g ON f.ProvinceID = g.ProvinceID;
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
        let insertQuery = "INSERT INTO pumpui_erp (OrderID, OrderDate, CustomerID, CustomerName, CustomerType, ProductID, ProductName, ProductCategory, Price, Quantity, NetAmount, ProvinceID, Province, Region) VALUES ";
        
        const valueStrings = batch.map((r) => {
          const escapedCustName = r.CustomerName.replace(/'/g, "''");
          const escapedProdName = r.ProductName.replace(/'/g, "''");
          const escapedCategory = r.ProductCategory.replace(/'/g, "''");
          const escapedProvince = r.Province.replace(/'/g, "''");
          const escapedRegion = r.Region.replace(/'/g, "''");
          
          return `('${r.OrderID}', '${r.OrderDate}', '${r.CustomerID}', N'${escapedCustName}', N'${escapedCustomerType(r.CustomerType)}', '${r.ProductID}', N'${escapedProdName}', N'${escapedCategory}', ${r.Price}, ${r.Quantity}, ${r.NetAmount}, '${r.ProvinceID}', N'${escapedProvince}', N'${escapedRegion}')`;
        });
        
        insertQuery += valueStrings.join(", ") + ";";
        await request.query(insertQuery);
      }
      
      await transaction.commit();
      console.log("ETL script loaded data into pumpui_erp successfully!");

      // Copy to pumpui_show (Star Schema) for initial setup
      console.log("Syncing initial data to pumpui_show Star Schema tables...");
      await pool.request().query(`
        DELETE FROM pumpui_show_fact;
        DELETE FROM pumpui_show_dim_customer;
        DELETE FROM pumpui_show_dim_product;
        DELETE FROM pumpui_show_dim_geography;

        INSERT INTO pumpui_show_dim_geography (ProvinceID, Province, Region)
        SELECT DISTINCT ProvinceID, Province, Region FROM pumpui_erp WHERE ProvinceID IS NOT NULL AND Province IS NOT NULL AND Region IS NOT NULL;

        INSERT INTO pumpui_show_dim_customer (CustomerID, CustomerName, CustomerType)
        SELECT DISTINCT CustomerID, CustomerName, CustomerType FROM pumpui_erp WHERE CustomerID IS NOT NULL;

        INSERT INTO pumpui_show_dim_product (ProductID, ProductName, ProductCategory)
        SELECT DISTINCT ProductID, ProductName, ProductCategory FROM pumpui_erp WHERE ProductID IS NOT NULL;

        INSERT INTO pumpui_show_fact (OrderID, OrderDate, CustomerID, ProductID, ProvinceID, Price, Quantity, NetAmount)
        SELECT OrderID, OrderDate, CustomerID, ProductID, ProvinceID, Price, Quantity, NetAmount FROM pumpui_erp;

        -- Apply Customer Name Masking in the database
        UPDATE pumpui_show_dim_customer
        SET CustomerName = LEFT(CustomerName, 4) + '***'
        WHERE CustomerName IS NOT NULL;
      `);
      console.log("Initial sync complete.");

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
