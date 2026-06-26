# รายงานสถาปัตยกรรมระบบ Loymalila Analytics & n8n Automation Sync
เอกสารฉบับนี้จัดทำขึ้นเพื่ออธิบายสถาปัตยกรรมการจัดการข้อมูล (Data Architecture) โครงสร้างฐานข้อมูล (Database Schema) เวิร์กโฟลว์การทำงานของ n8n และรายละเอียดคำอธิบายโค้ดทั้งหมดอย่างรอบด้านในระบบ **Loymalila Analytics**

---

## 1. ภาพรวมสถาปัตยกรรมระบบ (System Architecture Overview)

ระบบบริหารข้อมูลและการแสดงผล Loymalila Analytics ทำงานแบบแยกส่วน (Decoupled Architecture) แบ่งการทำงานออกเป็น 3 เลเยอร์หลัก:
1. **Data Ingestion & Simulation**: จำลองยอดขาย ERP และคุณภาพข้อมูลด้วย Node.js (`update_database.js`)
2. **Data Orchestration & Cleansing (n8n)**: ตรวจสอบความถูกต้อง ทำความสะอาดข้อมูล มาสก์ข้อมูลอ่อนไหว และแจ้งเตือนผลลัพธ์ผ่าน LINE API
3. **Application & Visualisation**: ให้บริการ APIs ข้อมูลด้วย Express และประมวลผลวาดกราฟและแผนที่ประเทศไทย 77 จังหวัดด้วย React (Vite)

```mermaid
graph TD
    %% Define styles
    classDef excel fill:#217346,stroke:#ffffff,stroke-width:2px,color:#ffffff;
    classDef node fill:#334155,stroke:#475569,stroke-width:2px,color:#ffffff;
    classDef db fill:#00758f,stroke:#ffffff,stroke-width:2px,color:#ffffff;
    classDef api fill:#e11d48,stroke:#ffffff,stroke-width:2px,color:#ffffff;
    classDef react fill:#0ea5e9,stroke:#ffffff,stroke-width:2px,color:#ffffff;
    classDef n8n fill:#ff6c37,stroke:#ffffff,stroke-width:2px,color:#ffffff;
    
    Excel["DimCustomer, DimProduct, DimProvince, FactSales<br>(Excel Data Mart: 2025)"]:::excel
    
    subgraph ETL_Seeding ["1. ETL & Seeding Stage (Node.js)"]
        LoadExcel["อ่าน Excel & จัดกลุ่ม 77 จังหวัด"]:::node
        Extend2026["จำลองยอดปี 2026 (ขยายข้อมูลเป็น 2,220 แถว)"]:::node
        CorruptData["สุ่มทำลายข้อมูลดิบ 5% (111 แถว)"]:::node
        RawDB[("ตารางข้อมูลดิบสำหรับ ERP<br>[pumpui_erp]<br>(มีข้อผิดพลาด 5%)")]:::db
    end
    
    Excel --> LoadExcel --> Extend2026 --> CorruptData -->|Bulk Insert| RawDB
    
    subgraph n8n_Engine ["2. n8n Automation Sync (Cron / 05:00 AM)"]
        CronTrigger(["Cron Trigger 05:00 AM"]):::n8n
        SQLSync["MSSQL Sync Execution<br>- กรองข้อมูลเสีย<br>- มาสก์ข้อมูลลูกค้า (PII)<br>- คิวรี New/Modified / Error"]:::n8n
        LineSuccess["LINE Push API<br>(ส่งสถิติความสำเร็จสำเร็จ)"]:::n8n
        ErrorTrigger(["Error Trigger"]):::n8n
        LineError["LINE Push API<br>(แจ้งเตือนระบบขัดข้อง)"]:::n8n
    end
    
    CronTrigger --> SQLSync
    SQLSync -->|ซิงค์สำเร็จ| LineSuccess
    SQLSync -.->|มีข้อผิดพลาด/คิวรีพัง| ErrorTrigger --> LineError
    
    subgraph Data_Storage ["3. Star Schema Data Warehouse"]
        ShowFact[("ตาราง Fact Table<br>[pumpui_show_fact]")]:::db
        ShowDimCust[("ตาราง Customer Dim<br>[pumpui_show_dim_customer]<br>(ชื่อถูก Mask ปิดท้ายด้วย ***)")]:::db
        ShowDimProd[("ตาราง Product Dim<br>[pumpui_show_dim_product]")]:::db
        ShowDimGeo[("ตาราง Geography Dim<br>[pumpui_show_dim_geography]")]:::db
        ShowView[("Dynamic View<br>[pumpui_show]")]:::db
    end
    
    RawDB -->|อ่านข้อมูลดิบ| SQLSync
    SQLSync -->|เขียนทับออเดอร์ดี| ShowFact
    SQLSync -->|เขียนทับลูกค้าดี| ShowDimCust
    SQLSync -->|เขียนทับสินค้าดี| ShowDimProd
    SQLSync -->|เขียนทับพิกัดดี| ShowDimGeo
    
    ShowFact --> ShowView
    ShowDimCust --> ShowView
    ShowDimProd --> ShowView
    ShowDimGeo --> ShowView
    
    subgraph App_Representation ["4. Presentation Layer"]
        ExpressAPI["Express Backend APIs<br>(พอร์ต 5000)"]:::api
        ReactApp["React Frontend Dashboard<br>(พอร์ต 3000)"]:::react
    end
    
    ShowView -->|ดึงข้อมูลสะอาด| ExpressAPI
    RawDB -.->|ดึงข้อมูลดิบเช็กค่า Error| ExpressAPI
    ExpressAPI -->|ส่งออก JSON| ReactApp
```

