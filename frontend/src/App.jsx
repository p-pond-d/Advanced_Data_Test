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

// Crimson/Rose/Burgundy Red Theme Palette
const COLORS = ['#e11d48', '#be123c', '#fb7185', '#fda4af', '#f43f5e', '#9f1239'];

const fmt = v => '฿' + (v / 1000).toFixed(0) + 'K';
const fmtFull = v => '฿' + v.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Global Chart Options Defaults
ChartJS.defaults.font.family = "'Prompt', 'Inter', sans-serif";

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      titleColor: '#0f172a',
      bodyColor: '#64748b',
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
    ticks: { color: '#64748b', font: { size: 11 } } 
  },
  y: { 
    border: { dash: [4, 4], color: 'rgba(226, 232, 240, 0.8)' }, 
    grid: { color: 'rgba(226, 232, 240, 0.8)', drawBorder: false }, 
    ticks: { color: '#64748b', font: { size: 11 } } 
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
  { SyncID: 1, SyncDate: '2026-06-25T11:57:52.167Z', NewRecords: 12, ModifiedRecords: 5, TotalRecords: 1500 },
  { SyncID: 2, SyncDate: '2026-06-24T05:00:10.000Z', NewRecords: 8, ModifiedRecords: 3, TotalRecords: 1488 },
  { SyncID: 3, SyncDate: '2026-06-23T05:00:15.000Z', NewRecords: 15, ModifiedRecords: 2, TotalRecords: 1480 },
  { SyncID: 4, SyncDate: '2026-06-22T05:00:08.000Z', NewRecords: 0, ModifiedRecords: 0, TotalRecords: 1465 },
  { SyncID: 5, SyncDate: '2026-06-21T05:00:12.000Z', NewRecords: 22, ModifiedRecords: 8, TotalRecords: 1465 }
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

// High-fidelity Stylized Bezier Map of Thailand Regions
// Geographically Detailed Thailand Map with Interactive 6 Regions
function ThailandMap({ activeRegion, onRegionSelect, regionSales }) {
  const [paths, setPaths] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredRegion, setHoveredRegion] = useState(null);

  const maxSales = Math.max(...Object.values(regionSales)) || 1;

  // 6 regions mapping
  const regionsMap = {
    "ภาคเหนือ": ["cmi", "cri", "lpg", "lpn", "mhs", "nan", "pyo", "pre", "utd"],
    "ภาคตะวันออกเฉียงเหนือ": ["acr", "bkn", "brm", "cpm", "ksn", "kkn", "lei", "msk", "mdh", "npm", "nma", "nbl", "nki", "ret", "snk", "ssk", "srn", "ubn", "udn", "yst"],
    "ภาคกลาง": ["atg", "bkk", "cnt", "kpt", "lri", "nyk", "npt", "nsw", "nbi", "pte", "pnb", "aya", "pct", "plk", "spk", "skn", "skm", "sri", "sbr", "sth", "uti", "spb"],
    "ภาคตะวันออก": ["cco", "cti", "cbi", "pri", "ryg", "skw", "trt"],
    "ภาคตะวันตก": ["kcn", "pbi", "pkk", "rbr", "tak"],
    "ภาคใต้": ["cpn", "kbi", "nst", "nwt", "ptn", "pna", "plg", "pkt", "rng", "stn", "ska", "sni", "trg", "yla"]
  };

  // Base colors matching the reference map
  const REGION_COLORS = {
    "ภาคเหนือ": "#b6d47d",         // Olive green
    "ภาคตะวันออกเฉียงเหนือ": "#eeab7c", // Peach/orange
    "ภาคกลาง": "#df7373",         // Red/rose
    "ภาคตะวันตก": "#a293c2",       // Lavender purple
    "ภาคตะวันออก": "#97c5e2",       // Sky blue
    "ภาคใต้": "#6497c2"            // Blue
  };

  const labelCoords = {
    "ภาคเหนือ": { x: 180, y: 220, name: "เหนือ" },
    "ภาคตะวันออกเฉียงเหนือ": { x: 380, y: 320, name: "ตะวันออกเฉียงเหนือ" },
    "ภาคกลาง": { x: 225, y: 480, name: "กลาง" },
    "ภาคตะวันตก": { x: 125, y: 400, name: "ตะวันตก" },
    "ภาคตะวันออก": { x: 295, y: 560, name: "ตะวันออก" },
    "ภาคใต้": { x: 180, y: 800, name: "ใต้" }
  };

  useEffect(() => {
    // Try to load cached paths first
    const cached = localStorage.getItem('thailand_detailed_svg_paths_v2');
    if (cached) {
      try {
        setPaths(JSON.parse(cached));
        setLoading(false);
        return;
      } catch (e) {
        console.error("Cached paths parse error:", e);
      }
    }

    // Try local public folder first
    fetch('/thailand_regions.json')
      .then(res => {
        if (!res.ok) throw new Error('Not found locally');
        return res.json();
      })
      .then(data => {
        const flatPaths = [];
        Object.entries(data).forEach(([region, provs]) => {
          provs.forEach(p => {
            flatPaths.push(p);
          });
        });
        if (flatPaths.length > 0 && flatPaths[0].d && flatPaths[0].d.length > 10) {
          setPaths(flatPaths);
          localStorage.setItem('thailand_detailed_svg_paths_v2', JSON.stringify(flatPaths));
          setLoading(false);
        } else {
          throw new Error('Local JSON path data is invalid or empty');
        }
      })
      .catch(() => {
        // Fetch from GitHub raw as robust fallback
        fetch('https://raw.githubusercontent.com/VictorCazanave/svg-maps/master/packages/thailand/thailand.svg')
          .then(res => {
            if (!res.ok) throw new Error('GitHub fetch failed');
            return res.text();
          })
          .then(svgText => {
            const pathRegex = /<path\s+([^>]+)>/g;
            let match;
            const extracted = [];
            while ((match = pathRegex.exec(svgText)) !== null) {
              const tagContent = match[1];
              const idMatch = /id="([^"]+)"/.exec(tagContent);
              const labelMatch = /aria-label="([^"]+)"/.exec(tagContent);
              const dMatch = /\bd="([^"]+)"/s.exec(tagContent); // use \b to avoid matching the 'd' in id="..."
              if (idMatch && labelMatch && dMatch) {
                extracted.push({
                  id: idMatch[1],
                  label: labelMatch[1],
                  d: dMatch[1].replace(/\s+/g, ' ').trim()
                });
              }
            }
            if (extracted.length > 0) {
              setPaths(extracted);
              localStorage.setItem('thailand_detailed_svg_paths_v2', JSON.stringify(extracted));
            }
            setLoading(false);
          })
          .catch(err => {
            console.error("Detailed SVG load failed, using fallback:", err);
            setLoading(false);
          });
      });
  }, []);

  const getRegionOfProvince = (provId) => {
    for (const [region, ids] of Object.entries(regionsMap)) {
      if (ids.includes(provId)) return region;
    }
    return null;
  };

  const getFillColor = (regionName) => {
    const baseColor = REGION_COLORS[regionName] || '#cbd5e1';
    const sales = regionSales[regionName] || 0;
    const ratio = sales / maxSales;

    const isActive = activeRegion === regionName;
    const isHovered = hoveredRegion === regionName;

    if (isActive) {
      return baseColor; // Active region: full reference color vibrancy
    }

    if (isHovered) {
      // Glow/blend on hover
      return baseColor; 
    }

    // Choropleth shading: blend color based on sales ratio (opacity from 0.45 to 1.0)
    const opacity = 0.45 + ratio * 0.55;
    const r = parseInt(baseColor.substring(1, 3), 16);
    const g = parseInt(baseColor.substring(3, 5), 16);
    const b = parseInt(baseColor.substring(5, 7), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Fallback simplified geometry if raw SVG is loading or fails
  const fallbackRegions = [
    { name: 'ภาคเหนือ', d: "M85,50 C100,25 145,25 158,50 C170,72 165,115 145,155 C128,172 98,172 90,140 C80,118 78,75 85,50 Z", labelX: 122, labelY: 98, text: "เหนือ" },
    { name: 'ภาคตะวันออกเฉียงเหนือ', d: "M158,50 C182,50 225,65 245,108 C255,138 245,195 200,222 C178,230 162,198 152,175 C146,145 152,105 158,50 Z", labelX: 198, labelY: 145, text: "อีสาน" },
    { name: 'ภาคกลาง', d: "M120,170 C135,170 148,172 154,198 C158,228 145,248 130,248 C118,248 114,222 110,198 C110,178 114,170 120,170 Z", labelX: 132, labelY: 213, text: "กลาง" },
    { name: 'ภาคตะวันตก', d: "M90,140 C100,165 110,198 110,238 C105,252 90,258 80,252 C70,245 72,210 75,172 C80,142 85,132 90,140 Z", labelX: 88, labelY: 195, text: "ตก" },
    { name: 'ภาคตะวันออก', d: "M154,198 C170,198 190,208 198,228 C202,248 190,270 175,270 C165,270 160,248 154,228 Z", labelX: 176, labelY: 238, text: "ออก" },
    { name: 'ภาคใต้', d: "M116,248 C124,248 123,268 120,295 C116,325 122,365 128,405 C132,435 138,475 124,475 C114,475 108,425 105,385 C102,345 106,295 106,268 C106,253 110,248 116,248 Z", labelX: 116, labelY: 360, text: "ใต้" }
  ];

  return (
    <div className="map-container">
      <div className="card-header-clean">
        <h4 className="card-title-clean">🗺️ Thailand Regional Coverage</h4>
        {loading ? (
          <span className="small text-danger animate-pulse">กำลังโหลดแผนที่...</span>
        ) : (
          <span className="small text-muted">คลิกเลือกภาคบนแผนที่</span>
        )}
      </div>

      <div className="map-svg-wrap position-relative">
        {paths ? (
          // Detailed High-Fidelity SVG Map
          <svg viewBox="0 0 560 1025" style={{ width: '85%', height: 'auto', maxHeight: '420px', transition: 'all 0.3s' }}>
            <g id="detailed-map">
              {paths.map(p => {
                const reg = getRegionOfProvince(p.id);
                const isSelected = activeRegion === reg;
                const isHovered = hoveredRegion === reg;
                const fill = getFillColor(reg);

                return (
                  <path
                    key={p.id}
                    d={p.d}
                    fill={fill}
                    stroke={isSelected || isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.4)'}
                    strokeWidth={isSelected ? '2' : isHovered ? '1.5' : '0.5'}
                    cursor="pointer"
                    onClick={() => reg && onRegionSelect(reg)}
                    onMouseEnter={() => reg && setHoveredRegion(reg)}
                    onMouseLeave={() => setHoveredRegion(null)}
                    style={{
                      transition: 'fill 0.25s ease, stroke 0.25s ease, filter 0.25s ease',
                      filter: isSelected ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' : isHovered ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' : 'none'
                    }}
                  >
                    <title>{p.label} ({reg})</title>
                  </path>
                );
              })}
            </g>

            {/* Premium Labels with White Outline Glow */}
            {Object.entries(labelCoords).map(([regionName, { x, y, name }]) => {
              const isSelected = activeRegion === regionName;
              return (
                <text
                  key={regionName}
                  x={x}
                  y={y}
                  fill={isSelected ? '#9f1239' : '#0f172a'}
                  fontSize={isSelected ? '15' : '12'}
                  fontWeight="800"
                  cursor="pointer"
                  onClick={() => onRegionSelect(regionName)}
                  onMouseEnter={() => setHoveredRegion(regionName)}
                  onMouseLeave={() => setHoveredRegion(null)}
                  paintOrder="stroke"
                  stroke="#ffffff"
                  strokeWidth={isSelected ? '5' : '4'}
                  textAnchor="middle"
                  style={{
                    transition: 'all 0.2s ease',
                    userSelect: 'none'
                  }}
                >
                  {name}
                </text>
              );
            })}
          </svg>
        ) : (
          // Fallback Simplified SVG Map
          <svg viewBox="0 0 300 500" style={{ width: '85%', height: 'auto', maxHeight: '385px' }}>
            {fallbackRegions.map(r => {
              const isSelected = activeRegion === r.name;
              const isHovered = hoveredRegion === r.name;
              const fill = getFillColor(r.name);

              return (
                <g key={r.name}>
                  <path
                    d={r.d}
                    fill={fill}
                    stroke="#ffffff"
                    strokeWidth={isSelected ? '3' : '1.5'}
                    cursor="pointer"
                    onClick={() => onRegionSelect(r.name)}
                    onMouseEnter={() => setHoveredRegion(r.name)}
                    onMouseLeave={() => setHoveredRegion(null)}
                    style={{
                      transition: 'all 0.25s ease',
                      filter: isSelected ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' : 'none'
                    }}
                  />
                  <text
                    x={r.labelX}
                    y={r.labelY}
                    fill={isSelected ? '#fff' : '#0f172a'}
                    fontSize="11"
                    fontWeight="700"
                    cursor="pointer"
                    pointerEvents="none"
                    textAnchor="middle"
                  >
                    {r.text}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <div className="mt-2 d-flex justify-content-center flex-wrap gap-2 px-2" style={{ fontSize: '12px', fontWeight: 'bold' }}>
        {Object.entries(REGION_COLORS).map(([rName, color]) => (
          <span 
            className="d-flex align-items-center gap-1 cursor-pointer px-2 py-1 rounded transition"
            key={rName}
            onClick={() => onRegionSelect(rName)}
            style={{
              background: activeRegion === rName ? 'rgba(225,29,72,0.08)' : 'transparent',
              border: activeRegion === rName ? '1.5px solid var(--accent)' : '1.5px solid transparent',
              fontWeight: activeRegion === rName ? '800' : '600',
              color: activeRegion === rName ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
          >
            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: color, border: '1px solid rgba(0,0,0,0.15)' }}></span> 
            {rName.replace('ภาค', '')}
          </span>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('regional');
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
      borderColor: '#e11d48',
      backgroundColor: (context) => {
        const chart = context.chart;
        const { ctx, chartArea } = chart;
        if (!chartArea) return null;
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, 'rgba(225, 29, 72, 0.15)');
        gradient.addColorStop(1, 'rgba(225, 29, 72, 0.0)');
        return gradient;
      },
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#e11d48',
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
      backgroundColor: COLORS,
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
        if (!chartArea) return '#e11d48';
        const gradients = COLORS.map((color) => {
          const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, color);
          g.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
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
      backgroundColor: ['#e11d48', '#fb7185'],
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
        if (!chartArea) return '#e11d48';
        const g1 = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom); 
        g1.addColorStop(0, '#e11d48'); g1.addColorStop(1, '#9f1239');
        const g2 = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom); 
        g2.addColorStop(0, '#fb7185'); g2.addColorStop(1, '#f43f5e');
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
        if (!chartArea) return '#e11d48';
        return COLORS.map(c => {
          const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, c); g.addColorStop(1, 'rgba(255,255,255,0.15)');
          return g;
        })[context.dataIndex % COLORS.length];
      },
      borderRadius: 8,
      borderSkipped: false,
      barPercentage: 0.55
    }]
  };

  const topProductBarData = {
    labels: topProducts.map(p => p.n.replace('น้ำเปล่าลอย', '')),
    datasets: [{
      data: topProducts.map(p => p.v),
      backgroundColor: (context) => {
        const chart = context.chart;
        const { ctx, chartArea } = chart;
        if (!chartArea) return '#e11d48';
        return topProducts.map((p, i) => {
          const baseColor = i === 0 ? '#9f1239' : COLORS[i % COLORS.length];
          const g = ctx.createLinearGradient(0, 0, chartArea.right, 0);
          g.addColorStop(0, baseColor); g.addColorStop(1, 'rgba(255,255,255,0.05)');
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
    // Red gradients: Light rose pink -> Coral -> Crimson red -> Deep Burgundy
    const colors = [[255, 241, 242], [254, 205, 211], [225, 29, 72], [159, 18, 57]];
    const idx = Math.min(Math.floor(t * (colors.length - 1)), colors.length - 2);
    const frac = t * (colors.length - 1) - idx;
    const [r1, g1, b1] = colors[idx];
    const [r2, g2, b2] = colors[idx + 1];
    
    const bgColor = `rgb(${Math.round(r1 + (r2 - r1) * frac)},${Math.round(g1 + (g2 - g1) * frac)},${Math.round(b1 + (b2 - b1) * frac)})`;
    const textColor = t > 0.45 ? '#ffffff' : '#0f172a';
    return { backgroundColor: bgColor, color: textColor };
  };

  const regionStackBarData = {
    labels: hmRegions.map(r => r.replace('ภาค', '')),
    datasets: hmCats.map((c, i) => ({
      label: c,
      data: hmRegions.map(r => (heatmap[r] && heatmap[r][c]) || 0),
      backgroundColor: COLORS[i % COLORS.length],
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
                onClick={() => setActiveTab('regional')}
              >
                📍 Regional Summary
              </button>
              <button 
                className={`nav-tab-custom ${activeTab === 'exec' ? 'active' : ''}`}
                onClick={() => setActiveTab('exec')}
              >
                📊 Executive Overview
              </button>
              <button 
                className={`nav-tab-custom tab-customer ${activeTab === 'customer' ? 'active' : ''}`}
                onClick={() => setActiveTab('customer')}
              >
                👥 Customer Analytics
              </button>
              <button 
                className={`nav-tab-custom tab-product ${activeTab === 'product' ? 'active' : ''}`}
                onClick={() => setActiveTab('product')}
              >
                🧴 Product Analytics
              </button>
              <button 
                className={`nav-tab-custom tab-dev ${activeTab === 'dev' ? 'active' : ''}`}
                onClick={() => setActiveTab('dev')}
              >
                🔬 Product Development
              </button>
              <button 
                className={`nav-tab-custom tab-sync ${activeTab === 'sync' ? 'active' : ''}`}
                onClick={() => setActiveTab('sync')}
              >
                🔄 Sync History & Preview
              </button>
            </div>
            
            <div className="d-flex align-items-center mt-2 mt-lg-0 gap-2 flex-wrap justify-content-end">
              {isLive && (syncDiff.newRecords?.length > 0 || syncDiff.modifiedRecords?.length > 0) && (
                <span 
                  className="badge-custom text-warning" 
                  style={{background: 'rgba(245, 158, 11, 0.08)', cursor: 'pointer', border: '1px solid #f59e0b', fontWeight: 'bold'}} 
                  onClick={() => setActiveTab('sync')}
                >
                  ⚠️ รอนำเข้า (+{syncDiff.newRecords?.length || 0}, ~{syncDiff.modifiedRecords?.length || 0})
                </span>
              )}
              <span className={`badge-custom ${isLive ? 'border-danger text-danger' : 'border-secondary text-secondary'}`} style={{background: 'rgba(225, 29, 72, 0.03)'}}>
                {isLive ? '● Live Data (pumpui_show)' : '○ Sandbox (Mock Data)'}
              </span>
              <span className="badge-custom border-danger text-danger" style={{background: 'rgba(225, 29, 72, 0.03)'}}>
                📊 {(kpis.totalRows || 1500).toLocaleString()} แถว
              </span>
              <span className="badge-custom border-danger text-danger" style={{background: 'rgba(225, 29, 72, 0.03)'}}>
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
              <div className="dashboard-card" style={{ padding: '24px 28px' }}>
                <ThailandMap 
                  activeRegion={selectedRegion} 
                  onRegionSelect={setSelectedRegion} 
                  regionSales={regionSales} 
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
                          <div className="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom" style={{ borderColor: '#e2e8f0', fontSize: '12.5px' }} key={p.name}>
                            <span className="text-secondary text-truncate" style={{ maxWidth: '170px' }}>{idx+1}. {p.name.replace('น้ำเปล่าลอย', '')}</span>
                            <span className="font-semibold text-danger" style={{ color: 'var(--accent)' }}>{fmtFull(p.sales)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded" style={{ background: 'rgba(225, 29, 72, 0.025)', border: '1px dashed rgba(225, 29, 72, 0.2)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent2)' }} className="mb-2">📋 คำแนะนำการจัดการ & พัฒนาผลิตภัณฑ์ใน {selectedRegion}</div>
                  <div className="small text-secondary mb-1">• <b>เพิ่มกำลังผลิต:</b> <span className="text-dark font-medium">{currentRegDetail.productionRecommendation}</span></div>
                  <div className="small text-secondary">• <b>โอกาสสินค้าใหม่:</b> <span className="text-dark font-medium">{currentRegDetail.newProductOpportunity}</span></div>
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
                    <Line data={monthlyChartData} options={{...chartDefaults, scales: lightScales}} />
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
                      <Doughnut data={regionDonutData} options={{...chartDefaults, cutout: '75%'}} />
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
                    <Bar data={catBarData} options={{...chartDefaults, scales: lightScales}} />
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
                      <Doughnut data={custTypeDonutData} options={{...chartDefaults, cutout: '75%'}} />
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
                    <Bar data={custTypeBarData} options={{...chartDefaults, scales: lightScales}} />
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
                    <Bar data={regionBarData} options={{...chartDefaults, scales: lightScales}} />
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
                            grid: { color: 'rgba(226, 232, 240, 0.8)', drawBorder: false },
                            ticks: { color: '#64748b', font: { size: 11 }, callback: v => '฿' + (v / 1000) + 'K' }
                          },
                          y: { 
                            grid: { display: false }, 
                            ticks: { color: 'var(--text)', font: { size: 12 } } 
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
                          backgroundColor: COLORS,
                          borderWidth: 0,
                          hoverOffset: 10
                        }]
                      }} options={{...chartDefaults, cutout: '75%'}} />
                    </div>
                  </div>
                  <div className="donut-legend">
                    {catKeys.map((k, i) => (
                      <div className="legend-row" key={k}>
                        <div className="legend-dot" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
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
                      const barColor = isHero ? 'var(--accent)' : COLORS[i % COLORS.length];
                      const maxP = topProducts[0].v;
                      return (
                        <div className="progress-row" key={p.n}>
                          <div className="progress-label" style={{ color: isHero ? 'var(--accent)' : 'var(--text-primary)', fontWeight: isHero ? 700 : 400 }}>
                            {isHero ? '⭐ ' : ''} {p.n.replace('น้ำเปล่าลอย', '')}
                          </div>
                          <div className="progress-bar-wrap">
                            <div 
                              className="progress-bar-custom" 
                              style={{ 
                                width: `${(p.v / maxP * 100).toFixed(0)}%`,
                                background: `linear-gradient(90deg, ${barColor}, #fff)`,
                                boxShadow: isHero ? '0 2px 6px rgba(225,29,72,0.15)' : `0 1px 3px rgba(0,0,0,0.01)`
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

            <div className="insight-box" style={{ borderColor: 'rgba(225,29,72,0.2)', background: 'linear-gradient(145deg, rgba(225,29,72,0.01), rgba(225,29,72,0.03))' }}>
              <h4 style={{ color: 'var(--accent2)' }}>⭐ Hero Product Insight</h4>
              <div className="insight-item">• <span style={{ background: 'rgba(225,29,72,0.05)', color: 'var(--accent2)', borderColor: 'rgba(225,29,72,0.15)' }}>น้ำเปล่าลอยมะลิ</span> คือสินค้าหลัก มียอดขายสูงสุดถึง ฿788,481 คิดเป็น <span style={{ background: 'rgba(225,29,72,0.05)', color: 'var(--accent2)', borderColor: 'rgba(225,29,72,0.15)' }}>27.8%</span> ของบริษัท</div>
              <div className="insight-item">• สินค้าขายดีอันดับ 2 (ลอยมะนาว-สะระแหน่) มียอดขาย ฿393,552 แสดงให้เห็นว่า Hero Product มียอดขายสูงกว่าถึง <span style={{ background: 'rgba(225,29,72,0.05)', color: 'var(--accent2)', borderColor: 'rgba(225,29,72,0.15)' }}>2 เท่า (2x)</span></div>
              <div className="insight-item">• ยอดขายกลุ่มดอกไม้ไทยรวมคิดเป็น <span>41.2%</span> ถือเป็นเสาหลักที่ช่วยขับเคลื่อนรายได้ทั้งหมดของโรงงานลอยมะลิลา</div>
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
                          x: { stacked: true, grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
                          y: { 
                            stacked: true, 
                            grid: { color: 'rgba(226, 232, 240, 0.8)', drawBorder: false }, 
                            ticks: { color: '#64748b', font: { size: 11 }, callback: v => '฿' + (v / 1000) + 'K' } 
                          }
                        },
                        plugins: {
                          ...chartDefaults.plugins,
                          legend: {
                            display: true,
                            position: 'bottom',
                            labels: { color: '#64748b', font: { size: 12, family: "'Prompt', sans-serif" }, boxWidth: 14, padding: 15 }
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
              {/* Left Column: Sync History Log */}
              <div className="col-12 col-lg-7">
                <div className="dashboard-card">
                  <div className="card-header-clean">
                    <h4 className="card-title-clean">📜 ประวัติการซิงค์ข้อมูลย้อนหลัง (Latest Ingestion Executions)</h4>
                    <span className="card-sub-clean">5 รอบล่าสุด</span>
                  </div>
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>วัน-เวลาซิงค์ (Sync Date)</th>
                          <th className="text-center">ข้อมูลใหม่ (New)</th>
                          <th className="text-center">ข้อมูลที่แก้ไข (Modified)</th>
                          <th className="text-center">แถวสะสม (Total)</th>
                          <th className="text-center">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {syncLogs.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="text-center text-muted py-4">ไม่พบประวัติการซิงค์ข้อมูล</td>
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
                            } catch (e) {}

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

              {/* Right Column: Sync Control Panel & Guide */}
              <div className="col-12 col-lg-5">
                <div className="dashboard-card d-flex flex-column justify-content-between">
                  <div>
                    <div className="card-header-clean">
                      <h4 className="card-title-clean">⚙️ สรุประบบท่อข้อมูล (ETL & Pipeline Info)</h4>
                    </div>
                    <div className="p-2">
                      <div className="d-flex align-items-start gap-3 mb-3">
                        <div className="fs-3">🔄</div>
                        <div>
                          <h6 className="mb-1 font-bold text-dark">ระบบซิงค์ข้อมูลอัตโนมัติ (n8n Schedule)</h6>
                          <p className="small text-muted mb-0">
                            Workflow ใน n8n จะทำงานอัตโนมัติในเวลา <b>05:00 น. ของทุกวัน</b> เพื่อกวาดข้อมูลจากตาราง <code>pumpui_erp</code> มาประมวลผล, กรองค่าติดลบ/ค่าว่าง และนำมาจัดเก็บที่ตารางแสดงผล <code>pumpui_show</code>
                          </p>
                        </div>
                      </div>

                      <div className="d-flex align-items-start gap-3 mb-3">
                        <div className="fs-3">📊</div>
                        <div>
                          <h6 className="mb-1 font-bold text-dark">การคำนวณการเปลี่ยนแปลง (Change Data Detection)</h6>
                          <p className="small text-muted mb-0">
                            <b>ข้อมูลใหม่ (New):</b> นับจากรหัสรายการสั่งซื้อ (OrderID) ที่มีเพิ่มขึ้นในระบบ ERP แต่ยังไม่มีบนแดชบอร์ด<br />
                            <b>ข้อมูลแก้ไข (Modified):</b> ตรวจสอบจาก OrderID เดียวกันที่มีการแก้ไขค่าเงิน (NetAmount), จำนวน (Quantity) หรือราคาสินค้า (Price)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded" style={{ background: 'rgba(225, 29, 72, 0.025)', border: '1px dashed rgba(225, 29, 72, 0.2)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent2)' }} className="mb-2">🧪 วิธีทดสอบการซิงค์ข้อมูล (Manual Testing)</div>
                    <ol className="small text-secondary ps-3 mb-0" style={{ lineHeight: '1.6' }}>
                      <li>เปิดโปรแกรม <b>n8n</b> และไปที่ Workflow <code>Pumpui Dashboard</code></li>
                      <li>คลิกเลือก Node <b>MSSQL Sync Execution</b></li>
                      <li>กดปุ่ม <b>Execute step</b> ด้านบนขวาเพื่อรันมือ</li>
                      <li>เมื่อรันเสร็จ ข้อมูลรอนำเข้าที่บอร์ดนี้จะเคลียร์เป็นศูนย์ทันที และแสดงในตารางฝั่งซ้าย</li>
                    </ol>
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
                      <div className="p-3 border rounded-3 bg-light-subtle h-100">
                        <h5 className="fs-6 font-bold text-success mb-3 d-flex align-items-center gap-2">
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                          ➕ รายการข้อมูลมาใหม่ ({syncDiff.newRecords?.length || 0} รายการ)
                        </h5>
                        <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                          <table className="table table-hover table-sm align-middle" style={{ fontSize: '12.5px' }}>
                            <thead className="table-light">
                              <tr>
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
                                    <td className="font-semibold text-dark">{r.OrderID}</td>
                                    <td className="text-truncate" style={{ maxWidth: '120px' }}>{r.CustomerName?.replace('บริษัท ', '').replace(' จำกัด', '')}</td>
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
                      <div className="p-3 border rounded-3 bg-light-subtle h-100">
                        <h5 className="fs-6 font-bold text-warning mb-3 d-flex align-items-center gap-2" style={{ color: '#d97706' }}>
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></span>
                          ✏️ รายการข้อมูลที่มีการแก้ไข ({syncDiff.modifiedRecords?.length || 0} รายการ)
                        </h5>
                        <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                          <table className="table table-hover table-sm align-middle" style={{ fontSize: '12.5px' }}>
                            <thead className="table-light">
                              <tr>
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
                                      <td className="font-semibold text-dark">{r.OrderID}</td>
                                      <td className="text-truncate" style={{ maxWidth: '110px' }}>{r.CustomerName?.replace('บริษัท ', '').replace(' จำกัด', '')}</td>
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
