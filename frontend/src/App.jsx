import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Diverse Multi-Color Neon Palette
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#3b82f6'];

const CATEGORY_COLORS = {
  'ดอกไม้ไทย': '#ec4899',
  'ผลไม้สดชื่น': '#10b981',
  'สมุนไพร': '#f59e0b',
  'Premium': '#06b6d4'
};

const CUSTOMER_COLORS = {
  'Company': '#6366f1',
  'Individual': '#ec4899'
};

const REGION_COLORS = {
  "ภาคเหนือ": "#c084fc",         // Soft purple/lavender (like reference)
  "ภาคตะวันออกเฉียงเหนือ": "#fb923c", // Soft orange (like reference)
  "ภาคกลาง": "#818cf8",         // Lavender blue (like reference)
  "ภาคตะวันตก": "#86efac",       // Soft green (like reference)
  "ภาคตะวันออก": "#22d3ee",       // Soft cyan/teal (like reference)
  "ภาคใต้": "#4ade80"            // Mint green (like reference)
};

const fmt = v => '฿' + (v / 1000).toFixed(0) + 'K';
const fmtFull = v => '฿' + v.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// --- Customer Name Masking ---
const maskCustomerName = (name) => {
  if (!name) return '—';
  // Handle corporate prefix/suffix
  const prefixes = ['บริษัท ', 'บจก. ', 'ห้างหุ้นส่วน ', 'ร้าน ', 'คุณ ', 'นาย ', 'นาง ', 'นางสาว '];
  const suffixes = [' จำกัด', ' (มหาชน)', ' จำกัด (มหาชน)'];
  let prefix = '';
  let suffix = '';
  let core = name;
  for (const p of prefixes) {
    if (core.startsWith(p)) { prefix = p; core = core.slice(p.length); break; }
  }
  for (const s of suffixes) {
    if (core.endsWith(s)) { suffix = s; core = core.slice(0, -s.length); break; }
  }
  if (core.length <= 2) return name;
  // Keep first char, mask the rest
  const masked = core[0] + '*'.repeat(Math.min(core.length - 1, 5));
  return prefix + masked + suffix;
};

// --- Error Type Labels ---
const ERROR_TYPE_LABELS = {
  0: { label: 'ค่าติดลบ', icon: '📉', color: '#ef4444', desc: 'Quantity และ NetAmount เป็นค่าติดลบ' },
  1: { label: 'ยอดเงินว่าง', icon: '💸', color: '#f59e0b', desc: 'NetAmount เป็น NULL' },
  2: { label: 'ข้อมูลภูมิภาคว่าง', icon: '🗺️', color: '#8b5cf6', desc: 'Region และ Province เป็น NULL' },
  3: { label: 'ข้อมูลว่างเปล่า', icon: '📭', color: '#06b6d4', desc: 'Region และ Province เป็น string ว่าง' },
  4: { label: 'ข้อมูล Dimension หาย', icon: '🔗', color: '#ec4899', desc: 'CustomerID และ ProductID เป็น NULL' }
};

// Generate mock detailed error rows for a given log entry
const generateMockErrorDetails = (log) => {
  if (!log) return [];
  const targetCount = log.errorCount || 0;
  const baseDate = new Date(log.SyncDate);
  
  // Parse all OrderIDs from errorDetails string
  let ids = [];
  if (log.errorDetails) {
    const raw = log.errorDetails.replace(/\(และอีก.*\)/, '').trim();
    ids = raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  
  // If we have fewer IDs than the target count, fill in with generated IDs
  const allIds = [...ids];
  while (allIds.length < targetCount) {
    const nextNum = 100000 + allIds.length * 7 + 3; // make some fake unique IDs
    allIds.push(String(nextNum));
  }
  
  return allIds.map((orderId, idx) => {
    const typeNum = idx % 5;
    const meta = ERROR_TYPE_LABELS[typeNum];
    const fakeDate = new Date(baseDate);
    fakeDate.setHours(fakeDate.getHours() - (idx * 2 + 1));
    const fakePrices = [500, 750, 1200, 300, 950, 1800, 450, 620];
    const fakeQty = typeNum === 0 ? -5 : (idx % 4) + 1;
    const fakeAmt = typeNum === 0 ? -150 : (typeNum === 1 ? null : fakePrices[idx % fakePrices.length]);
    return {
      orderID: orderId,
      errorType: typeNum,
      errorLabel: meta.label,
      errorIcon: meta.icon,
      errorColor: meta.color,
      errorDesc: meta.desc,
      orderDate: fakeDate.toISOString(),
      quantity: fakeQty,
      netAmount: fakeAmt,
      product: ['มะลิ', 'มะนาว-สะระแหน่', 'ขิง-มะนาว', 'ส้มโอ', 'ดอกเก็กฮวย'][idx % 5],
    };
  });
};


// Global Chart Options Defaults
ChartJS.defaults.font.family = "'Prompt', 'Inter', sans-serif";

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      borderWidth: 1,
      titleColor: '#f8fafc',
      bodyColor: '#cbd5e1',
      padding: 12,
      cornerRadius: 10,
      boxPadding: 6,
      usePointStyle: true
    }
  }
};

const lightScales = {
  x: {
    grid: { display: false },
    ticks: { color: '#94a3b8', font: { size: 11 } }
  },
  y: {
    border: { dash: [4, 4], color: 'rgba(255, 255, 255, 0.08)' },
    grid: { color: 'rgba(255, 255, 255, 0.08)', drawBorder: false },
    ticks: { color: '#94a3b8', font: { size: 11 } }
  }
};

// Fallback Mock Data in case API is not loaded yet
const mockKpis = {
  revenue: 2840000,
  orders: 1500,
  customers: 320,
  products: 15,
  stockOutRate: 4.4,
  forecastAccuracy: 87.5,
  dataQualityScore: 99.2,
  dashboardRefreshRate: 100,
  totalRows: 1500,
  lastSyncDate: '2025-12-31T00:00:00.000Z'
};

const mockMonthly = [
  { m: 'ม.ค.', v: 213938 }, { m: 'ก.พ.', v: 196902 }, { m: 'มี.ค.', v: 242803 }, { m: 'เม.ย.', v: 279231 },
  { m: 'พ.ค.', v: 222968 }, { m: 'มิ.ย.', v: 233208 }, { m: 'ก.ค.', v: 208371 }, { m: 'ส.ค.', v: 272624 },
  { m: 'ก.ย.', v: 232902 }, { m: 'ต.ค.', v: 226642 }, { m: 'พ.ย.', v: 207770 }, { m: 'ธ.ค.', v: 299692 }
];

const mockRegions = {
  'ภาคกลาง': 1138780, 'ภาคตะวันออกเฉียงเหนือ': 744533, 'ภาคใต้': 575759,
  'ภาคตะวันออก': 176954, 'ภาคตะวันตก': 121642, 'ภาคเหนือ': 79383
};

const mockCategories = {
  'ดอกไม้ไทย': 1168343, 'ผลไม้สดชื่น': 829320, 'สมุนไพร': 561125, 'Premium': 278263
};

const mockTopProducts = [
  { n: 'น้ำเปล่าลอยมะลิ', v: 788481, qty: 1576 },
  { n: 'น้ำเปล่าลอยมะนาว-สะระแหน่', v: 393552, qty: 787 },
  { n: 'น้ำเปล่าลอยขิง-มะนาว', v: 269028, qty: 538 },
  { n: 'น้ำเปล่าลอยส้มโอ', v: 229983, qty: 460 },
  { n: 'น้ำเปล่าลอยใบเตย-มะลิ', v: 133673, qty: 267 },
  { n: 'น้ำเปล่าลอยดอกเก็กฮวย', v: 126820, qty: 253 },
  { n: 'น้ำเปล่าลอยกุหลาบมอญ', v: 119369, qty: 238 },
  { n: 'น้ำเปล่าลอยแตงโม-โหระพา', v: 117114, qty: 234 },
  { n: 'น้ำเปล่าลอยอัญชัน-มะนาว', v: 105280, qty: 210 },
  { n: 'น้ำเปล่าลอยลาเวนเดอร์', v: 102605, qty: 205 }
];

const mockTopCusts = [
  { n: 'บริษัท FreshMart จำกัด', v: 129391, t: 'Company' },
  { n: 'บริษัท Pure Water Trading จำกัด', v: 125016, t: 'Company' },
  { n: 'บริษัท Bangkok Wholesale จำกัด', v: 114044, t: 'Company' },
  { n: 'บริษัท Wellness Retail จำกัด', v: 113053, t: 'Company' },
  { n: 'บริษัท Smart Beverage Group จำกัด', v: 111447, t: 'Company' },
  { n: 'บริษัท Isan Beverage จำกัด', v: 99242, t: 'Company' },
  { n: 'บริษัท Premium Mart จำกัด', v: 96947, t: 'Company' },
  { n: 'บริษัท Royal Garden Café Supply จำกัด', v: 94492, t: 'Company' },
  { n: 'บริษัท Organic Living จำกัด', v: 93818, t: 'Company' },
  { n: 'บริษัท Capital Food Service จำกัด', v: 92619, t: 'Company' }
];

const mockTopProvs = [
  { n: 'สมุทรปราการ', v: 424391 }, { n: 'ขอนแก่น', v: 289135 }, { n: 'กาฬสินธุ์', v: 189286 },
  { n: 'ภูเก็ต', v: 183827 }, { n: 'นครปฐม', v: 153705 }, { n: 'ชลบุรี', v: 143171 },
  { n: 'นครศรีธรรมราช', v: 133086 }, { n: 'นครราชสีมา', v: 127089 }, { n: 'กรุงเทพมหานคร', v: 124048 },
  { n: 'กาญจนบุรี', v: 104953 }
];

const mockHeatmap = {
  'ภาคกลาง': { 'ดอกไม้ไทย': 482000, 'ผลไม้สดชื่น': 360000, 'สมุนไพร': 206000, 'Premium': 91000 },
  'ภาคตะวันออกเฉียงเหนือ': { 'ดอกไม้ไทย': 315000, 'ผลไม้สดชื่น': 168000, 'สมุนไพร': 198000, 'Premium': 64000 },
  'ภาคใต้': { 'ดอกไม้ไทย': 201000, 'ผลไม้สดชื่น': 243000, 'สมุนไพร': 96000, 'Premium': 36000 },
  'ภาคตะวันออก': { 'ดอกไม้ไทย': 72000, 'ผลไม้สดชื่น': 71000, 'สมุนไพร': 25000, 'Premium': 9000 },
  'ภาคตะวันตก': { 'ดอกไม้ไทย': 53000, 'ผลไม้สดชื่น': 44000, 'สมุนไพร': 18000, 'Premium': 7000 },
  'ภาคเหนือ': { 'ดอกไม้ไทย': 45000, 'ผลไม้สดชื่น': 24000, 'สมุนไพร': 7000, 'Premium': 4000 }
};

const mockRegionalDetail = {
  'ภาคกลาง': {
    topProvince: 'สมุทรปราการ',
    topProvinceSales: 424391,
    companyRatio: 68.5,
    individualRatio: 31.5,
    topProducts: [
      { name: 'น้ำเปล่าลอยมะลิ', sales: 320000 },
      { name: 'น้ำเปล่าลอยมะนาว-สะระแหน่', sales: 180000 },
      { name: 'น้ำเปล่าลอยส้มโอ', sales: 120000 }
    ],
    popularFlavor: 'มะลิ, มะนาว-สะระแหน่',
    productionRecommendation: 'น้ำเปล่าลอยมะนาว-สะระแหน่ (เนื่องจากดีมานด์ผลไม้สดชื่นสูงเป็นพิเศษ)',
    newProductOpportunity: 'น้ำเปล่าลอยยูสุ-มะนาว (บรรจุขวดแก้วพรีเมียม เพื่อตอบโจทย์ตลาด Urban กลิ่นส้มยูสุ)'
  },
  'ภาคตะวันออกเฉียงเหนือ': {
    topProvince: 'ขอนแก่น',
    topProvinceSales: 289135,
    companyRatio: 61.2,
    individualRatio: 38.8,
    topProducts: [
      { name: 'น้ำเปล่าลอยขิง-มะนาว', sales: 160000 },
      { name: 'น้ำเปล่าลอยมะลิ', sales: 140000 },
      { name: 'น้ำเปล่าลอยดอกเก็กฮวย', sales: 90000 }
    ],
    popularFlavor: 'ขิง-มะนาว, เก็กฮวย',
    productionRecommendation: 'น้ำเปล่าลอยขิง-มะนาว (สมุนไพรบำรุงสุขภาพขายดีที่สุดในภาคนี้)',
    newProductOpportunity: 'น้ำเปล่าลอยขมิ้น-มะนาว (จับเทรนด์เครื่องดื่มสมุนไพรท้องถิ่นทางเลือก)'
  },
  'ภาคใต้': {
    topProvince: 'ภูเก็ต',
    topProvinceSales: 183827,
    companyRatio: 52.4,
    individualRatio: 47.6,
    topProducts: [
      { name: 'น้ำเปล่าลอยส้มโอ', sales: 110000 },
      { name: 'น้ำเปล่าลอยมะลิ', sales: 95000 },
      { name: 'น้ำเปล่าลอยแตงโม-โหระพา', sales: 85000 }
    ],
    popularFlavor: 'ส้มโอ, แตงโม-โหระพา',
    productionRecommendation: 'น้ำเปล่าลอยส้มโอ (ผลไม้เขตร้อนกระตุ้นความสดชื่นสำหรับการท่องเที่ยว)',
    newProductOpportunity: 'น้ำเปล่าลอยอัญชัน Sparkling (ขวดแก้วพร้อมฟอง เพิ่มความสวยงามและสดชื่นสำหรับลูกค้าโฮเต็ล/ท่องเที่ยว)'
  },
  'ภาคตะวันออก': {
    topProvince: 'ชลบุรี',
    topProvinceSales: 143171,
    companyRatio: 72.1,
    individualRatio: 27.9,
    topProducts: [
      { name: 'น้ำเปล่าลอยมะลิ', sales: 78000 },
      { name: 'น้ำเปล่าลอยมะนาว-สะระแหน่', sales: 45000 },
      { name: 'น้ำเปล่าลอยแอปเปิ้ล-อบเชย', sales: 32000 }
    ],
    popularFlavor: 'มะลิ, แอปเปิ้ล-อบเชย',
    productionRecommendation: 'น้ำเปล่าลอยมะลิ (Hero Product สรรพคุณผ่อนคลายและสดชื่น)',
    newProductOpportunity: 'น้ำเปล่าลอยยูสุ-มะนาว (บรรจุภัณฑ์ขนาดเล็ก/พรีเมียม เพื่อจำหน่ายเขตนิคม EEC)'
  },
  'ภาคตะวันตก': {
    topProvince: 'กาญจนบุรี',
    topProvinceSales: 104953,
    companyRatio: 59.8,
    individualRatio: 40.2,
    topProducts: [
      { name: 'น้ำเปล่าลอยดอกเก็กฮวย', sales: 42000 },
      { name: 'น้ำเปล่าลอยขิง-มะนาว', sales: 30000 },
      { name: 'น้ำเปล่าลอยมะลิ', sales: 25000 }
    ],
    popularFlavor: 'เก็กฮวย, ขิง',
    productionRecommendation: 'น้ำเปล่าลอยดอกเก็กฮวย (ชาดอกไม้แบบดั้งเดิมมียอดขายขยายตัวคงที่)',
    newProductOpportunity: 'น้ำเปล่าลอยอัญชัน Sparkling (น้ำอัญชันซ่าขวดใส จับกลุ่มวัยรุ่นท่องเที่ยวแม่น้ำแคว)'
  },
  'ภาคเหนือ': {
    topProvince: 'เชียงใหม่',
    topProvinceSales: 54000,
    companyRatio: 45.0,
    individualRatio: 55.0,
    topProducts: [
      { name: 'น้ำเปล่าลอยมะลิ', sales: 38000 },
      { name: 'น้ำเปล่าลอยใบเตย-มะลิ', sales: 22000 },
      { name: 'น้ำเปล่าลอยกุหลาบมอญ', sales: 18000 }
    ],
    popularFlavor: 'มะลิ, ใบเตย, กุหลาบ',
    productionRecommendation: 'น้ำเปล่าลอยมะลิ (น้ำอบดอกไม้ไทยครองตลาดในภาคเหนือมากกว่า 55%)',
    newProductOpportunity: 'น้ำเปล่าลอยมะลิ-ลิ้นจี่ (ใช้ลิ้นจี่ภาคเหนือเป็นส่วนประกอบเสริมภาพลักษณ์ท้องถิ่น)'
  }
};