---

## 2. โครงสร้างและการสร้างฐานข้อมูลอย่างละเอียด (Database Star Schema Modeling)

ฐานข้อมูลของระบบถูกออกแบบตามสถาปัตยกรรมคลังข้อมูล (Data Warehouse) แบบ **Star Schema** เพื่อแยกตารางข้อเท็จจริง (Fact Table) ออกจากตารางมิติมุมมอง (Dimension Tables) ซึ่งช่วยเพิ่มประสิทธิภาพในการทำคิวรีวิเคราะห์และการกรองข้อมูล

```mermaid
erDiagram
    PUMPUI_SHOW_DIM_CUSTOMER {
        VARCHAR_50 CustomerID PK
        NVARCHAR_255 CustomerName "ชื่อลูกค้า (มีการเข้ารหัส Mask)"
        NVARCHAR_50 CustomerType "ประเภทลูกค้า (Company / Individual)"
    }
    
    PUMPUI_SHOW_DIM_PRODUCT {
        VARCHAR_50 ProductID PK
        NVARCHAR_255 ProductName "ชื่อสินค้า"
        NVARCHAR_100 ProductCategory "กลุ่มประเภทสินค้า"
    }
    
    PUMPUI_SHOW_DIM_GEOGRAPHY {
        NVARCHAR_100 Province PK "ชื่อจังหวัด (77 จังหวัด)"
        NVARCHAR_100 Region "ภูมิภาคจัดส่ง (6 ภูมิภาค)"
    }
    
    PUMPUI_SHOW_FACT {
        VARCHAR_50 OrderID PK
        DATETIME OrderDate "วันเวลาสั่งซื้อ"
        VARCHAR_50 CustomerID FK "รหัสลูกค้า"
        VARCHAR_50 ProductID FK "รหัสสินค้า"
        NVARCHAR_100 Province FK "จังหวัดจัดส่ง"
        FLOAT Price "ราคาขายต่อชิ้น"
        INT Quantity "จำนวนที่สั่งซื้อ"
        FLOAT NetAmount "ยอดเงินสุทธิ"
    }
    
    PUMPUI_SHOW_FACT }|..|| PUMPUI_SHOW_DIM_CUSTOMER : "CustomerID"
    PUMPUI_SHOW_FACT }|..|| PUMPUI_SHOW_DIM_PRODUCT : "ProductID"
    PUMPUI_SHOW_FACT }|..|| PUMPUI_SHOW_DIM_GEOGRAPHY : "Province"
```

### 2.1 รายละเอียดการสร้างตาราง (DDL):
* **ตารางข้อเท็จจริง `pumpui_show_fact`**: เก็บค่าตัวเลข (Measures) เพื่อการคำนวณ โดยอ้างอิง Foreign Key ไปยังตารางมิติอื่นๆ:
  ```sql
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
  ```
* **ตารางมิติมุมมองลูกค้า (`pumpui_show_dim_customer`)**, สินค้า (`pumpui_show_dim_product`), และจังหวัดจัดส่ง (`pumpui_show_dim_geography`) เพื่อทำหน้าที่เป็นตาราง Lookup ข้อมูลในการ Join

---

