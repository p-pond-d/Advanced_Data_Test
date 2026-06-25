const XLSX = require('xlsx');
const fs = require('fs');

try {
  if (!fs.existsSync('Loymalila_SalesDataMart.xlsx')) {
    console.error("Error: Loymalila_SalesDataMart.xlsx not found!");
    process.exit(1);
  }

  console.log("Reading Loymalila_SalesDataMart.xlsx...");
  const workbook = XLSX.readFile('Loymalila_SalesDataMart.xlsx');
  
  console.log("Sheet names found:", workbook.SheetNames);
  
  workbook.SheetNames.forEach(sheetName => {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`Total rows: ${data.length}`);
    if (data.length > 0) {
      console.log("Columns:", Object.keys(data[0]));
      console.log("Sample Data (First 2 rows):", JSON.stringify(data.slice(0, 2), null, 2));
    } else {
      console.log("Empty sheet");
    }
  });

} catch (err) {
  console.error("Error processing workbook:", err.message);
}