const mockSyncLogs = [
  { SyncID: 1, SyncDate: '2026-06-25T11:57:52.167Z', NewRecords: 12, ModifiedRecords: 5, TotalRecords: 1500, errorDetails: '300002, 100003, 300009, 100010, 100027 (และอีก 57 รายการ)', errorCount: 62 },
  { SyncID: 2, SyncDate: '2026-06-24T05:00:10.000Z', NewRecords: 8, ModifiedRecords: 3, TotalRecords: 1488, errorDetails: '100001, 100015, 100022 (และอีก 2 รายการ)', errorCount: 5 },
  { SyncID: 3, SyncDate: '2026-06-23T05:00:15.000Z', NewRecords: 15, ModifiedRecords: 2, TotalRecords: 1480, errorDetails: null, errorCount: 0 },
  { SyncID: 4, SyncDate: '2026-06-22T05:00:08.000Z', NewRecords: 0, ModifiedRecords: 0, TotalRecords: 1465, errorDetails: null, errorCount: 0 },
  { SyncID: 5, SyncDate: '2026-06-21T05:00:12.000Z', NewRecords: 22, ModifiedRecords: 8, TotalRecords: 1465, errorDetails: '100012, 100013, 100030 (และอีก 4 รายการ)', errorCount: 7 }
];

const mockSyncDiff = {
  newRecords: [
    { OrderID: 'ORD-2026-999', OrderDate: '2026-06-25T11:30:00Z', CustomerName: 'บจก. สยาม ฟู๊ดส์ เซอร์วิส', ProductName: 'น้ำเปล่าลอยมะลิ (Pack)', NetAmount: 1200, Quantity: 10, Price: 120, Province: 'นนทบุรี' },
    { OrderID: 'ORD-2026-998', OrderDate: '2026-06-25T11:15:00Z', CustomerName: 'คุณ สมชาย มั่นใจ', ProductName: 'น้ำเปล่าลอยแตงโม-โหระพา', NetAmount: 300, Quantity: 2, Price: 150, Province: 'กรุงเทพมหานคร' }
  ],
  modifiedRecords: [
    { OrderID: 'ORD-2026-105', OrderDate: '2026-06-24T14:20:00Z', CustomerName: 'บจก. บางกอก โฮลเซล', ProductName: 'น้ำเปล่าลอยส้มโอ', ErpNetAmount: 900, ErpQuantity: 6, ErpPrice: 150, ShowNetAmount: 750, ShowQuantity: 5, ShowPrice: 150 }
  ]
};

// Province ID to Thai name mapping
const provinceThaiNames = {
  "cmi": "เชียงใหม่", "cri": "เชียงราย", "lpg": "ลำปาง", "lpn": "ลำพูน",
  "mhs": "แม่ฮ่องสอน", "nan": "น่าน", "pyo": "พะเยา", "pre": "แพร่", "utd": "อุตรดิตถ์",
  "acr": "อำนาจเจริญ", "bkn": "บึงกาฬ", "brm": "บุรีรัมย์", "cpm": "ชัยภูมิ",
  "ksn": "กาฬสินธุ์", "kkn": "ขอนแก่น", "lei": "เลย", "msk": "มหาสารคาม",
  "mdh": "มุกดาหาร", "npm": "นครพนม", "nma": "นครราชสีมา", "nbl": "หนองบัวลำภู",
  "nki": "หนองคาย", "ret": "ร้อยเอ็ด", "snk": "สกลนคร", "ssk": "ศรีสะเกษ",
  "srn": "สุรินทร์", "ubn": "อุบลราชธานี", "udn": "อุดรธานี", "yst": "ยโสธร",
  "atg": "อ่างทอง", "bkk": "กรุงเทพมหานคร", "cnt": "ชัยนาท", "kpt": "กำแพงเพชร",
  "lri": "ลพบุรี", "nyk": "นครนายก", "npt": "นครปฐม", "nsw": "นครสวรรค์",
  "nbi": "นนทบุรี", "pte": "ปทุมธานี", "pnb": "เพชรบูรณ์", "aya": "พระนครศรีอยุธยา",
  "pct": "พิจิตร", "plk": "พิษณุโลก", "spk": "สมุทรปราการ", "skn": "สมุทรสาคร",
  "skm": "สมุทรสงคราม", "sri": "สระบุรี", "sbr": "สิงห์บุรี", "sth": "สุโขทัย",
  "uti": "อุทัยธานี", "spb": "สุพรรณบุรี",
  "cco": "ฉะเชิงเทรา", "cti": "จันทบุรี", "cbi": "ชลบุรี", "pri": "ปราจีนบุรี",
  "ryg": "ระยอง", "skw": "สระแก้ว", "trt": "ตราด",
  "kcn": "กาญจนบุรี", "pbi": "เพชรบุรี", "pkk": "ประจวบคีรีขันธ์", "rbr": "ราชบุรี", "tak": "ตาก",
  "cpn": "ชุมพร", "kbi": "กระบี่", "nst": "นครศรีธรรมราช", "nwt": "นราธิวาส",
  "ptn": "ปัตตานี", "pna": "พังงา", "plg": "พัทลุง", "pkt": "ภูเก็ต",
  "rng": "ระนอง", "stn": "สตูล", "ska": "สงขลา", "sni": "สุราษฎร์ธานี",
  "trg": "ตรัง", "yla": "ยะลา"
};

const generateMockProvinceSales = () => {
  const mockMap = {};
  const top10Map = {
    "สมุทรปราการ": 424391, "ขอนแก่น": 289135, "กาฬสินธุ์": 189286,
    "ภูเก็ต": 183827, "นครปฐม": 153705, "ชลบุรี": 143171,
    "นครศรีธรรมราช": 133086, "นครราชสีมา": 127089, "กรุงเทพมหานคร": 124048,
    "กาญจนบุรี": 104953
  };
  Object.entries(provinceThaiNames).forEach(([code, name]) => {
    if (top10Map[name]) {
      mockMap[name] = top10Map[name];
    } else {
      let sum = 0;
      for (let i = 0; i < code.length; i++) sum += code.charCodeAt(i);
      mockMap[name] = 12000 + (sum % 7) * 14000 + (sum % 3) * 5000;
    }
  });
  return mockMap;
};

const labelCoords = {
  "ภาคเหนือ": { x: 175, y: 180, name: "เหนือ" },
  "ภาคตะวันออกเฉียงเหนือ": { x: 395, y: 290, name: "อีสาน" },
  "ภาคกลาง": { x: 230, y: 485, name: "กลาง" },
  "ภาคตะวันตก": { x: 115, y: 490, name: "ตก" },
  "ภาคตะวันออก": { x: 330, y: 540, name: "ออก" },
  "ภาคใต้": { x: 165, y: 800, name: "ใต้" }
};

// Province English name -> Thai region mapping for GeoJSON rendering
const provinceEnNameToRegion = {
  // ภาคเหนือ
  'Mae Hong Son': 'ภาคเหนือ', 'Chiang Mai': 'ภาคเหนือ', 'Chiang Rai': 'ภาคเหนือ',
  'Lamphun': 'ภาคเหนือ', 'Lampang': 'ภาคเหนือ', 'Phrae': 'ภาคเหนือ',
  'Nan': 'ภาคเหนือ', 'Phayao': 'ภาคเหนือ', 'Uttaradit': 'ภาคเหนือ',
  // ภาคตะวันออกเฉียงเหนือ
  'Loei': 'ภาคตะวันออกเฉียงเหนือ', 'Nong Khai': 'ภาคตะวันออกเฉียงเหนือ',
  'Bueng Kan': 'ภาคตะวันออกเฉียงเหนือ', 'Nong Bua Lam Phu': 'ภาคตะวันออกเฉียงเหนือ',
  'Udon Thani': 'ภาคตะวันออกเฉียงเหนือ', 'Sakon Nakhon': 'ภาคตะวันออกเฉียงเหนือ',
  'Nakhon Phanom': 'ภาคตะวันออกเฉียงเหนือ', 'Kalasin': 'ภาคตะวันออกเฉียงเหนือ',
  'Khon Kaen': 'ภาคตะวันออกเฉียงเหนือ', 'Mukdahan': 'ภาคตะวันออกเฉียงเหนือ',
  'Maha Sarakham': 'ภาคตะวันออกเฉียงเหนือ', 'Roi Et': 'ภาคตะวันออกเฉียงเหนือ',
  'Yasothon': 'ภาคตะวันออกเฉียงเหนือ', 'Amnat Charoen': 'ภาคตะวันออกเฉียงเหนือ',
  'Chaiyaphum': 'ภาคตะวันออกเฉียงเหนือ', 'Nakhon Ratchasima': 'ภาคตะวันออกเฉียงเหนือ',
  'Buriram': 'ภาคตะวันออกเฉียงเหนือ', 'Surin': 'ภาคตะวันออกเฉียงเหนือ',
  'Si Sa Ket': 'ภาคตะวันออกเฉียงเหนือ', 'Ubon Ratchathani': 'ภาคตะวันออกเฉียงเหนือ',
  // ภาคกลาง
  'Phichit': 'ภาคกลาง', 'Phitsanulok': 'ภาคกลาง', 'Phetchabun': 'ภาคกลาง',
  'Nakhon Sawan': 'ภาคกลาง', 'Chai Nat': 'ภาคกลาง', 'Lopburi': 'ภาคกลาง',
  'Sing Buri': 'ภาคกลาง', 'Ang Thong': 'ภาคกลาง',
  'Phra Nakhon Si Ayutthaya': 'ภาคกลาง', 'Saraburi': 'ภาคกลาง',
  'Pathum Thani': 'ภาคกลาง', 'Nonthaburi': 'ภาคกลาง', 'Bangkok': 'ภาคกลาง',
  'Samut Prakan': 'ภาคกลาง', 'Nakhon Pathom': 'ภาคกลาง',
  'Samut Sakhon': 'ภาคกลาง', 'Samut Songkhram': 'ภาคกลาง',
  'Suphan Buri': 'ภาคกลาง', 'Nakhon Nayok': 'ภาคกลาง',
  'Sukhothai': 'ภาคกลาง', 'Uthai Thani': 'ภาคกลาง', 'Kamphaeng Phet': 'ภาคกลาง',
  // ภาคตะวันตก
  'Tak': 'ภาคตะวันตก', 'Kanchanaburi': 'ภาคตะวันตก', 'Ratchaburi': 'ภาคตะวันตก',
  'Phetchaburi': 'ภาคตะวันตก', 'Prachuap Khiri Khan': 'ภาคตะวันตก',
  // ภาคตะวันออก
  'Chachoengsao': 'ภาคตะวันออก', 'Chon Buri': 'ภาคตะวันออก',
  'Rayong': 'ภาคตะวันออก', 'Chanthaburi': 'ภาคตะวันออก', 'Trat': 'ภาคตะวันออก',
  'Prachin Buri': 'ภาคตะวันออก', 'Sa Kaeo': 'ภาคตะวันออก',
  // ภาคใต้
  'Chumphon': 'ภาคใต้', 'Ranong': 'ภาคใต้', 'Surat Thani': 'ภาคใต้',
  'Phang Nga': 'ภาคใต้', 'Phuket': 'ภาคใต้', 'Krabi': 'ภาคใต้',
  'Nakhon Si Thammarat': 'ภาคใต้', 'Phatthalung': 'ภาคใต้', 'Trang': 'ภาคใต้',
  'Satun': 'ภาคใต้', 'Songkhla': 'ภาคใต้', 'Pattani': 'ภาคใต้',
  'Yala': 'ภาคใต้', 'Narathiwat': 'ภาคใต้',
};