## 3. รายละเอียดการทำงานของ n8n Workflow และระบบล้างข้อมูล (Cleansing Workflow Deep-Dive)

เวิร์กโฟลว์นี้ควบคุมรอบความถี่การซิงค์ข้อมูล การตรวจสอบความแตกต่างของข้อมูล (Change Data Detection) การล้างทำความสะอาด การทำหน้ากากข้อมูล PII และส่งการแจ้งเตือนกลับไปยังแอป LINE

### 3.1 การตรวจสอบเวลาประมวลผล (Schedule Trigger Node)
* **ชื่อโหนด**: `Cron Trigger 05:00 AM`
* **รายละเอียด**: เป็นตัวเริ่มการทำงานของรอบอัตโนมัติ โดยส่งสัญญาณคำสั่งทุกวันในเวลา **05:00 น.** (ตามการประมวลผลเวลาเซิร์ฟเวอร์เช้าตรู่)
* **พารามิเตอร์**: `cronExpression = 0 5 * * *`

### 3.2 กระบวนการทำงานของโหนดคำสั่ง `MSSQL Sync Execution`
เป็นส่วนประมวลผลของเวิร์กโฟลว์ โดยส่งสคริปต์ SQL ไปรันบนโฮสต์ฐานข้อมูลเพื่อดำเนินการล้างและแยกมิติดังนี้:

1. **ตรวจสอบความแตกต่างของออเดอร์ใน ERP เทียบกับข้อมูลเดิม (Modified Records Detection)**:
   ตรวจเช็กออเดอร์ที่มี OrderID เดียวกันในตารางดิบ `pumpui_erp` และตารางสะอาด `pumpui_show` แต่มียอดขายหรือจำนวนสินค้าไม่เท่ากันเพื่อบันทึกประวัติการแก้ไขข้อมูล:
   ```sql
   INSERT INTO @ModifiedDetails
   SELECT e.OrderID, e.CustomerName, e.ProductName, ...
   FROM pumpui_erp e
   INNER JOIN pumpui_show s ON s.OrderID = e.OrderID
   WHERE s.NetAmount <> e.NetAmount OR s.Quantity <> e.Quantity OR s.Price <> e.Price;
   ```
2. **การคัดกรองแถวข้อมูลผิดพลาดแบบไดนามิก**:
   คำนวณและดึงรายชื่อ OrderID ที่เสียหาย (Error Records) ใน `pumpui_erp` ออกมาเพื่อเก็บบันทึก และเลือกใบสั่งซื้อที่มีปัญหา 5 รายการแรกมาบันทึกรายละเอียดประวัติการซิงค์เพื่อสืบสวนย้อนกลับ:
   ```sql
   SELECT @error_count = COUNT(*) FROM @ErrorOrderIDs;
   SELECT TOP 5 OrderID FROM @ErrorOrderIDs ORDER BY OrderID;
   -- บันทึกสถิติและ OrderID ล่าสุดที่เสียลงในตาราง pumpui_sync_log คอลัมน์ errorDetails
   ```
3. **การล้างทำความสะอาดข้อมูล (Cleansing Logic)**:
   ระบบล้างข้อมูลเดิมใน Star Schema ทั้งหมด จากนั้นนำเข้าข้อมูลที่สมบูรณ์เท่านั้นตามเกณฑ์กรองความถูกต้อง:
   * **ห้ามเป็น Null**: `OrderID`, `OrderDate`, `CustomerID`, `ProductID`, `Price`, `Quantity`, `NetAmount`, `Region`, `Province`
   * **ห้ามติดลบ**: `Quantity >= 0`, `NetAmount >= 0`, `Price >= 0`
   * **ห้ามเป็นสตริงว่างเปล่า**: `Region <> ''`, `Province <> ''`
4. **กระบวนการปกป้องข้อมูลส่วนบุคคล (PII Masking Logic)**:
   หลังจากทำความสะอาดและนำข้อมูลเข้าสู่ Star Schema แล้ว ระบบจะแปลงชื่อลูกค้าที่เป็นข้อมูลสำคัญทางธุรกิจให้เป็นหน้ากากข้อความ โดยเก็บอักขระ 4 ตัวแรกไว้ และตามหลังด้วยเครื่องหมายดอกจัน 3 ตัว เพื่อลดความเสี่ยงด้านข้อมูลรั่วไหล:
   ```sql
   UPDATE pumpui_show_dim_customer
   SET CustomerName = LEFT(CustomerName, 4) + '***'
   WHERE CustomerName IS NOT NULL;
   ```

