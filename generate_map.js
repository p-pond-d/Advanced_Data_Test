/**
 * Thailand Province SVG Map Generator
 * สร้างไฟล์ thailand_regions.json สำหรับแสดงแผนที่ทุก 77 จังหวัด
 * 
 * วิธีใช้: node generate_map.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.join(__dirname, 'frontend', 'public', 'thailand_regions.json');

// Province name mapping: GeoJSON English name → Thai Region
const PROVINCE_REGION_MAP = {
  // ภาคเหนือ (9 จังหวัด)
  'Mae Hong Son':   'ภาคเหนือ',
  'Chiang Mai':     'ภาคเหนือ',
  'Chiang Rai':     'ภาคเหนือ',
  'Lamphun':        'ภาคเหนือ',
  'Lampang':        'ภาคเหนือ',
  'Phrae':          'ภาคเหนือ',
  'Nan':            'ภาคเหนือ',
  'Phayao':         'ภาคเหนือ',
  'Uttaradit':      'ภาคเหนือ',
  // ภาคตะวันออกเฉียงเหนือ (20 จังหวัด)
  'Loei':              'ภาคตะวันออกเฉียงเหนือ',
  'Nong Khai':         'ภาคตะวันออกเฉียงเหนือ',
  'Bueng Kan':         'ภาคตะวันออกเฉียงเหนือ',
  'Nong Bua Lam Phu':  'ภาคตะวันออกเฉียงเหนือ',
  'Udon Thani':        'ภาคตะวันออกเฉียงเหนือ',
  'Sakon Nakhon':      'ภาคตะวันออกเฉียงเหนือ',
  'Nakhon Phanom':     'ภาคตะวันออกเฉียงเหนือ',
  'Kalasin':           'ภาคตะวันออกเฉียงเหนือ',
  'Khon Kaen':         'ภาคตะวันออกเฉียงเหนือ',
  'Mukdahan':          'ภาคตะวันออกเฉียงเหนือ',
  'Maha Sarakham':     'ภาคตะวันออกเฉียงเหนือ',
  'Roi Et':            'ภาคตะวันออกเฉียงเหนือ',
  'Yasothon':          'ภาคตะวันออกเฉียงเหนือ',
  'Amnat Charoen':     'ภาคตะวันออกเฉียงเหนือ',
  'Chaiyaphum':        'ภาคตะวันออกเฉียงเหนือ',
  'Nakhon Ratchasima': 'ภาคตะวันออกเฉียงเหนือ',
  'Buriram':           'ภาคตะวันออกเฉียงเหนือ',
  'Surin':             'ภาคตะวันออกเฉียงเหนือ',
  'Si Sa Ket':         'ภาคตะวันออกเฉียงเหนือ',
  'Ubon Ratchathani':  'ภาคตะวันออกเฉียงเหนือ',
  // ภาคกลาง (21 จังหวัด)
  'Phichit':                    'ภาคกลาง',
  'Phitsanulok':                'ภาคกลาง',
  'Phetchabun':                 'ภาคกลาง',
  'Nakhon Sawan':               'ภาคกลาง',
  'Uthai Thani':                'ภาคกลาง',
  'Chai Nat':                   'ภาคกลาง',
  'Lopburi':                    'ภาคกลาง',
  'Sing Buri':                  'ภาคกลาง',
  'Ang Thong':                  'ภาคกลาง',
  'Phra Nakhon Si Ayutthaya':   'ภาคกลาง',
  'Saraburi':                   'ภาคกลาง',
  'Nakhon Nayok':               'ภาคกลาง',
  'Pathum Thani':               'ภาคกลาง',
  'Nonthaburi':                 'ภาคกลาง',
  'Bangkok':                    'ภาคกลาง',
  'Samut Prakan':               'ภาคกลาง',
  'Nakhon Pathom':              'ภาคกลาง',
  'Samut Sakhon':               'ภาคกลาง',
  'Samut Songkhram':            'ภาคกลาง',
  'Suphan Buri':                'ภาคกลาง',
  'Sukhothai':                  'ภาคกลาง',
  // ภาคตะวันตก (5 จังหวัด)
  'Tak':                   'ภาคตะวันตก',
  'Kanchanaburi':          'ภาคตะวันตก',
  'Ratchaburi':            'ภาคตะวันตก',
  'Phetchaburi':           'ภาคตะวันตก',
  'Prachuap Khiri Khan':   'ภาคตะวันตก',
  // ภาคตะวันออก (7 จังหวัด)
  'Chachoengsao':   'ภาคตะวันออก',
  'Chon Buri':      'ภาคตะวันออก',
  'Rayong':         'ภาคตะวันออก',
  'Chanthaburi':    'ภาคตะวันออก',
  'Trat':           'ภาคตะวันออก',
  'Prachin Buri':   'ภาคตะวันออก',
  'Sa Kaeo':        'ภาคตะวันออก',
  // ภาคใต้ (14 จังหวัด)
  'Chumphon':             'ภาคใต้',
  'Ranong':               'ภาคใต้',
  'Surat Thani':          'ภาคใต้',
  'Phang Nga':            'ภาคใต้',
  'Phuket':               'ภาคใต้',
  'Krabi':                'ภาคใต้',
  'Nakhon Si Thammarat':  'ภาคใต้',
  'Phatthalung':          'ภาคใต้',
  'Trang':                'ภาคใต้',
  'Satun':                'ภาคใต้',
  'Songkhla':             'ภาคใต้',
  'Pattani':              'ภาคใต้',
  'Yala':                 'ภาคใต้',
  'Narathiwat':           'ภาคใต้',
};

// Province English → Thai name
const PROVINCE_TH = {
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
  'Phetchabun': 'เพชรบูรณ์', 'Nakhon Sawan': 'นครสวรรค์', 'Uthai Thani': 'อุทัยธานี',
  'Chai Nat': 'ชัยนาท', 'Lopburi': 'ลพบุรี', 'Sing Buri': 'สิงห์บุรี',
  'Ang Thong': 'อ่างทอง', 'Phra Nakhon Si Ayutthaya': 'พระนครศรีอยุธยา',
  'Saraburi': 'สระบุรี', 'Nakhon Nayok': 'นครนายก',
  'Pathum Thani': 'ปทุมธานี', 'Nonthaburi': 'นนทบุรี', 'Bangkok': 'กรุงเทพมหานคร',
  'Samut Prakan': 'สมุทรปราการ', 'Nakhon Pathom': 'นครปฐม',
  'Samut Sakhon': 'สมุทรสาคร', 'Samut Songkhram': 'สมุทรสงคราม',
  'Suphan Buri': 'สุพรรณบุรี', 'Sukhothai': 'สุโขทัย',
  'Tak': 'ตาก', 'Kanchanaburi': 'กาญจนบุรี', 'Ratchaburi': 'ราชบุรี',
  'Phetchaburi': 'เพชรบุรี', 'Prachuap Khiri Khan': 'ประจวบคีรีขันธ์',
  'Chachoengsao': 'ฉะเชิงเทรา', 'Chon Buri': 'ชลบุรี', 'Rayong': 'ระยอง',
  'Chanthaburi': 'จันทบุรี', 'Trat': 'ตราด', 'Prachin Buri': 'ปราจีนบุรี',
  'Sa Kaeo': 'สระแก้ว', 'Chumphon': 'ชุมพร', 'Ranong': 'ระนอง',
  'Surat Thani': 'สุราษฎร์ธานี', 'Phang Nga': 'พังงา', 'Phuket': 'ภูเก็ต',
  'Krabi': 'กระบี่', 'Nakhon Si Thammarat': 'นครศรีธรรมราช',
  'Phatthalung': 'พัทลุง', 'Trang': 'ตรัง', 'Satun': 'สตูล',
  'Songkhla': 'สงขลา', 'Pattani': 'ปัตตานี', 'Yala': 'ยะลา',
  'Narathiwat': 'นราธิวาส',
};

// Mercator projection for Thailand
// Thailand bbox: lon 97.5-105.7, lat 5.5-20.5
const SVG_W = 560, SVG_H = 1025;
const MIN_LON = 97.5, MAX_LON = 105.7;
const MIN_LAT = 5.5, MAX_LAT = 20.5;

function mercY(lat) {
  const latR = lat * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + latR / 2));
}
const mercMin = mercY(MIN_LAT);
const mercMax = mercY(MAX_LAT);

function projectPoint(lon, lat) {
  const x = ((lon - MIN_LON) / (MAX_LON - MIN_LON)) * SVG_W;
  const y = SVG_H - ((mercY(lat) - mercMin) / (mercMax - mercMin)) * SVG_H;
  return [x, y];
}

function ringToPath(ring, step) {
  const pts = [];
  for (let i = 0; i < ring.length; i += step) {
    const [x, y] = projectPoint(ring[i][0], ring[i][1]);
    pts.push(x.toFixed(1) + ',' + y.toFixed(1));
  }
  if (pts.length < 3) return '';
  return 'M' + pts.join('L') + 'Z';
}

function geometryToSvgPath(geometry) {
  const polys = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates; // MultiPolygon

  const paths = [];
  for (const poly of polys) {
    const outerRing = poly[0];
    if (!outerRing || outerRing.length < 4) continue;
    // Adaptive simplification: keep ~120 points per ring max
    const step = Math.max(1, Math.floor(outerRing.length / 120));
    const d = ringToPath(outerRing, step);
    if (d) paths.push(d);
  }
  return paths.join(' ');
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(e); }
      });
    }).on('error', reject).on('timeout', () => reject(new Error('Request timeout')));
  });
}

async function main() {
  console.log('🗺️  Thailand Map Data Generator');
  console.log('================================');
  console.log('กำลังดาวน์โหลดข้อมูล GeoJSON จาก GitHub...\n');

  let geojson;
  try {
    geojson = await fetchJson('https://raw.githubusercontent.com/apisit/thailand.json/master/thailand.json');
  } catch (err) {
    console.error('❌ ดาวน์โหลดไม่สำเร็จ:', err.message);
    process.exit(1);
  }

  if (!geojson || !Array.isArray(geojson.features)) {
    console.error('❌ รูปแบบข้อมูล GeoJSON ไม่ถูกต้อง');
    process.exit(1);
  }

  console.log(`✅ โหลดสำเร็จ: ${geojson.features.length} features\n`);

  // Initialize result structure
  const result = {
    'ภาคเหนือ': [],
    'ภาคตะวันออกเฉียงเหนือ': [],
    'ภาคกลาง': [],
    'ภาคตะวันตก': [],
    'ภาคตะวันออก': [],
    'ภาคใต้': [],
  };

  let matched = 0, skipped = 0;

  for (const feature of geojson.features) {
    const enName = feature.properties?.name;
    if (!enName || !feature.geometry) { skipped++; continue; }

    const region = PROVINCE_REGION_MAP[enName];
    if (!region) {
      console.warn(`  ⚠️  ไม่พบภาคสำหรับ: "${enName}"`);
      skipped++;
      continue;
    }

    const d = geometryToSvgPath(feature.geometry);
    if (!d) {
      console.warn(`  ⚠️  ไม่สามารถสร้าง SVG path สำหรับ: ${enName}`);
      skipped++;
      continue;
    }

    const thName = PROVINCE_TH[enName] || enName;
    result[region].push({
      id: enName.toLowerCase().replace(/\s+/g, '_'),
      label: enName,
      labelTH: thName,
      d,
    });

    console.log(`  ✓ ${thName.padEnd(25)} (${region})`);
    matched++;
  }

  console.log('\n📊 สรุปผล:');
  for (const [region, provinces] of Object.entries(result)) {
    console.log(`  ${region}: ${provinces.length} จังหวัด`);
  }
  console.log(`\n  รวม: ${matched} จังหวัด | ข้าม: ${skipped}`);

  // Write output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\n✅ บันทึกสำเร็จ: ${OUTPUT_PATH}`);
  console.log('   กรุณา refresh browser เพื่อดูแผนที่ที่อัปเดต\n');
}

main().catch(err => {
  console.error('❌ เกิดข้อผิดพลาด:', err);
  process.exit(1);
});