// Province English name -> Thai name mapping for tooltip display
const provinceEnToTH = {
  'Mae Hong Son': 'แม่ฮ่องสอน', 'Chiang Mai': 'เชียงใหม่', 'Chiang Rai': 'เชียงราย',
  'Lamphun': 'ลำพูน', 'Lampang': 'ลำปาง', 'Phrae': 'แพร่',
  'Nan': 'น่าน', 'Phayao': 'พะเยา', 'Uttaradit': 'อุตรดิตถ์',
  'Loei': 'เลย', 'Nong Khai': 'หนองคาย', 'Bueng Kan': 'บึงกาฬ',
  'Nong Bua Lam Phu': 'หนองบัวลำภู', 'Udon Thani': 'อุดรธานี',
  'Sakon Nakhon': 'สกลนคร', 'Nakhon Phanom': 'นครพนม', 'Kalasin': 'กาฬสินธุ์',
  'Khon Kaen': 'ขอนแก่น', 'Mukdahan': 'มุกดาหาร', 'Maha Sarakham': 'มหาสารคาม',
  'Roi Et': 'ร้อยเอ็ด', 'Yasothon': 'ยโสธร', 'Amnat Charoen': 'อำนาจเจริญ',
  'Chaiyaphum': 'ชัยภูมิ', 'Nakhon Ratchasima': 'นครราชสีมา',
  'Buriram': 'บุรีรัมย์', 'Surin': 'สุรินทร์', 'Si Sa Ket': 'ศรีสะเกษ',
  'Ubon Ratchathani': 'อุบลราชธานี', 'Phichit': 'พิจิตร', 'Phitsanulok': 'พิษณุโลก',
  'Phetchabun': 'เพชรบูรณ์', 'Nakhon Sawan': 'นครสวรรค์', 'Chai Nat': 'ชัยนาท',
  'Lopburi': 'ลพบุรี', 'Sing Buri': 'สิงห์บุรี', 'Ang Thong': 'อ่างทอง',
  'Phra Nakhon Si Ayutthaya': 'พระนครศรีอยุธยา', 'Saraburi': 'สระบุรี',
  'Pathum Thani': 'ปทุมธานี', 'Nonthaburi': 'นนทบุรี', 'Bangkok': 'กรุงเทพมหานคร',
  'Samut Prakan': 'สมุทรปราการ', 'Nakhon Pathom': 'นครปฐม',
  'Samut Sakhon': 'สมุทรสาคร', 'Samut Songkhram': 'สมุทรสงคราม',
  'Suphan Buri': 'สุพรรณบุรี', 'Nakhon Nayok': 'นครนายก',
  'Sukhothai': 'สุโขทัย', 'Uthai Thani': 'อุทัยธานี', 'Kamphaeng Phet': 'กำแพงเพชร',
  'Tak': 'ตาก', 'Kanchanaburi': 'กาญจนบุรี', 'Ratchaburi': 'ราชบุรี',
  'Phetchaburi': 'เพชรบุรี', 'Prachuap Khiri Khan': 'ประจวบคีรีขันธ์',
  'Chachoengsao': 'ฉะเชิงเทรา', 'Chon Buri': 'ชลบุรี', 'Rayong': 'ระยอง',
  'Chanthaburi': 'จันทบุรี', 'Trat': 'ตราด', 'Prachin Buri': 'ปราจีนบุรี',
  'Sa Kaeo': 'สระแก้ว', 'Chumphon': 'ชุมพร', 'Ranong': 'ระนอง',
  'Surat Thani': 'สุราษฎร์ธานี', 'Phang Nga': 'พังงา', 'Phuket': 'ภูเก็ต',
  'Krabi': 'กระบี่', 'Nakhon Si Thammarat': 'นครศรีธรรมราช',
  'Phatthalung': 'พัทลุง', 'Trang': 'ตรัง', 'Satun': 'สตูล',
  'Songkhla': 'สงขลา', 'Pattani': 'ปัตตานี', 'Yala': 'ยะลา', 'Narathiwat': 'นราธิวาส'
};

// Simple Mercator projection for Thailand GeoJSON
// Thailand bbox: lon 97.5-105.7, lat 5.5-20.5
const THAILAND_PROJ = {
  minLon: 97.5, maxLon: 105.7,
  minLat: 5.5, maxLat: 20.5,
  width: 560, height: 1025
};

function projectPoint(lon, lat) {
  const { minLon, maxLon, minLat, maxLat, width, height } = THAILAND_PROJ;
  const x = ((lon - minLon) / (maxLon - minLon)) * width;
  // Use Mercator-style lat projection
  const latRad = lat * Math.PI / 180;
  const minLatRad = minLat * Math.PI / 180;
  const maxLatRad = maxLat * Math.PI / 180;
  const mercLat = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const mercMin = Math.log(Math.tan(Math.PI / 4 + minLatRad / 2));
  const mercMax = Math.log(Math.tan(Math.PI / 4 + maxLatRad / 2));
  const y = height - ((mercLat - mercMin) / (mercMax - mercMin)) * height;
  return [x, y];
}

function coordsToSvgPath(geometry) {
  // Get only the outer rings (index 0 of each polygon)
  let outerRings = [];
  if (geometry.type === 'Polygon') {
    outerRings = [geometry.coordinates[0]]; // only outer ring
  } else if (geometry.type === 'MultiPolygon') {
    outerRings = geometry.coordinates.map(polygon => polygon[0]); // outer ring of each polygon
  }
  
  return outerRings.map(ring => {
    if (!ring || ring.length < 3) return '';
    // Simplify: take every Nth point to reduce complexity while maintaining shape
    const step = Math.max(1, Math.floor(ring.length / 120));
    const pts = [];
    for (let i = 0; i < ring.length; i += step) {
      const [x, y] = projectPoint(ring[i][0], ring[i][1]);
      pts.push([x.toFixed(1), y.toFixed(1)]);
    }
    if (pts.length < 3) return '';
    return 'M' + pts.join('L') + 'Z';
  }).filter(Boolean).join(' ');
}