### 3.3 ระบบการส่งข้อความแจ้งเตือนผ่าน LINE API
เมื่อกระบวนการซิงค์รันเสร็จสิ้น เวิร์กโฟลว์ของ n8n จะส่ง JSON Payload ไปยัง LINE Messaging API เพื่อส่งการแจ้งเตือนความคืบหน้าเข้าสู่ LINE Bot ของผู้ดูแลระบบทันที:

* **โหนดแจ้งเตือนซิงค์ข้อมูลสำเร็จ (`LINE API (Success)`)**:
  * **Method**: `POST`
  * **API URL**: `https://api.line.me/v2/bot/message/push`
  * **ข้อความแจ้งเตือนสำเร็จ**:
    ```text
    ✅ สรุปการทำงาน Pumpui Dashboard
    
    ⏰ เวลา: {{ วันเวลาประมวลผลปัจจุบัน }}
    📊 จำนวนข้อมูลที่อัปเดต: {{$json.rowsInserted}} รายการ
    ❌ ข้อมูลที่ไม่สมบูรณ์: {{$json.rowsError}} รายการ
    🔍 ดูที่มีปัญหา: https://advanced-data-test.vercel.app/#sync
    🌐 แดชบอร์ด: https://advanced-data-test.vercel.app
    ```
* **โหนดจับข้อผิดพลาดกรณีระบบพัง (`Error Trigger` & `LINE API (Error)`)**:
  * หากการเชื่อมต่อฐานข้อมูลล้มเหลว หรือคิวรี SQL พัง โหนด `Error Trigger` จะตรวจพบและกระตุ้นโหนดส่งข้อความ LINE Alert ให้ผู้ดูแลระบบรับรู้เพื่อทำการแก้ไขด่วน:
    ```text
    ❌ เกิดข้อผิดพลาดในการซิงค์ข้อมูล!
    
    ⏰ เวลา: {{ วันเวลาเกิดความขัดข้อง }}
    ⚠️ สถานะ: ระบบทำงานไม่สำเร็จ
    📝 รายการที่ผิดพลาด: {{ ข้อความ Error จากระบบประมวลผล }}
    🌐 แดชบอร์ด: https://advanced-data-test.vercel.app
    ```

---

## 4. แผนภาพ Flowchart การทำงานของแต่ละส่วนในระบบ (Detailed Workflows)

### 4.1 เวิร์กโฟลว์ภาพรวมทั้งหมด (Overall System Flowchart)
```mermaid
flowchart TD
    Excel([Loymalila_SalesDataMart.xlsx]) -->|Node update_database.js| ETL[ETL Process & 5% Corruption]
    ETL -->|Bulk Insert| DB_ERP[(SQL Table: pumpui_erp)]
    
    subgraph n8n_Job ["กระบวนการทำความสะอาดข้อมูลอัตโนมัติ (n8n Workflow)"]
        CronTrigger([Cron Trigger: 05:00 น.]) --> SQL_Node[MSSQL Sync Execution]
        DB_ERP -->|อ่านยอดดิบ| SQL_Node
        SQL_Node -->|1. คัดกรองตัวเสียสะสมลง Log| SyncLog[(pumpui_sync_log)]
        SQL_Node -->|2. ล้างตารางและเขียนทับข้อมูลดี| StarSchema[(Star Schema Tables)]
        SQL_Node -->|3. ทำ PII Masking ชื่อลูกค้า| CustomerDim[pumpui_show_dim_customer]
    end
    
    StarSchema -->|สร้างความสัมพันธ์เชื่อมโยง| SQL_View[(SQL View: pumpui_show)]
    CustomerDim --> SQL_View
    
    subgraph Visualization_Web ["ส่วนของแอปพลิเคชันและการแสดงผล"]
        API_Server[Express API Server: พอร์ต 5000] -->|คิวรีผ่าน View| SQL_View
        API_Server -.->|คิวรีข้อมูลเสียตรง| DB_ERP
        React_App[React Dashboard Web: พอร์ต 3000] -->|ขอข้อมูล API JSON| API_Server
    end
    
    React_App -->|แสดงผลข้อมูลและสถิติ| User([ผู้ใช้งานและผู้บริหาร])
```

---