function ThailandMap({ activeRegion, onRegionSelect, regionSales, topProvinces = [], provinceSales = {} }) {
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredRegion, setHoveredRegion] = useState(null);
  const [hoveredProvince, setHoveredProvince] = useState(null);
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, province: '', region: '', provSales: null });
  const [viewMode, setViewMode] = useState('region'); // 'region' or 'province'


  useEffect(() => {
    setLoading(true);
    // 1. Try to load GeoJSON directly from GitHub (all 77 provinces)
    axios.get('https://raw.githubusercontent.com/apisit/thailand.json/master/thailand.json')
      .then(res => {
        const features = res.data.features || [];
        const projected = [];
        
        features.forEach(feature => {
          const enName = feature.properties?.name;
          if (!enName || !feature.geometry) return;
          
          const region = provinceEnNameToRegion[enName];
          if (!region) {
            console.warn(`No region mapped for: ${enName}`);
            return;
          }
          
          const d = coordsToSvgPath(feature.geometry);
          if (!d) return;
          
          const thName = provinceEnToTH[enName] || enName;
          
          projected.push({
            id: enName.toLowerCase().replace(/\s+/g, '_'),
            label: enName,
            labelTH: thName,
            region: region,
            d: d
          });
        });
        
        if (projected.length > 0) {
          console.log(`Loaded and projected ${projected.length} provinces dynamically from GitHub.`);
          setPaths(projected);
          setLoading(false);
          return;
        }
        throw new Error("No paths projected");
      })
      .catch(err => {
        console.warn("Failed to load/project GeoJSON from GitHub, falling back to local JSON:", err.message);
        // Fallback: โหลดจากไฟล์ local (29 จังหวัดที่มีอยู่)
        axios.get('/thailand_regions.json')
          .then(res => {
            const flattened = [];
            Object.entries(res.data).forEach(([regionName, provinces]) => {
              provinces.forEach(p => {
                flattened.push({
                  ...p,
                  region: regionName,
                  labelTH: p.labelTH || p.label,
                });
              });
            });
            setPaths(flattened);
            setLoading(false);
          })
          .catch(localErr => {
            console.error("Local fallback also failed:", localErr);
            setPaths([]);
            setLoading(false);
          });
      });
  }, []);

  const getFillColor = (regionName, isProvinceHovered, provName) => {
    const baseColor = REGION_COLORS[regionName] || '#94a3b8';

    if (viewMode === 'province') {
      const sales = provinceSales[provName] || 0;
      const maxProvSales = Object.values(provinceSales).length > 0 ? Math.max(...Object.values(provinceSales)) : 1;
      const ratio = sales / maxProvSales;
      let opacity = 0.25 + ratio * 0.75;
      if (isProvinceHovered) {
        opacity = 1.0;
      }
      const r = parseInt(baseColor.slice(1, 3), 16);
      const g = parseInt(baseColor.slice(3, 5), 16);
      const b = parseInt(baseColor.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    // Check if any region is currently active or hovered
    const hasFocus = activeRegion || hoveredRegion;
    const isThisRegionFocused = activeRegion === regionName || hoveredRegion === regionName;

    // Base opacity - pastel colors need higher opacity to be visible
    let opacity = 0.75;

    if (hasFocus) {
      if (isThisRegionFocused) {
        opacity = isProvinceHovered ? 1.0 : 0.95;
      } else {
        opacity = 0.4; // Dim other regions
      }
    } else {
      if (isProvinceHovered) {
        opacity = 1.0;
      }
    }

    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const handleMouseMove = (e, p) => {
    const thName = p.labelTH || provinceThaiNames[p.id] || p.label;
    const provSales = provinceSales[thName] || null;

    setTooltip({
      show: true,
      x: e.clientX + 15,
      y: e.clientY + 15,
      province: thName,
      region: p.region,
      provSales
    });
  };

  const handleMouseLeave = () => {
    setTooltip(t => ({ ...t, show: false }));
    setHoveredProvince(null);
  };

  // Fallback simplified regions if loading/fails
  const fallbackRegions = [
    { name: 'ภาคเหนือ', d: "M 55,6 L 196,6 L 207,34 L 210,66 L 206,112 L 200,154 L 192,174 L 169,178 L 148,170 L 128,178 L 106,170 L 83,176 L 62,163 L 50,143 L 44,114 L 44,80 L 48,52 Z", labelX: 128, labelY: 96, label: 'เหนือ' },
    { name: 'ภาคตะวันออกเฉียงเหนือ', d: "M 196,6 L 278,20 L 292,44 L 300,74 L 303,115 L 299,152 L 290,192 L 273,246 L 252,274 L 224,284 L 202,274 L 197,254 L 196,218 L 198,178 L 192,174 L 200,154 L 206,112 L 210,66 L 207,34 Z", labelX: 250, labelY: 175, label: 'อีสาน' },
    { name: 'ภาคกลาง', d: "M 83,176 L 106,170 L 128,178 L 148,170 L 169,178 L 192,174 L 198,178 L 196,218 L 197,254 L 202,274 L 197,298 L 181,317 L 159,323 L 133,320 L 109,323 L 90,315 L 74,301 L 68,283 L 66,256 L 66,224 Z", labelX: 134, labelY: 254, label: 'กลาง' },
    { name: 'ภาคตะวันตก', d: "M 44,80 L 44,114 L 50,143 L 62,163 L 83,176 L 66,224 L 66,256 L 68,283 L 66,305 L 50,315 L 32,303 L 18,281 L 14,254 L 14,224 L 18,198 L 24,174 L 30,152 L 34,126 L 38,102 Z", labelX: 40, labelY: 228, label: 'ตก' },
    { name: 'ภาคตะวันออก', d: "M 202,274 L 224,284 L 252,274 L 266,290 L 272,318 L 260,346 L 236,358 L 210,352 L 197,334 L 194,317 L 197,298 Z", labelX: 234, labelY: 320, label: 'ออก' },
    { name: 'ภาคใต้', d: "M 50,315 L 66,305 L 68,283 L 74,301 L 90,315 L 109,323 L 133,320 L 159,323 L 181,317 L 197,298 L 194,317 L 197,334 L 204,362 L 196,400 L 186,438 L 176,476 L 166,512 L 155,546 L 145,566 L 132,574 L 120,572 L 108,566 L 104,552 L 106,522 L 108,492 L 108,462 L 104,436 L 92,413 L 78,391 L 62,369 L 48,348 L 38,326 Z", labelX: 118, labelY: 460, label: 'ใต้' }
  ];

  return (
    <div className="map-container">
      <div className="card-header-clean" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div>
          <h4 className="card-title-clean" style={{ margin: 0 }}>🗺️ Thailand Map</h4>
          {loading ? (
            <span className="small text-danger animate-pulse">กำลังโหลดแผนที่...</span>
          ) : (
            <span className="small text-muted">{viewMode === 'region' ? 'คลิกเลือกภาคบนแผนที่' : 'แสดงยอดขายแยกรายจังหวัด'}</span>
          )}
        </div>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={() => setViewMode('region')}
            style={{
              background: viewMode === 'region' ? 'var(--accent)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '4px 10px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            รายภาค
          </button>
          <button
            onClick={() => setViewMode('province')}
            style={{
              background: viewMode === 'province' ? 'var(--accent)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '4px 10px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            รายจังหวัด
          </button>
        </div>
      </div>

      <div className="map-svg-wrap position-relative" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '6px 0 4px' }}>
        {paths.length > 0 ? (
          <svg
            viewBox="0 0 560 1025"
            style={{
              width: '100%',
              maxWidth: '360px',
              height: 'auto',
              maxHeight: '660px',
              filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.65))',
              transition: 'all 0.3s'
            }}
          >
            <defs>
              <radialGradient id="mapOcean" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </radialGradient>
            </defs>

            {/* Ocean background */}
            <rect x="-20" y="-20" width="600" height="1065" fill="url(#mapOcean)" rx="16" />

            <g id="detailed-map">
              {paths.map(p => {
                const reg = p.region;
                const isSelected = activeRegion === reg;
                const isHovered = hoveredRegion === reg;
                const isProvHovered = hoveredProvince === p.id;
                const thName = p.labelTH || provinceThaiNames[p.id] || p.label;
                const fill = getFillColor(reg, isProvHovered, thName);
                const color = REGION_COLORS[reg] || '#6366f1';

                return (
                  <path
                    key={p.id}
                    d={p.d}
                    fill={fill}
                    stroke={
                      isProvHovered
                        ? '#ffffff'
                        : (isSelected || isHovered)
                          ? 'rgba(255, 255, 255, 0.6)'
                          : 'rgba(255, 255, 255, 0.2)'
                    }
                    strokeWidth={isProvHovered ? '2.5' : (isSelected || isHovered) ? '1.5' : '0.7'}
                    cursor="pointer"
                    onClick={() => onRegionSelect(reg)}
                    onMouseEnter={() => {
                      setHoveredRegion(reg);
                      setHoveredProvince(p.id);
                    }}
                    onMouseMove={(e) => handleMouseMove(e, p)}
                    onMouseLeave={handleMouseLeave}
                    style={{
                      transition: 'fill 0.25s ease, stroke 0.2s ease, stroke-width 0.2s ease',
                      filter: isSelected ? `drop-shadow(0 0 6px ${color}aa)` : 'none'
                    }}
                  />
                );
              })}
            </g>

            {/* Region Labels */}
            {Object.entries(labelCoords).map(([regionName, { x, y, name }]) => {
              const isSelected = activeRegion === regionName;
              const isHovered = hoveredRegion === regionName;

              return (
                <text
                  key={regionName}
                  x={x}
                  y={y}
                  fill={isSelected || isHovered ? '#ffffff' : '#e2e8f0'}
                  fontSize={isSelected ? '26' : isHovered ? '22' : '18'}
                  fontWeight="900"
                  cursor="pointer"
                  onClick={() => onRegionSelect(regionName)}
                  onMouseEnter={() => setHoveredRegion(regionName)}
                  onMouseLeave={() => setHoveredRegion(null)}
                  paintOrder="stroke"
                  stroke="rgba(0,0,0,0.8)"
                  strokeWidth="5"
                  strokeLinejoin="round"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    transition: 'all 0.2s ease',
                    userSelect: 'none',
                    fontFamily: "'Prompt', sans-serif"
                  }}
                >
                  {name}
                </text>
              );
            })}
          </svg>
        ) : (
          <svg
            viewBox="0 0 310 590"
            style={{
              width: '100%',
              maxWidth: '360px',
              height: 'auto',
              maxHeight: '600px',
              filter: 'drop-shadow(0 6px 28px rgba(0,0,0,0.55))'
            }}
          >
            <defs>
              <radialGradient id="mapOcean" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor="#0c1526" />
                <stop offset="100%" stopColor="#060c18" />
              </radialGradient>
            </defs>
            <rect x="-10" y="-10" width="330" height="610" fill="url(#mapOcean)" rx="10" />

            {fallbackRegions.map(region => {
              const isSelected = activeRegion === region.name;
              const isHovered = hoveredRegion === region.name;
              const fill = getFillColor(region.name, false);

              return (
                <g key={region.name}>
                  <path
                    d={region.d}
                    fill={fill}
                    stroke={
                      isSelected
                        ? 'rgba(255,255,255,0.95)'
                        : isHovered
                          ? 'rgba(255,255,255,0.65)'
                          : 'rgba(255,255,255,0.18)'
                    }
                    strokeWidth={isSelected ? '2.2' : isHovered ? '1.8' : '0.9'}
                    strokeLinejoin="round"
                    cursor="pointer"
                    onClick={() => onRegionSelect(region.name)}
                    onMouseEnter={() => setHoveredRegion(region.name)}
                    onMouseMove={(e) => {
                      const sales = regionSales[region.name] || 0;
                      setTooltip({
                        show: true,
                        x: e.clientX + 15,
                        y: e.clientY + 15,
                        province: '',
                        region: region.name,
                        provSales: sales
                      });
                    }}
                    onMouseLeave={() => {
                      setTooltip(t => ({ ...t, show: false }));
                      setHoveredRegion(null);
                    }}
                    style={{
                      transition: 'fill 0.28s ease, stroke 0.2s ease, stroke-width 0.2s ease'
                    }}
                  />
                  <text
                    x={region.labelX}
                    y={region.labelY}
                    fill={isSelected ? '#ffffff' : isHovered ? '#f1f5f9' : '#cbd5e1'}
                    fontSize={isSelected ? '16' : isHovered ? '14' : '12.5'}
                    fontWeight="900"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    paintOrder="stroke"
                    stroke="#04080f"
                    strokeWidth="5"
                    strokeLinejoin="round"
                    pointerEvents="none"
                    style={{ userSelect: 'none', transition: 'all 0.2s ease', fontFamily: "'Prompt', sans-serif" }}
                  >
                    {region.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {/* Custom Tooltip */}
        {tooltip.show && (
          <div
            style={{
              position: 'fixed',
              left: tooltip.x,
              top: tooltip.y,
              zIndex: 1000,
              pointerEvents: 'none',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(12px)',
              padding: '12px 16px',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '13px',
              boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.7), 0 0 16px rgba(99, 102, 241, 0.25)',
              fontFamily: "'Prompt', sans-serif"
            }}
          >
            <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{tooltip.province ? `📍 ${tooltip.province}` : `🗺️ ${tooltip.region}`}</span>
              {tooltip.province && tooltip.provSales !== null && (
                <span style={{ fontSize: '10px', background: 'var(--accent)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>Top Province</span>
              )}
            </div>
            {tooltip.province && <div style={{ color: '#94a3b8', marginBottom: '6px' }}>ภูมิภาค: {tooltip.region}</div>}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px', fontSize: '12px' }}>
              {tooltip.province && tooltip.provSales !== null ? (
                <div style={{ marginBottom: '3px' }}>ยอดขายจังหวัด: <span style={{ color: 'var(--accent-hover)', fontWeight: 'bold' }}>{fmtFull(tooltip.provSales)}</span></div>
              ) : null}
              <div>ยอดขายภาค: <span style={{ color: '#fff', fontWeight: 'bold' }}>{fmtFull(regionSales[tooltip.region] || 0)}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Region Legend pills */}
      <div className="mt-2 d-flex justify-content-center flex-wrap gap-1 px-1" style={{ fontSize: '11px' }}>
        {Object.entries(REGION_COLORS).map(([rName, color]) => {
          const isActive = activeRegion === rName;
          return (
            <span
              key={rName}
              onClick={() => onRegionSelect(rName)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                background: isActive ? `${color}22` : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${isActive ? color : 'rgba(255,255,255,0.1)'}`,
                padding: '3px 10px', borderRadius: '20px',
                fontWeight: isActive ? '800' : '600',
                color: isActive ? '#f1f5f9' : '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0, boxShadow: isActive ? `0 0 6px ${color}` : 'none' }}></span>
              {rName.replace('ภาค', '')}
            </span>
          );
        })}
      </div>
    </div>
  );
}



const VALID_TABS = ['regional', 'exec', 'customer', 'product', 'dev', 'sync'];

// ===================== ERROR DETAIL MODAL COMPONENT =====================
function ErrorDetailModal({ log, onClose }) {
  if (!log) return null;
  const [allErrors, setAllErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState(null); // null means all
  const itemsPerPage = 5;

  useEffect(() => {
    setLoading(true);
    axios.get('/api/errors')
      .then(res => {
        setAllErrors(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.warn("Failed to fetch backend errors, falling back to mock details:", err.message);
        setAllErrors(generateMockErrorDetails(log));
        setLoading(false);
      });
  }, [log]);

  const totalCount = log.errorCount || allErrors.length;
  
  // Calculate total counts per type regardless of current filter
  const typeSummary = allErrors.reduce((acc, d) => {
    acc[d.errorType] = (acc[d.errorType] || 0) + 1;
    return acc;
  }, {});

  const formatDateTH = (isoStr) => {
    try {
      return new Date(isoStr).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' น.';
    } catch { return isoStr; }
  };

  // Filter errors by selected errorType
  const filteredErrors = selectedTypeFilter !== null
    ? allErrors.filter(d => d.errorType === selectedTypeFilter)
    : allErrors;

  const totalPages = Math.ceil(filteredErrors.length / itemsPerPage) || 1;
  const paginatedErrors = filteredErrors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleFilterClick = (typeNum) => {
    if (selectedTypeFilter === typeNum) {
      setSelectedTypeFilter(null); // toggle off
    } else {
      setSelectedTypeFilter(typeNum);
    }
    setCurrentPage(1);
  };

  return (
    <div
      id="error-detail-modal-overlay"
      onClick={(e) => e.target.id === 'error-detail-modal-overlay' && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div style={{
        background: '#0f172a',
        border: '1px solid rgba(239,68,68,0.25)',
        borderRadius: '16px',
        width: '100%', maxWidth: '820px',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px -20px rgba(0,0,0,0.8), 0 0 40px rgba(239,68,68,0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '20px' }}>🚨</span>
              <h4 style={{ margin: 0, color: '#f1f5f9', fontWeight: 700, fontSize: '17px' }}>รายละเอียดข้อผิดพลาด</h4>
              <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: 700 }}>
                {filteredErrors.length} / {totalCount} รายการ
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              รอบซิงค์: {formatDateTH(log.SyncDate)} · แสดงผลแบ่งหน้าละ {itemsPerPage} รายการ
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', padding: '6px 12px',
            fontSize: '14px', flexShrink: 0
          }}>✕ ปิด</button>
        </div>

        {/* Type Summary Pills */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => { setSelectedTypeFilter(null); setCurrentPage(1); }}
            style={{
              background: selectedTypeFilter === null ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${selectedTypeFilter === null ? 'var(--accent)' : 'rgba(255,255,255,0.12)'}`,
              color: '#fff', borderRadius: '20px', padding: '4px 12px',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            📋 ทั้งหมด ({allErrors.length})
          </button>
          {Object.entries(typeSummary).map(([typeNum, cnt]) => {
            const meta = ERROR_TYPE_LABELS[Number(typeNum)];
            const isSelected = selectedTypeFilter === Number(typeNum);
            return (
              <button
                key={typeNum}
                onClick={() => handleFilterClick(Number(typeNum))}
                style={{
                  background: isSelected ? meta.color : meta.color + '18',
                  border: `1px solid ${isSelected ? meta.color : meta.color + '40'}`,
                  color: isSelected ? '#fff' : meta.color,
                  borderRadius: '20px', padding: '4px 12px',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                {meta.icon} {meta.label} ({cnt})
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 24px 24px', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ padding: '40px', color: 'var(--accent)', textAlign: 'center', fontWeight: 'bold', fontSize: '15px' }}>
              กำลังดึงข้อมูลข้อผิดพลาดทั้งหมดจาก Database...
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginTop: '16px' }}>
                <thead>
                  <tr style={{ color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ padding: '8px 10px 10px', textAlign: 'left', fontWeight: 600 }}>OrderID</th>
                    <th style={{ padding: '8px 10px 10px', textAlign: 'left', fontWeight: 600 }}>ประเภทข้อผิดพลาด</th>
                    <th style={{ padding: '8px 10px 10px', textAlign: 'left', fontWeight: 600 }}>วันที่บันทึก</th>
                    <th style={{ padding: '8px 10px 10px', textAlign: 'left', fontWeight: 600 }}>สินค้า</th>
                    <th style={{ padding: '8px 10px 10px', textAlign: 'right', fontWeight: 600 }}>Quantity</th>
                    <th style={{ padding: '8px 10px 10px', textAlign: 'right', fontWeight: 600 }}>NetAmount</th>
                    <th style={{ padding: '8px 10px 10px', textAlign: 'left', fontWeight: 600 }}>สาเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedErrors.map((d, idx) => (
                    <tr key={d.orderID} style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                      transition: 'background 0.15s'
                    }}>
                      <td style={{ padding: '9px 10px', color: '#e2e8f0', fontWeight: 600, fontFamily: 'monospace' }}>
                        {d.orderID}
                      </td>
                      <td style={{ padding: '9px 10px' }}>
                        <span style={{
                          background: d.errorColor + '18', border: `1px solid ${d.errorColor}40`,
                          color: d.errorColor, borderRadius: '5px', padding: '2px 7px',
                          fontSize: '11.5px', fontWeight: 600, whiteSpace: 'nowrap'
                        }}>
                          {d.errorIcon} {d.errorLabel}
                        </span>
                      </td>
                      <td style={{ padding: '9px 10px', color: '#94a3b8', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {formatDateTH(d.orderDate)}
                      </td>
                      <td style={{ padding: '9px 10px', color: '#cbd5e1', fontSize: '12px' }}>
                        น้ำเปล่าลอย{d.product}
                      </td>
                      <td style={{
                        padding: '9px 10px', textAlign: 'right', fontWeight: 600,
                        color: d.quantity < 0 ? '#ef4444' : '#94a3b8'
                      }}>
                        {d.quantity !== null ? d.quantity : <span style={{ color: '#6b7280' }}>NULL</span>}
                      </td>
                      <td style={{
                        padding: '9px 10px', textAlign: 'right', fontWeight: 600,
                        color: d.netAmount === null ? '#6b7280' : d.netAmount < 0 ? '#ef4444' : '#94a3b8'
                      }}>
                        {d.netAmount !== null ? '฿' + d.netAmount.toLocaleString() : <span style={{ color: '#6b7280' }}>NULL</span>}
                      </td>
                      <td style={{ padding: '9px 10px', color: '#64748b', fontSize: '11.5px' }}>
                        {d.errorDesc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)',
                  fontSize: '12.5px', color: '#94a3b8'
                }}>
                  <div>
                    แสดง {Math.min((currentPage - 1) * itemsPerPage + 1, filteredErrors.length)} - {Math.min(currentPage * itemsPerPage, filteredErrors.length)} จาก {filteredErrors.length} รายการ
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        color: currentPage === 1 ? '#475569' : '#e2e8f0',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        padding: '5px 12px',
                        fontWeight: 600,
                        transition: 'all 0.2s'
                      }}
                    >
                      ◀ ย้อนกลับ
                    </button>
                    <span style={{ fontWeight: 700, color: '#f1f5f9', padding: '0 8px' }}>
                      หน้า {currentPage} / {totalPages}
                    </span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        color: currentPage === totalPages ? '#475569' : '#e2e8f0',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        padding: '5px 12px',
                        fontWeight: 600,
                        transition: 'all 0.2s'
                      }}
                    >
                      ถัดไป ▶
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function getTabFromHash() {
  const hash = window.location.hash.replace('#', '');
  return VALID_TABS.includes(hash) ? hash : 'regional';
}

function App() {
  const [activeTab, setActiveTab] = useState(getTabFromHash);
  const [isLive, setIsLive] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('ภาคกลาง'); // Default selected region for deep-dive

  // Data States
  const [kpis, setKpis] = useState(mockKpis);
  const [monthlyTrends, setMonthlyTrends] = useState(mockMonthly);
  const [regionSales, setRegionSales] = useState(mockRegions);
  const [categorySales, setCategorySales] = useState(mockCategories);
  const [customerRatio, setCustomerRatio] = useState({ Company: 1827644, Individual: 1009408 });
  const [topCustomers, setTopCustomers] = useState(mockTopCusts);
  const [topProvinces, setTopProvinces] = useState(mockTopProvs);
  const [provinceSales, setProvinceSales] = useState(generateMockProvinceSales);
  const [topProducts, setTopProducts] = useState(mockTopProducts);
  const [heatmap, setHeatmap] = useState(mockHeatmap);
  const [productionRecommendations, setProductionRecommendations] = useState([
    { region: 'ภาคเหนือ', product: 'น้ำเปล่าลอยมะลิ', insight: 'Hero Product ครองตลาด 45%+' },
    { region: 'ภาคกลาง', product: 'น้ำเปล่าลอยมะนาว-สะระแหน่', insight: 'Demand ผลไม้สดสูงกว่าค่าเฉลี่ย' },
    { region: 'ภาคตะวันออกเฉียงเหนือ', product: 'น้ำเปล่าลอยขิง-มะนาว', insight: 'สมุนไพร Category แข็งแกร่ง' },
    { region: 'ภาคใต้', product: 'น้ำเปล่าลอยส้มโอ', insight: 'รสชาติผลไม้เขตร้อนนิยม' },
    { region: 'ภาคตะวันออก', product: 'น้ำเปล่าลอยแอปเปิ้ล-อบเชย', insight: 'กำลังซื้อกลุ่มเมืองหลวง/EEC สูง' },
    { region: 'ภาคตะวันตก', product: 'น้ำเปล่าลอยดอกเก็กฮวย', insight: 'ความต้องการน้ำชาสมุนไพรแบบดั้งเดิม' }
  ]);

  const [regionalDetails, setRegionalDetails] = useState(mockRegionalDetail);
  const [syncLogs, setSyncLogs] = useState(mockSyncLogs);
  const [syncDiff, setSyncDiff] = useState(mockSyncDiff);
  const [selectedErrorLog, setSelectedErrorLog] = useState(null); // For error detail modal

  // Sync tab with URL hash
  useEffect(() => {
    const onHashChange = () => {
      const tab = getTabFromHash();
      setActiveTab(tab);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleTabChange = (tab) => {
    window.location.hash = tab;
    setActiveTab(tab);
  };

  useEffect(() => {
    // Fetch live backend analytics
    const fetchAnalytics = async () => {
      try {
        const kpiRes = await axios.get('/api/kpis');
        setKpis(kpiRes.data);

        const trendRes = await axios.get('/api/monthly-trends');
        setMonthlyTrends(trendRes.data);

        const regionRes = await axios.get('/api/region-sales');
        setRegionSales(regionRes.data);

        const catRes = await axios.get('/api/category-sales');
        setCategorySales(catRes.data);

        const custRes = await axios.get('/api/customer-segments');
        const companyData = custRes.data.ratio.find(r => r.CustomerType === 'Company') || { revenue: 1827644 };
        const indData = custRes.data.ratio.find(r => r.CustomerType === 'Individual') || { revenue: 1009408 };
        setCustomerRatio({ Company: companyData.revenue, Individual: indData.revenue });

        const topRes = await axios.get('/api/top-analytics');
        setTopCustomers(topRes.data.topCustomers);
        setTopProvinces(topRes.data.topProvinces);

        try {
          const provSalesRes = await axios.get('/api/province-sales');
          const pMap = {};
          provSalesRes.data.forEach(item => {
            pMap[item.n] = item.v;
          });
          setProvinceSales(pMap);
        } catch (e) {
          console.warn("Failed to fetch province sales", e.message);
        }

        const prodRes = await axios.get('/api/top-products');
        setTopProducts(prodRes.data);

        const heatRes = await axios.get('/api/heatmap');
        setHeatmap(heatRes.data);

        const devRes = await axios.get('/api/product-insights');
        setProductionRecommendations(devRes.data.productionRecommendations);

        // Fetch Sync Log & Differences
        try {
          const logRes = await axios.get('/api/sync-log');
          if (logRes.data && logRes.data.length > 0) {
            setSyncLogs(logRes.data);
          }
        } catch (e) {
          console.warn("Failed to fetch sync log", e.message);
        }

        try {
          const diffRes = await axios.get('/api/sync-diff');
          setSyncDiff(diffRes.data);
        } catch (e) {
          console.warn("Failed to fetch sync differences", e.message);
        }

        // Dynamically compute regional detail ratios & top elements from incoming data
        if (devRes.data.regionalFlavors && custRes.data.regionalBreakdown) {
          const updatedDetails = { ...mockRegionalDetail };

          Object.keys(updatedDetails).forEach(reg => {
            const regCustInfo = custRes.data.regionalBreakdown.filter(c => c.Region === reg);
            const comp = regCustInfo.find(c => c.CustomerType === 'Company') || { revenue: 0, customerCount: 0 };
            const ind = regCustInfo.find(c => c.CustomerType === 'Individual') || { revenue: 0, customerCount: 0 };
            const sumRevenue = comp.revenue + ind.revenue;

            if (sumRevenue > 0) {
              updatedDetails[reg].companyRatio = parseFloat((comp.revenue / sumRevenue * 100).toFixed(1));
              updatedDetails[reg].individualRatio = parseFloat((ind.revenue / sumRevenue * 100).toFixed(1));
            }

            // Get popular flavor and products
            const regFlavs = devRes.data.regionalFlavors[reg] || [];
            if (regFlavs.length > 0) {
              updatedDetails[reg].popularFlavor = regFlavs.slice(0, 2).map(f => f.flavor).join(', ');
              updatedDetails[reg].topProducts = regFlavs.slice(0, 3).map(f => ({ name: 'น้ำเปล่าลอย' + f.flavor, sales: f.revenue }));
            }
          });
          setRegionalDetails(updatedDetails);
        }

        setIsLive(true);
      } catch (err) {
        console.warn("Backend API not reachable. Using loaded mock data instead.", err.message);
        setIsLive(false);
      }
    };

    fetchAnalytics();
  }, []);

  // Data helpers for Chart.js
  const monthlyChartData = {
    labels: monthlyTrends.map(d => d.m),
    datasets: [{
      data: monthlyTrends.map(d => d.v),
      borderColor: '#6366f1',
      backgroundColor: (context) => {
        const chart = context.chart;
        const { ctx, chartArea } = chart;
        if (!chartArea) return null;
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
        return gradient;
      },
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#6366f1',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 7,
      borderWidth: 3
    }]
  };

  const regionDonutData = {
    labels: Object.keys(regionSales),
    datasets: [{
      data: Object.values(regionSales),
      backgroundColor: Object.keys(regionSales).map(r => REGION_COLORS[r] || '#6366f1'),
      borderWidth: 0,
      hoverOffset: 10
    }]
  };

  const catBarData = {
    labels: Object.keys(categorySales),
    datasets: [{
      data: Object.values(categorySales),
      backgroundColor: (context) => {
        const chart = context.chart;
        const { ctx, chartArea } = chart;
        if (!chartArea) return '#6366f1';

        const catKeysList = Object.keys(categorySales);
        const gradients = catKeysList.map((c) => {
          const color = CATEGORY_COLORS[c] || '#6366f1';
          const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, color);
          g.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
          return g;
        });
        return gradients[context.dataIndex % gradients.length];
      },
      borderRadius: 6,
      borderSkipped: false,
      barPercentage: 0.5
    }]
  };

  const custTypeDonutData = {
    labels: ['Company', 'Individual'],
    datasets: [{
      data: [customerRatio.Company, customerRatio.Individual],
      backgroundColor: [CUSTOMER_COLORS.Company, CUSTOMER_COLORS.Individual],
      borderWidth: 0,
      hoverOffset: 10
    }]
  };

  const custTypeBarData = {
    labels: ['Company (บริษัท)', 'Individual (บุคคล)'],
    datasets: [{
      data: [customerRatio.Company, customerRatio.Individual],
      backgroundColor: (context) => {
        const chart = context.chart;
        const { ctx, chartArea } = chart;
        if (!chartArea) return '#6366f1';
        const g1 = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        g1.addColorStop(0, '#6366f1'); g1.addColorStop(1, '#312e81');
        const g2 = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        g2.addColorStop(0, '#ec4899'); g2.addColorStop(1, '#9d174d');
        return [g1, g2][context.dataIndex];
      },
      borderRadius: 8,
      borderSkipped: false,
      barPercentage: 0.4
    }]
  };

  const regionBarData = {
    labels: Object.keys(regionSales).map(r => r.replace('ภาค', '')),
    datasets: [{
      data: Object.values(regionSales),
      backgroundColor: (context) => {
        const chart = context.chart;
        const { ctx, chartArea } = chart;
        if (!chartArea) return '#6366f1';

        const regKeysList = Object.keys(regionSales);
        return regKeysList.map(r => {
          const c = REGION_COLORS[r] || '#6366f1';
          const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0.4)');
          return g;
        })[context.dataIndex % regKeysList.length];
      },
      borderRadius: 8,
      borderSkipped: false,
      barPercentage: 0.55
    }]
  };

  const getProductColor = (productName) => {
    if (productName.includes('มะลิ') || productName.includes('กุหลาบ') || productName.includes('เก็กฮวย') || productName.includes('อัญชัน')) return CATEGORY_COLORS['ดอกไม้ไทย'];
    if (productName.includes('มะนาว') || productName.includes('ส้ม') || productName.includes('แตงโม') || productName.includes('แอปเปิ้ล') || productName.includes('ผลไม้') || productName.includes('พีช')) return CATEGORY_COLORS['ผลไม้สดชื่น'];
    if (productName.includes('ขิง') || productName.includes('ใบเตย') || productName.includes('สมุนไพร') || productName.includes('ขมิ้น')) return CATEGORY_COLORS['สมุนไพร'];
    return CATEGORY_COLORS['Premium'];
  };

  const topProductBarData = {
    labels: topProducts.map(p => p.n.replace('น้ำเปล่าลอย', '')),
    datasets: [{
      data: topProducts.map(p => p.v),
      backgroundColor: (context) => {
        const chart = context.chart;
        const { ctx, chartArea } = chart;
        if (!chartArea) return '#6366f1';
        return topProducts.map((p) => {
          const baseColor = getProductColor(p.n);
          const g = ctx.createLinearGradient(0, 0, chartArea.right, 0);
          g.addColorStop(0, baseColor); g.addColorStop(1, 'rgba(0,0,0,0.4)');
          return g;
        })[context.dataIndex];
      },
      borderRadius: 5,
      borderSkipped: false
    }]
  };

  const regionKeys = Object.keys(regionSales);
  const regionVals = Object.values(regionSales);
  const totalRegion = regionVals.reduce((a, b) => a + b, 0);

  const catKeys = Object.keys(categorySales);
  const catVals = Object.values(categorySales);
  const totalCat = catVals.reduce((a, b) => a + b, 0);

  // Heatmap rendering variables
  const hmRegions = ['ภาคกลาง', 'ภาคตะวันออกเฉียงเหนือ', 'ภาคใต้', 'ภาคตะวันออก', 'ภาคตะวันตก', 'ภาคเหนือ'];
  const hmCats = ['ดอกไม้ไทย', 'ผลไม้สดชื่น', 'สมุนไพร', 'Premium'];

  // Calculate min/max values dynamically
  const allVals = hmRegions.flatMap(r => hmCats.map(c => (heatmap[r] && heatmap[r][c]) || 0));
  const minV = Math.min(...allVals) || 0;
  const maxV = Math.max(...allVals) || 1;

  const getHeatmapColorStyles = (val) => {
    const t = (val - minV) / (maxV - minV);
    // Cosmic gradient: Deep space blue -> Deep Indigo -> Electric Indigo -> Luminous Cyan
    const colors = [[17, 24, 39], [49, 46, 129], [79, 70, 229], [6, 182, 212]];
    const idx = Math.min(Math.floor(t * (colors.length - 1)), colors.length - 2);
    const frac = t * (colors.length - 1) - idx;
    const [r1, g1, b1] = colors[idx];
    const [r2, g2, b2] = colors[idx + 1];

    const bgColor = `rgb(${Math.round(r1 + (r2 - r1) * frac)},${Math.round(g1 + (g2 - g1) * frac)},${Math.round(b1 + (b2 - b1) * frac)})`;
    const textColor = '#ffffff';
    return { backgroundColor: bgColor, color: textColor };
  };

  const regionStackBarData = {
    labels: hmRegions.map(r => r.replace('ภาค', '')),
    datasets: hmCats.map((c) => ({
      label: c,
      data: hmRegions.map(r => (heatmap[r] && heatmap[r][c]) || 0),
      backgroundColor: CATEGORY_COLORS[c] || '#6366f1',
      borderRadius: 0,
      stack: 's'
    }))
  };

  const newProducts = [
    { name: 'น้ำเปล่าลอยมะลิ-ลิ้นจี่', target: 'ภาคเหนือ + ภาคกลาง', reason: 'ต่อยอด Hero Product ด้วยรสชาติประจำฤดูกาล (ลิ้นจี่) เพื่อรองรับตลาดเหนือและกลาง' },
    { name: 'น้ำเปล่าลอยยูสุ-มะนาว', target: 'ภาคกลาง + ภาคตะวันออก', reason: 'รสชาติแนวพรีเมียม ส้มยูสุผสมมะนาว เจาะกลุ่มวัยทำงานและเขตเมืองหลวงที่มีกำลังซื้อสูง' },
    { name: 'น้ำเปล่าลอยอัญชัน Sparkling', target: 'ภาคใต้ + ภาคตะวันตก', reason: 'เพื่มความสดชื่นด้วยคาร์บอเนต ดึงดูดกลุ่มนักท่องเที่ยวชาวต่างชาติและโรงแรมพรีเมียม' },
    { name: 'น้ำเปล่าลอยขมิ้น-มะนาว', target: 'ภาคตะวันออกเฉียงเหนือ', reason: 'กระตุ้นตลาดสุขภาพ (Healthy Tonic) ที่เติบโตอย่างรวดเร็วในภาคอีสาน' }
  ];

  // Selected Region's Specific Detail Object
  const currentRegDetail = regionalDetails[selectedRegion] || mockRegionalDetail['ภาคกลาง'];

  const provincesInRegion = Object.entries(provinceEnNameToRegion)
    .filter(([enName, reg]) => reg === selectedRegion)
    .map(([enName, reg]) => {
      const thName = provinceEnToTH[enName] || enName;
      const sales = provinceSales[thName] || 0;
      return {
        id: enName.toLowerCase().replace(/\s+/g, '_'),
        name: thName,
        sales: sales
      };
    });
  provincesInRegion.sort((a, b) => b.sales - a.sales);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div>
      {/* Error Detail Modal */}
      <ErrorDetailModal log={selectedErrorLog} onClose={() => setSelectedErrorLog(null)} />
      {/* NAVBAR */}
      <nav className="navbar navbar-expand-lg navbar-dark navbar-custom">
        <div className="container-fluid">
          <div className="d-flex align-items-center">
            <div className="logo-icon me-3">🌸</div>
            <div>
              <h1 className="brand-title">Loymalila Analytics</h1>
              <span className="brand-sub">ลอยมะลิลา — Sales Data Mart 2025</span>
            </div>
          </div>

          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="navbarNav">
            <div className="navbar-nav mx-auto mt-2 mt-lg-0">
              <button
                className={`nav-tab-custom ${activeTab === 'regional' ? 'active' : ''}`}
                onClick={() => handleTabChange('regional')}
              >
                📍 Regional Summary
              </button>
              <button
                className={`nav-tab-custom ${activeTab === 'exec' ? 'active' : ''}`}
                onClick={() => handleTabChange('exec')}
              >
                📊 Executive Overview
              </button>
              <button
                className={`nav-tab-custom tab-customer ${activeTab === 'customer' ? 'active' : ''}`}
                onClick={() => handleTabChange('customer')}
              >
                👥 Customer Analytics
              </button>
              <button
                className={`nav-tab-custom tab-product ${activeTab === 'product' ? 'active' : ''}`}
                onClick={() => handleTabChange('product')}
              >
                🧴 Product Analytics
              </button>
              <button
                className={`nav-tab-custom tab-dev ${activeTab === 'dev' ? 'active' : ''}`}
                onClick={() => handleTabChange('dev')}
              >
                🔬 Product Development
              </button>
              <button
                className={`nav-tab-custom tab-sync ${activeTab === 'sync' ? 'active' : ''}`}
                onClick={() => handleTabChange('sync')}
              >
                🔄 Sync History & Preview
              </button>
            </div>

            <div className="d-flex align-items-center mt-2 mt-lg-0 gap-2 flex-wrap justify-content-end">
              {isLive && (syncDiff.newRecords?.length > 0 || syncDiff.modifiedRecords?.length > 0) && (
                <span
                  className="badge-custom text-warning"
                  style={{ background: 'rgba(245, 158, 11, 0.08)', cursor: 'pointer', border: '1px solid #f59e0b', fontWeight: 'bold' }}
                  onClick={() => handleTabChange('sync')}
                >
                  ⚠️ รอนำเข้า (+{syncDiff.newRecords?.length || 0}, ~{syncDiff.modifiedRecords?.length || 0})
                </span>
              )}
              <span className={`badge-custom ${isLive ? 'border-danger text-danger' : 'border-secondary text-secondary'}`} style={{ background: 'rgba(225, 29, 72, 0.03)' }}>
                {isLive ? '● Live Data (pumpui_show)' : '○ Sandbox (Mock Data)'}
              </span>
              <span className="badge-custom border-danger text-danger" style={{ background: 'rgba(225, 29, 72, 0.03)' }}>
                📊 {(kpis.totalRows || 1500).toLocaleString()} แถว
              </span>
              <span className="badge-custom border-danger text-danger" style={{ background: 'rgba(225, 29, 72, 0.03)' }}>
                🕒 ข้อมูลล่าสุด: {formatDate(kpis.lastSyncDate || '2025-12-31T00:00:00.000Z')}
              </span>
              <span className="badge-custom">2025 Full Year</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="container dashboard-page">

        {/* ==================== PAGE 0: REGIONAL SUMMARY (Thailand map & Region Deep-Dive) ==================== */}
        {activeTab === 'regional' && (
          <div className="row g-4 mb-5">
            <div className="col-12 col-lg-5">
              <div className="dashboard-card" style={{ padding: '16px 12px 12px' }}>
                <ThailandMap
                  activeRegion={selectedRegion}
                  onRegionSelect={setSelectedRegion}
                  regionSales={regionSales}
                  topProvinces={topProvinces}
                  provinceSales={provinceSales}
                />
              </div>
            </div>

            <div className="col-12 col-lg-7">
              <div className="dashboard-card d-flex flex-column justify-content-between" style={{ borderColor: 'rgba(225, 29, 72, 0.2)', boxShadow: 'var(--card-shadow)', padding: '28px' }}>
                <div>
                  <div className="card-header-clean mb-4 pb-3">
                    <h3 className="card-title-clean fs-4 text-uppercase mb-0" style={{ color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.5px' }}>
                      📍 Region Summary: {selectedRegion}
                    </h3>
                    <span className="badge-custom px-3 py-2">
                      รายได้ภาค: {fmtFull(regionSales[selectedRegion] || 0)}
                    </span>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-12 col-sm-6">
                      <div className="detail-grid-item">
                        <div className="detail-grid-title">🏆 Province Leader</div>
                        <div className="detail-grid-value">{currentRegDetail.topProvince}</div>
                        <div className="small text-danger mt-2 font-semibold">
                          ยอดขายสุทธิ: {fmtFull(currentRegDetail.topProvinceSales)}
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-sm-6">
                      <div className="detail-grid-item">
                        <div className="detail-grid-title">🍒 Favorite Flavors</div>
                        <div className="detail-grid-value fs-5 mt-1">
                          {currentRegDetail.popularFlavor}
                        </div>
                        <div className="small text-muted mt-2">
                          รสชาติขายสะสมยอดนิยมประจำภาค
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="row g-3">
                    <div className="col-12 col-sm-6">
                      <div className="detail-grid-item d-flex flex-column justify-content-between">
                        <div>
                          <div className="detail-grid-title">👥 Customer Segmentation</div>
                        </div>
                        <div>
                          <div className="progress-row mb-2">
                            <div className="progress-label" style={{ minWidth: '80px' }}>🏢 บริษัท</div>
                            <div className="progress-bar-wrap">
                              <div className="progress-bar-custom" style={{ width: `${currentRegDetail.companyRatio}%`, background: 'var(--accent)', boxShadow: '0 2px 5px rgba(225, 29, 72, 0.15)' }}></div>
                            </div>
                            <div className="progress-val" style={{ minWidth: '45px' }}>{currentRegDetail.companyRatio}%</div>
                          </div>
                          <div className="progress-row mb-0">
                            <div className="progress-label" style={{ minWidth: '80px' }}>👤 บุคคล</div>
                            <div className="progress-bar-wrap">
                              <div className="progress-bar-custom" style={{ width: `${currentRegDetail.individualRatio}%`, background: 'var(--accent4)' }}></div>
                            </div>
                            <div className="progress-val" style={{ minWidth: '45px' }}>{currentRegDetail.individualRatio}%</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-sm-6">
                      <div className="detail-grid-item">
                        <div className="detail-grid-title">🧴 Best Selling Products</div>
                        {currentRegDetail.topProducts.map((p, idx) => (
                          <div className="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom" style={{ borderColor: 'var(--border)', fontSize: '12.5px' }} key={p.name}>
                            <span className="text-secondary text-truncate" style={{ maxWidth: '170px' }}>{idx + 1}. {p.name.replace('น้ำเปล่าลอย', '')}</span>
                            <span className="font-semibold text-danger" style={{ color: 'var(--accent)' }}>{fmtFull(p.sales)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  {/* Province Breakdown */}
                  <div className="mt-4 mb-2">
                    <div className="detail-grid-title mb-2" style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--accent)' }}>
                      📍 ยอดขายแยกตามจังหวัดใน{selectedRegion} (เรียงจากมากไปน้อย)
                    </div>
                    <div style={{ 
                      maxHeight: '160px', 
                      overflowY: 'auto', 
                      background: 'rgba(255,255,255,0.02)', 
                      border: '1px solid rgba(255,255,255,0.06)', 
                      borderRadius: '10px', 
                      padding: '12px'
                    }}>
                      <div className="row g-2">
                        {provincesInRegion.map((prov, idx) => (
                          <div className="col-6 col-md-4" key={prov.id}>
                            <div style={{ 
                              background: 'rgba(255,255,255,0.03)', 
                              border: '1px solid rgba(255,255,255,0.04)',
                              borderRadius: '8px', 
                              padding: '8px 10px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              height: '100%'
                            }}>
                              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={prov.name}>
                                {idx + 1}. {prov.name}
                              </span>
                              <span style={{ fontSize: '12.5px', color: '#f8fafc', fontWeight: 700, marginTop: '2px' }}>
                                {fmtFull(prov.sales)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded" style={{ background: 'var(--accent-light)', border: '1px dashed var(--accent)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-hover)' }} className="mb-2">📋 คำแนะนำการจัดการ & พัฒนาผลิตภัณฑ์ใน {selectedRegion}</div>
                  <div className="small text-secondary mb-1">• <b>เพิ่มกำลังผลิต:</b> <span className="text-light font-medium">{currentRegDetail.productionRecommendation}</span></div>
                  <div className="small text-secondary">• <b>โอกาสสินค้าใหม่:</b> <span className="text-light font-medium">{currentRegDetail.newProductOpportunity}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== PAGE 1: EXECUTIVE OVERVIEW ==================== */}
        {activeTab === 'exec' && (
          <div>
            <div className="page-header-custom">
              <h2>Executive Overview</h2>
              <p>ภาพรวมธุรกิจ น้ำเปล่าลอยมะลิลา — ยอดขายรวมปี 2025 จาก 77 จังหวัดทั่วประเทศ</p>
            </div>

            <div className="row g-4 mb-4">
              <div className="col-12 col-sm-6 col-lg-3">
                <div className="kpi-card" style={{ '--accent-color': 'var(--accent)' }}>
                  <div className="kpi-label">Revenue (Net)</div>
                  <div className="kpi-value">{fmtFull(kpis.revenue)}</div>
                  <div className="kpi-sub">NetAmount รวมทุก Transaction</div>
                  <div className="kpi-icon">💰</div>
                </div>
              </div>
              <div className="col-12 col-sm-6 col-lg-3">
                <div className="kpi-card" style={{ '--accent-color': 'var(--accent3)' }}>
                  <div className="kpi-label">Total Orders</div>
                  <div className="kpi-value">{kpis.orders.toLocaleString()}</div>
                  <div className="kpi-sub">Transactions ตลอดปี 2025</div>
                  <div className="kpi-icon">📦</div>
                </div>
              </div>
              <div className="col-12 col-sm-6 col-lg-3">
                <div className="kpi-card" style={{ '--accent-color': 'var(--accent2)' }}>
                  <div className="kpi-label">Customers</div>
                  <div className="kpi-value">{kpis.customers}</div>
                  <div className="kpi-sub">ลูกค้าบุคคล + บริษัท</div>
                  <div className="kpi-icon">👥</div>
                </div>
              </div>
              <div className="col-12 col-sm-6 col-lg-3">
                <div className="kpi-card" style={{ '--accent-color': 'var(--hero)' }}>
                  <div className="kpi-label">Products</div>
                  <div className="kpi-value">{kpis.products}</div>
                  <div className="kpi-sub">4 กลุ่มสินค้า | 15 ผลิตภัณฑ์</div>
                  <div className="kpi-icon">🧴</div>
                </div>
              </div>
            </div>

            <div className="row g-4 mb-4">
              <div className="col-12 col-lg-8">
                <div className="dashboard-card">
                  <div className="card-header-clean">
                    <h4 className="card-title-clean">📈 Monthly Revenue Trend</h4>
                    <span className="card-sub-clean">NetAmount รายเดือน (ม.ค. – ธ.ค. 2025)</span>
                  </div>
                  <div className="chart-container" style={{ height: '300px' }}>
                    <Line data={monthlyChartData} options={{ ...chartDefaults, scales: lightScales }} />
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-4">
                <div className="dashboard-card d-flex flex-column justify-content-between">
                  <div>
                    <div className="card-header-clean">
                      <h4 className="card-title-clean">🌏 Revenue by Region</h4>
                      <span className="card-sub-clean">สัดส่วนยอดขายรายภาค</span>
                    </div>
                    <div className="chart-container mx-auto" style={{ height: '180px', maxWidth: '180px' }}>
                      <Doughnut data={regionDonutData} options={{ ...chartDefaults, cutout: '75%' }} />
                    </div>
                  </div>
                  <div className="donut-legend">
                    {regionKeys.map((k, i) => (
                      <div className="legend-row" key={k}>
                        <div className="legend-dot" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                        <div className="legend-label">{k.replace('ภาค', '')}</div>
                        <div className="legend-val">{(regionSales[k] / totalRegion * 100).toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-4">
              <div className="col-12 col-lg-6">
                <div className="dashboard-card">
                  <div className="card-header-clean">
                    <h4 className="card-title-clean">🛍️ Revenue by Product Category</h4>
                    <span className="card-sub-clean">ยอดขายแยกตามกลุ่มหมวดหมู่สินค้า</span>
                  </div>
                  <div className="chart-container" style={{ height: '270px' }}>
                    <Bar data={catBarData} options={{ ...chartDefaults, scales: lightScales }} />
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-6">
                <div className="dashboard-card d-flex flex-column justify-content-between">
                  <div>
                    <div className="card-header-clean">
                      <h4 className="card-title-clean">🏢 Customer Type Ratio</h4>
                      <span className="card-sub-clean">สัดส่วนรายได้ บริษัท vs บุคคล</span>
                    </div>
                    <div className="chart-container mx-auto" style={{ height: '160px', maxWidth: '160px' }}>
                      <Doughnut data={custTypeDonutData} options={{ ...chartDefaults, cutout: '75%' }} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="progress-row">
                      <div className="progress-label">🏢 Company (บริษัท)</div>
                      <div className="progress-bar-wrap">
                        <div
                          className="progress-bar-custom"
                          style={{
                            width: `${(customerRatio.Company / (customerRatio.Company + customerRatio.Individual) * 100).toFixed(1)}%`,
                            background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))',
                            boxShadow: '0 2px 5px rgba(225, 29, 72, 0.1)'
                          }}
                        ></div>
                      </div>
                      <div className="progress-val">{(customerRatio.Company / (customerRatio.Company + customerRatio.Individual) * 100).toFixed(1)}%</div>
                    </div>
                    <div className="progress-row">
                      <div className="progress-label">👤 Individual (บุคคล)</div>
                      <div className="progress-bar-wrap">
                        <div
                          className="progress-bar-custom"
                          style={{
                            width: `${(customerRatio.Individual / (customerRatio.Company + customerRatio.Individual) * 100).toFixed(1)}%`,
                            background: 'linear-gradient(90deg, var(--accent3), var(--accent4))'
                          }}
                        ></div>
                      </div>
                      <div className="progress-val">{(customerRatio.Individual / (customerRatio.Company + customerRatio.Individual) * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== PAGE 2: CUSTOMER ANALYTICS ==================== */}
        {activeTab === 'customer' && (
          <div>
            <div className="page-header-custom">
              <h2>Customer Analytics</h2>
              <p>วิเคราะห์ลูกค้า — Top Customers, การกระจายตามจังหวัด, สัดส่วนประเภทลูกค้า</p>
            </div>

            <div className="row g-4 mb-4">
              <div className="col-12 col-lg-6">
                <div className="dashboard-card">
                  <div className="card-header-clean">
                    <h4 className="card-title-clean">👥 Top 10 Customers by Revenue</h4>
                    <span className="card-sub-clean">ลูกค้ายอดขายสูงสุด</span>
                  </div>
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>ลูกค้า</th>
                          <th>ประเภท</th>
                          <th>ยอดขาย (฿)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topCustomers.map((c, i) => {
                          const badge = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
                          const shortName = c.n.replace('บริษัท ', '').replace(' จำกัด', '');
                          return (
                            <tr key={i}>
                              <td><span className={`rank-badge ${badge}`}>{i + 1}</span></td>
                              <td>{shortName}</td>
                              <td>{c.t === 'Company' ? '🏢 บริษัท' : '👤 บุคคล'}</td>
                              <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmtFull(c.v)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-6">
                <div className="dashboard-card">
                  <div className="card-header-clean">
                    <h4 className="card-title-clean">📍 Top 10 Provinces by Revenue</h4>
                    <span className="card-sub-clean">จังหวัดสร้างยอดขายสูงสุด</span>
                  </div>
                  <div className="p-2">
                    {topProvinces.map((p, i) => {
                      const barColor = COLORS[i % COLORS.length];
                      const maxVal = topProvinces[0].v;
                      return (
                        <div className="progress-row" key={p.n}>
                          <div className="progress-label">{p.n}</div>
                          <div className="progress-bar-wrap">
                            <div
                              className="progress-bar-custom"
                              style={{
                                width: `${(p.v / maxVal * 100).toFixed(0)}%`,
                                background: `linear-gradient(90deg, ${barColor}, #fff)`,
                                boxShadow: `0 2px 5px rgba(225,29,72,0.03)`
                              }}
                            ></div>
                          </div>
                          <div className="progress-val">{fmt(p.v)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-4 mb-4">
              <div className="col-12 col-lg-6">
                <div className="dashboard-card">
                  <div className="card-header-clean">
                    <h4 className="card-title-clean">🏢 Company vs Individual Revenue</h4>
                    <span className="card-sub-clean">เปรียบเทียบประเภทลูกค้า</span>
                  </div>
                  <div className="chart-container" style={{ height: '280px' }}>
                    <Bar data={custTypeBarData} options={{ ...chartDefaults, scales: lightScales }} />
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-6">
                <div className="dashboard-card">
                  <div className="card-header-clean">
                    <h4 className="card-title-clean">🌏 Revenue Distribution by Region</h4>
                    <span className="card-sub-clean">ยอดขายรายภาค</span>
                  </div>
                  <div className="chart-container" style={{ height: '280px' }}>
                    <Bar data={regionBarData} options={{ ...chartDefaults, scales: lightScales }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="insight-box">
              <h4>💡 Key Insights</h4>
              <div className="insight-item">• ลูกค้าบริษัทคิดเป็น <span>64.4%</span> ของยอดขายทั้งหมด แม้มีจำนวนลูกค้าน้อยกว่าลูกค้าบุคคล เพื่อเพิ่มประสิทธิภาพ fulfillment ควรเน้นการขนส่งล็อตใหญ่</div>
              <div className="insight-item">• Top 3 จังหวัดสร้างรายได้หลัก: <span style={{ background: 'rgba(225,29,72,0.05)', color: 'var(--accent2)', borderColor: 'rgba(225,29,72,0.15)' }}>สมุทรปราการ ({fmtFull(topProvinces[0]?.v || 424391)})</span>, ขอนแก่น ({fmtFull(topProvinces[1]?.v || 289135)}), และกาฬสินธุ์ ({fmtFull(topProvinces[2]?.v || 189286)})</div>
              <div className="insight-item">• ภูมิภาคยอดขายอันดับ 1 คือ <span style={{ background: 'rgba(225,29,72,0.05)', color: 'var(--accent2)', borderColor: 'rgba(225,29,72,0.15)' }}>ภาคกลาง</span> ซึ่งคิดเป็นประมาณ 40.1% ของยอดขายทั้งหมดของแบรนด์</div>
            </div>
          </div>
        )}

        {/* ==================== PAGE 3: PRODUCT ANALYTICS ==================== */}
        {activeTab === 'product' && (
          <div>
            <div className="page-header-custom">
              <h2>Product Analytics</h2>
              <p>วิเคราะห์สินค้า — Hero Product, Category Performance, Top Products</p>
            </div>

            <div className="row g-4 mb-4">
              <div className="col-12 col-sm-6 col-lg-3">
                <div className="kpi-card" style={{ '--accent-color': 'var(--hero)' }}>
                  <div className="kpi-label">Hero Product Revenue</div>
                  <div className="kpi-value">฿788K</div>
                  <div className="kpi-sub">น้ำเปล่าลอยมะลิ — 27.8% ของยอดรวม</div>
                  <div className="kpi-icon">⭐</div>
                </div>
              </div>
              <div className="col-12 col-sm-6 col-lg-3">
                <div className="kpi-card" style={{ '--accent-color': 'var(--accent)' }}>
                  <div className="kpi-label">ดอกไม้ไทย Category</div>
                  <div className="kpi-value">฿1.17M</div>
                  <div className="kpi-sub">41.2% — Category ยอดขายสูงสุด</div>
                  <div className="kpi-icon">🌸</div>
                </div>
              </div>
              <div className="col-12 col-sm-6 col-lg-3">
                <div className="kpi-card" style={{ '--accent-color': 'var(--accent3)' }}>
                  <div className="kpi-label">ผลไม้สดชื่น Category</div>
                  <div className="kpi-value">฿829K</div>
                  <div className="kpi-sub">29.2% — Category อันดับ 2</div>
                  <div className="kpi-icon">🍋</div>
                </div>
              </div>
              <div className="col-12 col-sm-6 col-lg-3">
                <div className="kpi-card" style={{ '--accent-color': 'var(--accent2)' }}>
                  <div className="kpi-label">Premium / Limited</div>
                  <div className="kpi-value">฿278K</div>
                  <div className="kpi-sub">9.8% — โอกาสเติบโตราคาสูง</div>
                  <div className="kpi-icon">💎</div>
                </div>
              </div>
            </div>

            <div className="row g-4 mb-4">
              <div className="col-12 col-lg-8">
                <div className="dashboard-card">
                  <div className="card-header-clean">
                    <h4 className="card-title-clean">🧴 Top 10 Products by Revenue</h4>
                    <span className="card-sub-clean">ยอดขายสะสมรายสินค้า</span>
                  </div>
                  <div className="chart-container" style={{ height: '320px' }}>
                    <Bar
                      data={topProductBarData}
                      options={{
                        ...chartDefaults,
                        indexAxis: 'y',
                        scales: {
                          x: {
                            grid: { color: 'rgba(255, 255, 255, 0.08)', drawBorder: false },
                            ticks: { color: '#94a3b8', font: { size: 11 }, callback: v => '฿' + (v / 1000) + 'K' }
                          },
                          y: {
                            grid: { display: false },
                            ticks: { color: 'var(--text-secondary)', font: { size: 12 } }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-4">
                <div className="dashboard-card d-flex flex-column justify-content-between">
                  <div>
                    <div className="card-header-clean">
                      <h4 className="card-title-clean">📊 Product Category Performance</h4>
                      <span className="card-sub-clean">สัดส่วนยอดขายรายกลุ่ม</span>
                    </div>
                    <div className="chart-container mx-auto" style={{ height: '180px', maxWidth: '180px' }}>
                      <Doughnut data={{
                        labels: catKeys,
                        datasets: [{
                          data: catVals,
                          backgroundColor: catKeys.map(c => CATEGORY_COLORS[c] || '#6366f1'),
                          borderWidth: 0,
                          hoverOffset: 10
                        }]
                      }} options={{ ...chartDefaults, cutout: '75%' }} />
                    </div>
                  </div>
                  <div className="donut-legend">
                    {catKeys.map((k, i) => (
                      <div className="legend-row" key={k}>
                        <div className="legend-dot" style={{ backgroundColor: CATEGORY_COLORS[k] || '#6366f1' }}></div>
                        <div className="legend-label">{k}</div>
                        <div className="legend-val">{(categorySales[k] / totalCat * 100).toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-4">
              <div className="col-12">
                <div className="dashboard-card">
                  <div className="card-header-clean">
                    <h4 className="card-title-clean">⭐ Hero Product Contribution vs Others</h4>
                    <span className="card-sub-clean">ส่วนแบ่งน้ำเปล่าลอยมะลิเทียบกับสินค้าทั้งหมด</span>
                  </div>
                  <div className="p-3">
                    {topProducts.map((p, i) => {
                      const isHero = i === 0;
                      const barColor = isHero ? 'var(--accent)' : getProductColor(p.n);
                      const maxP = topProducts[0].v;
                      return (
                        <div className="progress-row" key={p.n}>
                          <div className="progress-label" style={{ color: isHero ? 'var(--accent-hover)' : 'var(--text-primary)', fontWeight: isHero ? 700 : 400 }}>
                            {isHero ? '⭐ ' : ''} {p.n.replace('น้ำเปล่าลอย', '')}
                          </div>
                          <div className="progress-bar-wrap">
                            <div
                              className="progress-bar-custom"
                              style={{
                                width: `${(p.v / maxP * 100).toFixed(0)}%`,
                                background: `linear-gradient(90deg, ${barColor}, rgba(255,255,255,0.05))`,
                                boxShadow: isHero ? '0 2px 6px rgba(99,102,241,0.25)' : `0 1px 3px rgba(0,0,0,0.01)`
                              }}
                            ></div>
                          </div>
                          <div className="progress-val">{fmt(p.v)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="insight-box" style={{ borderColor: 'var(--accent)', background: 'var(--accent-light)' }}>
              <h4 style={{ color: 'var(--accent-hover)' }}>⭐ Hero Product Insight</h4>
              <div className="insight-item">• <span style={{ background: 'var(--surface2)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}>น้ำเปล่าลอยมะลิ</span> คือสินค้าหลัก มียอดขายสูงสุดถึง ฿788,481 คิดเป็น <span style={{ background: 'var(--surface2)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}>27.8%</span> ของบริษัท</div>
              <div className="insight-item">• สินค้าขายดีอันดับ 2 (ลอยมะนาว-สะระแหน่) มียอดขาย ฿393,552 แสดงให้เห็นว่า Hero Product มียอดขายสูงกว่าถึง <span style={{ background: 'var(--surface2)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}>2 เท่า (2x)</span></div>
              <div className="insight-item">• ยอดขายกลุ่มดอกไม้ไทยรวมคิดเป็น <span style={{ background: 'var(--surface2)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}>41.2%</span> ถือเป็นเสาหลักที่ช่วยขับเคลื่อนรายได้ทั้งหมดของโรงงานลอยมะลิลา</div>
            </div>
          </div>
        )}

        {/* ==================== PAGE 4: PRODUCT DEVELOPMENT ==================== */}
        {activeTab === 'dev' && (
          <div>
            <div className="page-header-custom">
              <h2>Product Development & Inventory</h2>
              <p>วิเคราะห์ความนิยมสินค้าตามภูมิภาค เพื่อการวางแผนกำลังการผลิตและพัฒนารสชาติใหม่</p>
            </div>

            <div className="row g-4 mb-4">
              <div className="col-12 col-lg-4">
                <div className="kpi-card" style={{ '--accent-color': 'var(--accent3)' }}>
                  <div className="kpi-label">Stock-out Rate (อัตราขาดสต็อก)</div>
                  <div className="kpi-value">{kpis.stockOutRate}%</div>
                  <div className="kpi-sub">ลดลง 20% จาก 5.5% (Target Achieved)</div>
                  <div className="kpi-icon">📉</div>
                </div>
              </div>
              <div className="col-12 col-lg-4">
                <div className="kpi-card" style={{ '--accent-color': 'var(--accent)' }}>
                  <div className="kpi-label">Forecast Accuracy (ความแม่นยำคาดการณ์)</div>
                  <div className="kpi-value">{kpis.forecastAccuracy}%</div>
                  <div className="kpi-sub">เป้าหมาย ≥85% (Target Achieved)</div>
                  <div className="kpi-icon">🎯</div>
                </div>
              </div>
              <div className="col-12 col-lg-4">
                <div className="kpi-card" style={{ '--accent-color': 'var(--hero)' }}>
                  <div className="kpi-label">Data Quality Score (ความถูกต้องข้อมูล)</div>
                  <div className="kpi-value">{kpis.dataQualityScore}%</div>
                  <div className="kpi-sub">เป้าหมาย ≥98% (Target Achieved)</div>
                  <div className="kpi-icon">✨</div>
                </div>
              </div>
            </div>

            <div className="row g-4 mb-4">
              <div className="col-12">
                <div className="dashboard-card">
                  <div className="card-header-clean">
                    <h4 className="card-title-clean">🔥 Region × Category Revenue Heatmap</h4>
                    <span className="card-sub-clean">สเปกตรัมยอดขายแยกตามภาคและหมวดหมู่สินค้า</span>
                  </div>

                  {/* Heatmap Grid */}
                  <div className="table-responsive mt-3">
                    <div style={{ minWidth: '600px' }}>
                      <div className="row g-2 mb-2 text-center" style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '12px' }}>
                        <div className="col-3 text-start">ภูมิภาค \ กลุ่มสินค้า</div>
                        {hmCats.map(c => <div className="col" key={c}>{c}</div>)}
                      </div>
                      {hmRegions.map(r => (
                        <div className="row g-2 mb-2 align-items-center" key={r}>
                          <div className="col-3 hm-row-label">{r}</div>
                          {hmCats.map(c => {
                            const val = (heatmap[r] && heatmap[r][c]) || 0;
                            const styles = getHeatmapColorStyles(val);
                            return (
                              <div className="col" key={c}>
                                <div className="heatmap-cell" style={styles}>
                                  {fmt(val)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-4 mb-4">
              <div className="col-12 col-lg-6">
                <div className="dashboard-card">
                  <div className="card-header-clean">
                    <h4 className="card-title-clean">🏭 Regional Production Targets</h4>
                    <span className="card-sub-clean">สินค้าที่ควรผลิตเพิ่มเติมเพื่อป้องกันการขาดสต็อก</span>
                  </div>
                  <div className="p-2">
                    <div className="row row-cols-1 row-cols-md-2 g-3">
                      {productionRecommendations.map((d, index) => (
                        <div className="col" key={d.region}>
                          <div
                            className="opp-card h-100"
                            style={{
                              borderColor: COLORS[index % COLORS.length]
                            }}
                          >
                            <div className="opp-region" style={{ color: COLORS[index % COLORS.length] }}>{d.region}</div>
                            <div className="opp-product">{d.product}</div>
                            <div className="opp-insight">{d.insight}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-6">
                <div className="dashboard-card">
                  <div className="card-header-clean">
                    <h4 className="card-title-clean">📊 Product Category Distribution by Region</h4>
                    <span className="card-sub-clean">สัดส่วนหมวดหมู่สินค้าจำแนกตามภาค</span>
                  </div>
                  <div className="chart-container" style={{ height: '320px' }}>
                    <Bar
                      data={regionStackBarData}
                      options={{
                        ...chartDefaults,
                        scales: {
                          x: { stacked: true, grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
                          y: {
                            stacked: true,
                            grid: { color: 'rgba(255, 255, 255, 0.08)', drawBorder: false },
                            ticks: { color: '#94a3b8', font: { size: 11 }, callback: v => '฿' + (v / 1000) + 'K' }
                          }
                        },
                        plugins: {
                          ...chartDefaults.plugins,
                          legend: {
                            display: true,
                            position: 'bottom',
                            labels: { color: '#94a3b8', font: { size: 12, family: "'Prompt', sans-serif" }, boxWidth: 14, padding: 15 }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="card-header-clean">
                <h4 className="card-title-clean">💡 New Product Opportunities & Recommendations</h4>
                <span className="card-sub-clean">ข้อเสนอแนะสำหรับการพัฒนารสชาติและขนาดบรรจุภัณฑ์ใหม่เพื่อรองรับความต้องการ</span>
              </div>
              <div className="new-product-list">
                {newProducts.map((p, i) => (
                  <div className="new-product-item" key={i}>
                    <div className="dot"></div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px', marginBottom: '4px' }}>{p.name}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 300 }}>
                        เป้าหมาย: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.target}</span> — {p.reason}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== PAGE 5: SYNC LOGS & DATA DIFF ==================== */}
        {activeTab === 'sync' && (
          <div>
            <div className="page-header-custom">
              <h2>Database Ingestion & Sync Status</h2>
              <p>ติดตามสถานะการนำเข้าข้อมูลอัปเดตและรายการซิงค์ระหว่างระบบ ERP และแดชบอร์ดแบบ Real-time</p>
            </div>

            <div className="row g-4 mb-4">
              {/* Sync History Log - Full Width */}
              <div className="col-12">
                <div className="dashboard-card">
                  <div className="card-header-clean">
                    <h4 className="card-title-clean">📜 ประวัติการซิงค์ข้อมูลย้อนหลัง (Latest Ingestion Executions)</h4>
                    <span className="card-sub-clean">5 รอบล่าสุด</span>
                  </div>
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>วันเวลาซิงค์</th>
                          <th className="text-center">ข้อมูลใหม่</th>
                          <th className="text-center">ข้อมูลแก้ไข</th>
                          <th className="text-center">จำนวนแถวสะสม</th>
                          <th>รายละเอียดข้อผิดพลาด (Error Details)</th>
                          <th className="text-center">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {syncLogs.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="text-center text-muted py-4">ไม่พบประวัติการซิงค์ข้อมูล</td>
                          </tr>
                        ) : (
                          syncLogs.map((log, i) => {
                            const dateStr = log.SyncDate;
                            let formattedDate = dateStr;
                            try {
                              const d = new Date(dateStr);
                              formattedDate = d.toLocaleString('th-TH', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              }) + ' น.';
                            } catch (e) { }

                            return (
                              <tr key={log.SyncID || i}>
                                <td style={{ fontWeight: 500 }}>{formattedDate}</td>
                                <td className="text-center">
                                  {log.NewRecords > 0 ? (
                                    <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded" style={{ fontSize: '12px' }}>
                                      +{log.NewRecords}
                                    </span>
                                  ) : '0'}
                                </td>
                                <td className="text-center">
                                  {log.ModifiedRecords > 0 ? (
                                    <span className="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1 rounded" style={{ fontSize: '12px', color: '#d97706' }}>
                                      ~{log.ModifiedRecords}
                                    </span>
                                  ) : '0'}
                                </td>
                                <td className="text-center font-semibold">{log.TotalRecords?.toLocaleString()}</td>
                                <td>
                                  {log.errorDetails ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                      <span style={{
                                        fontSize: '12px',
                                        color: '#ef4444',
                                        background: 'rgba(239, 68, 68, 0.06)',
                                        padding: '3px 8px',
                                        borderRadius: '4px',
                                        border: '1px solid rgba(239, 68, 68, 0.18)',
                                        maxWidth: '280px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        display: 'inline-block'
                                      }} title={log.errorDetails}>
                                        ⚠️ {log.errorDetails}
                                      </span>
                                      <button
                                        id={`err-detail-btn-${log.SyncID}`}
                                        onClick={() => setSelectedErrorLog(log)}
                                        style={{
                                          background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.08) 100%)',
                                          border: '1px solid rgba(239,68,68,0.35)',
                                          color: '#ef4444',
                                          borderRadius: '6px',
                                          padding: '3px 10px',
                                          fontSize: '11.5px',
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                          whiteSpace: 'nowrap',
                                          transition: 'all 0.18s ease',
                                          fontFamily: "'Prompt', sans-serif"
                                        }}
                                        onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.25)'; e.currentTarget.style.borderColor = '#ef4444'; }}
                                        onMouseOut={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.08) 100%)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.35)'; }}
                                      >
                                        🔍 ดูรายละเอียด
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{
                                      fontSize: '12px',
                                      color: '#10b981',
                                      background: 'rgba(16, 185, 129, 0.05)',
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      border: '1px solid rgba(16, 185, 129, 0.15)',
                                      display: 'inline-block'
                                    }}>
                                      ✔️ ไม่มีข้อผิดพลาด
                                    </span>
                                  )}
                                </td>
                                <td className="text-center">
                                  <span className="badge-custom border-success text-success px-2 py-1" style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: '#10b981' }}>
                                    สำเร็จ
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-4 mb-4">
              {/* ETL Summary Card */}
              <div className="col-12 col-lg-7">
                <div className="dashboard-card h-100" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div className="card-header-clean">
                      <h4 className="card-title-clean">⚙️ สรุประบบท่อข้อมูล (ETL & Pipeline Info)</h4>
                    </div>
                    <div className="p-3">
                      <div className="d-flex align-items-start gap-3 mb-3">
                        <div className="fs-3">🔄</div>
                        <div>
                          <h6 className="mb-1 font-bold text-light">ระบบซิงค์ข้อมูลอัตโนมัติ (n8n Schedule)</h6>
                          <p className="small text-muted mb-0">
                            Workflow ใน n8n จะทำงานอัตโนมัติในเวลา <b>05:00 น. ของทุกวัน</b> เพื่อกวาดข้อมูลจากตาราง <code>pumpui_erp</code> มาประมวลผล, กรองค่าติดลบ/ค่าว่าง และนำมาจัดเก็บที่ตารางแสดงผล <code>pumpui_show</code>
                          </p>
                        </div>
                      </div>

                      <div className="d-flex align-items-start gap-3">
                        <div className="fs-3">📊</div>
                        <div>
                          <h6 className="mb-1 font-bold text-light">การคำนวณการเปลี่ยนแปลง (Change Data Detection)</h6>
                          <p className="small text-muted mb-0">
                            <b>ข้อมูลใหม่ (New):</b> นับจากรหัสรายการสั่งซื้อ (OrderID) ที่มีเพิ่มขึ้นในระบบ ERP แต่ยังไม่มีบนแดชบอร์ด<br />
                            <b>ข้อมูลแก้ไข (Modified):</b> ตรวจสอบจาก OrderID เดียวกันที่มีการแก้ไขค่าเงิน (NetAmount), จำนวน (Quantity) หรือราคาสินค้า (Price)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Manual Testing Guide */}
              <div className="col-12 col-lg-5">
                <div className="dashboard-card h-100" style={{ background: 'var(--accent-light)', border: '1px dashed var(--accent)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div className="card-header-clean">
                      <h4 className="card-title-clean" style={{ color: 'var(--accent-hover)' }}>🧪 วิธีทดสอบการซิงค์ข้อมูล (Manual Testing)</h4>
                    </div>
                    <div className="p-3">
                      <ol className="small text-secondary ps-3 mb-0" style={{ lineHeight: '1.7' }}>
                        <li className="mb-2">เปิดโปรแกรม <b>n8n</b> และไปที่ Workflow <code>Pumpui Dashboard</code></li>
                        <li className="mb-2">คลิกเลือก Node <b>MSSQL Sync Execution</b></li>
                        <li className="mb-2">กดปุ่ม <b>Execute step</b> ด้านบนขวาเพื่อรันมือ</li>
                        <li>เมื่อรันเสร็จ ข้อมูลรอนำเข้าที่บอร์ดนี้จะเคลียร์เป็นศูนย์ทันที และแสดงในตารางฝั่งซ้าย</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Data comparison section */}
            <div className="dashboard-card mb-5">
              <div className="card-header-clean">
                <h4 className="card-title-clean">🔍 รายการข้อมูลรอนำเข้าในรอบถัดไป (Pending Live Sync Differences)</h4>
                <span className="small text-muted">เปรียบเทียบข้อมูล ณ ปัจจุบันของ pumpui_erp vs pumpui_show</span>
              </div>

              {(!syncDiff.newRecords || syncDiff.newRecords.length === 0) && (!syncDiff.modifiedRecords || syncDiff.modifiedRecords.length === 0) ? (
                <div className="alert alert-success d-flex align-items-center gap-3 p-4 border-0 rounded-3 mb-0" style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#065f46' }}>
                  <span className="fs-3">✅</span>
                  <div>
                    <h6 className="alert-heading mb-1 font-bold">ข้อมูลปัจจุบันตรงกันสมบูรณ์!</h6>
                    <p className="mb-0 small text-secondary" style={{ color: '#047857' }}>
                      ไม่พบข้อมูลใหม่หรือข้อมูลที่ถูกแก้ไขคงค้างในฐานข้อมูลต้นทาง (ERP) ทุกข้อมูลบนแดชบอร์ดเป็นไปตามระบบ ERP ล่าสุดแล้ว
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="alert alert-warning d-flex align-items-center gap-3 p-4 border-0 rounded-3 mb-4" style={{ background: 'rgba(245, 158, 11, 0.08)', color: '#92400e' }}>
                    <span className="fs-3">⚠️</span>
                    <div>
                      <h6 className="alert-heading mb-1 font-bold">ตรวจพบข้อมูลใหม่และแก้ไขที่ยังไม่ได้นำเข้า!</h6>
                      <p className="mb-0 small text-secondary" style={{ color: '#b45309' }}>
                        มีข้อมูลรอซิงค์ทั้งหมด <b>{((syncDiff.newRecords?.length || 0) + (syncDiff.modifiedRecords?.length || 0))} รายการ</b> ในระบบ ERP โปรดรัน Workflow ใน n8n เพื่อดึงข้อมูลนี้เข้าสู่หน้าแดชบอร์ด
                      </p>
                    </div>
                  </div>

                  <div className="row g-4">
                    {/* New Records Table */}
                    <div className="col-12 col-xxl-6">
                      <div className="p-3 border rounded-3 h-100" style={{ backgroundColor: 'var(--surface2)', borderColor: 'var(--border)' }}>
                        <h5 className="fs-6 font-bold text-success mb-3 d-flex align-items-center gap-2">
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                          ➕ รายการข้อมูลมาใหม่ ({syncDiff.newRecords?.length || 0} รายการ)
                        </h5>
                        <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                          <table className="table table-hover table-sm align-middle" style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                            <thead>
                              <tr style={{ color: 'var(--text-primary)' }}>
                                <th>OrderID</th>
                                <th>ชื่อลูกค้า</th>
                                <th>ชื่อสินค้า</th>
                                <th className="text-end">จำนวน</th>
                                <th className="text-end">ยอดเงิน</th>
                              </tr>
                            </thead>
                            <tbody>
                              {!syncDiff.newRecords || syncDiff.newRecords.length === 0 ? (
                                <tr>
                                  <td colSpan="5" className="text-center text-muted py-3">ไม่มีข้อมูลออเดอร์ใหม่</td>
                                </tr>
                              ) : (
                                syncDiff.newRecords.map((r, idx) => (
                                  <tr key={r.OrderID || idx}>
                                    <td className="font-semibold text-light">{r.OrderID}</td>
                                    <td className="text-truncate" style={{ maxWidth: '130px' }}>
                                      <span title={r.CustomerName} style={{ cursor: 'help' }}>
                                        {maskCustomerName(r.CustomerName)}
                                      </span>
                                    </td>
                                    <td className="text-truncate" style={{ maxWidth: '140px' }}>{r.ProductName?.replace('น้ำเปล่าลอย', '')}</td>
                                    <td className="text-end font-semibold">{r.Quantity}</td>
                                    <td className="text-end text-success font-semibold">฿{r.NetAmount?.toLocaleString()}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Modified Records Table */}
                    <div className="col-12 col-xxl-6">
                      <div className="p-3 border rounded-3 h-100" style={{ backgroundColor: 'var(--surface2)', borderColor: 'var(--border)' }}>
                        <h5 className="fs-6 font-bold text-warning mb-3 d-flex align-items-center gap-2" style={{ color: '#f59e0b' }}>
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></span>
                          ✏️ รายการข้อมูลที่มีการแก้ไข ({syncDiff.modifiedRecords?.length || 0} รายการ)
                        </h5>
                        <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                          <table className="table table-hover table-sm align-middle" style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                            <thead>
                              <tr style={{ color: 'var(--text-primary)' }}>
                                <th>OrderID</th>
                                <th>ชื่อลูกค้า</th>
                                <th>ชื่อสินค้า</th>
                                <th className="text-center">จำนวน (เดิม ➔ ใหม่)</th>
                                <th className="text-end">ยอดเงิน (เดิม ➔ ใหม่)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {!syncDiff.modifiedRecords || syncDiff.modifiedRecords.length === 0 ? (
                                <tr>
                                  <td colSpan="5" className="text-center text-muted py-3">ไม่มีข้อมูลออเดอร์ถูกแก้ไข</td>
                                </tr>
                              ) : (
                                syncDiff.modifiedRecords.map((r, idx) => {
                                  const qtyChanged = r.ShowQuantity !== r.ErpQuantity;
                                  const amtChanged = r.ShowNetAmount !== r.ErpNetAmount;

                                  return (
                                    <tr key={r.OrderID || idx}>
                                      <td className="font-semibold text-light">{r.OrderID}</td>
                                      <td className="text-truncate" style={{ maxWidth: '120px' }}>
                                        <span title={r.CustomerName} style={{ cursor: 'help' }}>
                                          {maskCustomerName(r.CustomerName)}
                                        </span>
                                      </td>
                                      <td className="text-truncate" style={{ maxWidth: '110px' }}>{r.ProductName?.replace('น้ำเปล่าลอย', '')}</td>
                                      <td className="text-center">
                                        <span className={qtyChanged ? 'text-decoration-line-through text-muted' : ''}>{r.ShowQuantity}</span>
                                        {qtyChanged && <span className="text-warning font-semibold"> ➔ {r.ErpQuantity}</span>}
                                      </td>
                                      <td className="text-end">
                                        <span className={amtChanged ? 'text-decoration-line-through text-muted' : ''}>฿{r.ShowNetAmount?.toLocaleString()}</span>
                                        {amtChanged && <span className="text-warning font-semibold"> ➔ ฿{r.ErpNetAmount?.toLocaleString()}</span>}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      <footer>
        Loymalila Analytics Dashboard · Star Schema Data Mart · FactSales 1,500 Records · 77 Provinces · Jan–Dec 2025
      </footer>
    </div>
  );
}

export default App;