### 4.2 เวิร์กโฟลว์การจำลองและนำเข้าข้อมูลดิบ (Data Seeding & Generation)
```mermaid
flowchart TD
    Start([เริ่มทำงานสคริปต์ update_database.js]) --> ReadExcel[อ่านไฟล์ Excel เพื่อดึงชีตทั้งหมดเข้ามาเก็บในแรม]
    ReadExcel --> MapDim[สร้าง Dimension Maps เพื่อเก็บค่าความสัมพันธ์มิติในหน่วยความจำ]
    
    MapDim --> LoopSales{วนซ้ำรายการขายในชีต FactSales}
    LoopSales --> Get2025[คำนวณและเพิ่มเรคคอร์ดปี 2025 เข้าในรายการสะสม]
    LoopSales --> Check2026{รายการดังกล่าวอยู่ในระหว่าง\n1 ม.ค. ถึง 24 มิ.ย. หรือไม่?}
    
    Check2026 -- ใช่ --> Copy2026[คัดลอกโคลนข้อมูลขึ้นมาอีกชุด<br>- ขยับปีออเดอร์เป็น 2026<br>- บวก OrderID เพิ่ม 200000]
    Copy2026 --> Get2026[เพิ่มเรคคอร์ดปี 2026 เข้าในรายการสะสม]
    Check2026 -- ไม่ใช่ --> LoopSales
    Get2025 & Get2026 --> NextRow{ประมวลผลออเดอร์ถัดไป}
    
    NextRow -- มีแถวต่อ --> LoopSales
    NextRow -- ประมวลผลเสร็จสิ้น --> ForceDate[จัดเรียงออเดอร์ 2026 และบีบค่าวันสุดท้ายให้เท่ากับ 2026-06-24 12:00:00]
    
    ForceDate --> ConnectDB[เชื่อมฐานข้อมูล SQL Server]
    ConnectDB --> Recreate[ลบและสร้างตาราง pumpui_erp และตารางในกลุ่ม Star Schema ใหม่]
    
    Recreate --> InsertERP[ทำ Bulk Insert นำออเดอร์สะสมเข้าสู่ pumpui_erp ครั้งละ 100 รายการ]
    
    InsertERP --> TargetErrors[คำนวณจำนวนข้อมูลที่จะถูกทำลายให้อยู่ที่ 5.00%]
    TargetErrors --> ShuffleIDs[ทำการสับเปลี่ยน ID ออเดอร์แบบ Fisher-Yates และกรองเลือกกลุ่มเสียหาย]
    
    ShuffleIDs --> CorruptRow[ส่งคำสั่ง UPDATE เพื่อสุ่มทำลายข้อมูลดิบ 5 แบบเท่าๆ กัน]
    CorruptRow --> Success([บันทึกประวัติการเตรียมข้อมูลดิบเสร็จสมบูรณ์])
```

---

## 5. การวิเคราะห์ข้อมูลและการแสดงผลใน React Dashboard

* **การวาดแผนที่แบบ Dynamic Projection**:
  React Frontend โหลดรูปภาพเวกเตอร์แผนที่ประเทศไทยจาก GitHub raw JSON จากนั้นเมื่อมีการคลิกเลือกภูมิภาคบนแผนที่:
  1. ตัวกรองภูมิภาคจะค้นหารายชื่อจังหวัดในภาคนั้นๆ ออกมา
  2. ดึงค่าเงินสะสมของแต่ละจังหวัดมาสร้างชุดแถวข้อมูล
  3. สั่งคำนวณคำสั่งจัดเรียงแบบเรียงจากยอดขายมากไปหาน้อย (High-to-Low Sorted Array) และนำมาวาดกราฟิกบาร์ระบุค่าเงิน พร้อมกล่องตารางข้อแนะนำเชิงธุรกิจ
* **การตรวจจับ API ออฟไลน์ (Resilience)**:
  ระบบสืบค้นสัญญาณตอบกลับจาก Backend API ตลอดเวลา หากเกิดเหตุเชื่อมต่อไม่ได้จะแสดงสถานะ Offline และดึง Mock Data ทันทีเพื่อให้ระบบใช้งานต่อได้อย่างไร้รอยต่อ

---
> [!NOTE]
> เอกสารฉบับนี้อัปเดตสอดคล้องกับพารามิเตอร์การทำลายข้อมูลจริง **5%** และสถาปัตยกรรมการซิงค์ข้อมูลผ่านระบบ n8n ที่มีท่อส่ง LINE Alert และการปกป้อง PII Masking ในฐานข้อมูลปัจจุบันแล้วเรียบร้อย 
