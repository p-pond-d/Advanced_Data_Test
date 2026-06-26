/**
 * Script to generate Thailand province SVG paths from a known embedded dataset.
 * This creates the complete thailand_regions.json with all 6 regions.
 * 
 * Run: node generate_map.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Known GeoJSON source for Thailand provinces
const GEOJSON_URL = 'https://raw.githubusercontent.com/apisit/thailand.json/master/thailand.json';

function fetchData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Province to region mapping (Thai names)
const provinceRegionMap = {
  // ภาคเหนือ
  'เชียงใหม่': 'ภาคเหนือ', 'เชียงราย': 'ภาคเหนือ', 'ลำปาง': 'ภาคเหนือ', 'ลำพูน': 'ภาคเหนือ',
  'แม่ฮ่องสอน': 'ภาคเหนือ', 'น่าน': 'ภาคเหนือ', 'พะเยา': 'ภาคเหนือ', 'แพร่': 'ภาคเหนือ', 'อุตรดิตถ์': 'ภาคเหนือ',
  // ภาคตะวันออกเฉียงเหนือ
  'อำนาจเจริญ': 'ภาคตะวันออกเฉียงเหนือ', 'บึงกาฬ': 'ภาคตะวันออกเฉียงเหนือ', 'บุรีรัมย์': 'ภาคตะวันออกเฉียงเหนือ',
  'ชัยภูมิ': 'ภาคตะวันออกเฉียงเหนือ', 'กาฬสินธุ์': 'ภาคตะวันออกเฉียงเหนือ', 'ขอนแก่น': 'ภาคตะวันออกเฉียงเหนือ',
  'เลย': 'ภาคตะวันออกเฉียงเหนือ', 'มหาสารคาม': 'ภาคตะวันออกเฉียงเหนือ', 'มุกดาหาร': 'ภาคตะวันออกเฉียงเหนือ',
  'นครพนม': 'ภาคตะวันออกเฉียงเหนือ', 'นครราชสีมา': 'ภาคตะวันออกเฉียงเหนือ', 'หนองบัวลำภู': 'ภาคตะวันออกเฉียงเหนือ',
  'หนองคาย': 'ภาคตะวันออกเฉียงเหนือ', 'ร้อยเอ็ด': 'ภาคตะวันออกเฉียงเหนือ', 'สกลนคร': 'ภาคตะวันออกเฉียงเหนือ',
  'ศรีสะเกษ': 'ภาคตะวันออกเฉียงเหนือ', 'สุรินทร์': 'ภาคตะวันออกเฉียงเหนือ', 'อุบลราชธานี': 'ภาคตะวันออกเฉียงเหนือ',
  'อุดรธานี': 'ภาคตะวันออกเฉียงเหนือ', 'ยโสธร': 'ภาคตะวันออกเฉียงเหนือ',
  // ภาคกลาง
  'อ่างทอง': 'ภาคกลาง', 'กรุงเทพมหานคร': 'ภาคกลาง', 'ชัยนาท': 'ภาคกลาง',
  'ลพบุรี': 'ภาคกลาง', 'นครนายก': 'ภาคกลาง', 'นครปฐม': 'ภาคกลาง', 'นครสวรรค์': 'ภาคกลาง',
  'นนทบุรี': 'ภาคกลาง', 'ปทุมธานี': 'ภาคกลาง', 'พระนครศรีอยุธยา': 'ภาคกลาง',
  'สมุทรปราการ': 'ภาคกลาง', 'สมุทรสาคร': 'ภาคกลาง', 'สมุทรสงคราม': 'ภาคกลาง',
  'สระบุรี': 'ภาคกลาง', 'สิงห์บุรี': 'ภาคกลาง', 'สุพรรณบุรี': 'ภาคกลาง',
  // ภาคตะวันตก
  'กาญจนบุรี': 'ภาคตะวันตก', 'เพชรบุรี': 'ภาคตะวันตก', 'ประจวบคีรีขันธ์': 'ภาคตะวันตก',
  'ราชบุรี': 'ภาคตะวันตก', 'ตาก': 'ภาคตะวันตก',
  // ภาคตะวันออก
  'ฉะเชิงเทรา': 'ภาคตะวันออก', 'จันทบุรี': 'ภาคตะวันออก', 'ชลบุรี': 'ภาคตะวันออก',
  'ปราจีนบุรี': 'ภาคตะวันออก', 'ระยอง': 'ภาคตะวันออก', 'สระแก้ว': 'ภาคตะวันออก', 'ตราด': 'ภาคตะวันออก',
  // ภาคใต้
  'ชุมพร': 'ภาคใต้', 'กระบี่': 'ภาคใต้', 'นครศรีธรรมราช': 'ภาคใต้', 'นราธิวาส': 'ภาคใต้',
  'ปัตตานี': 'ภาคใต้', 'พังงา': 'ภาคใต้', 'พัทลุง': 'ภาคใต้', 'ภูเก็ต': 'ภาคใต้',
  'ระนอง': 'ภาคใต้', 'สตูล': 'ภาคใต้', 'สงขลา': 'ภาคใต้', 'สุราษฎร์ธานี': 'ภาคใต้',
  'ตรัง': 'ภาคใต้', 'ยะลา': 'ภาคใต้'
};

// Simple SVG path projection (Mercator-like)
// Thailand bbox: lon 97.5-105.7, lat 5.5-20.5
function project(lon, lat) {
  const minLon = 97.5, maxLon = 105.7;
  const minLat = 5.5, maxLat = 20.5;
  const width = 560, height = 1025;
  
  const x = ((lon - minLon) / (maxLon - minLon)) * width;
  const y = height - ((lat - minLat) / (maxLat - minLat)) * height;
  return [x, y];
}

function coordsToPath(coordinates) {
  if (!coordinates || coordinates.length === 0) return '';
  
  const ring = coordinates[0];
  if (!ring || ring.length === 0) return '';
  
  const points = ring.map(coord => project(coord[0], coord[1]));
  const d = points.map((p, i) => {
    return (i === 0 ? 'M' : 'L') + p[0].toFixed(2) + ',' + p[1].toFixed(2);
  }).join(' ') + ' Z';
  
  return d;
}

function multiPolygonToPath(coordinates) {
  return coordinates.map(polygon => {
    if (!polygon || polygon.length === 0) return '';
    const ring = polygon[0];
    if (!ring || ring.length === 0) return '';
    const points = ring.map(coord => project(coord[0], coord[1]));
    return points.map((p, i) => {
      return (i === 0 ? 'M' : 'L') + p[0].toFixed(2) + ',' + p[1].toFixed(2);
    }).join(' ') + ' Z';
  }).join(' ');
}

async function main() {
  console.log('Fetching Thailand GeoJSON...');
  
  try {
    const geojson = await fetchData(GEOJSON_URL);
    
    if (!geojson || !geojson.features) {
      console.error('Invalid GeoJSON format');
      process.exit(1);
    }
    
    console.log(`Found ${geojson.features.length} features`);
    
    const regions = {
      'ภาคเหนือ': [],
      'ภาคตะวันออกเฉียงเหนือ': [],
      'ภาคกลาง': [],
      'ภาคตะวันตก': [],
      'ภาคตะวันออก': [],
      'ภาคใต้': []
    };
    
    geojson.features.forEach(feature => {
      const props = feature.properties;
      const thName = props.NAME_TH || props.name_th || props.PROV_NAMETH || props.province_th;
      const enName = props.NAME_EN || props.name_en || props.PROV_NAMEEN;
      
      console.log('Province:', thName || enName, '| Type:', feature.geometry?.type);
      
      const region = provinceRegionMap[thName];
      if (!region) {
        console.warn(`No region for province: ${thName || enName}`);
        return;
      }
      
      let d = '';
      if (feature.geometry.type === 'Polygon') {
        d = coordsToPath(feature.geometry.coordinates);
      } else if (feature.geometry.type === 'MultiPolygon') {
        d = multiPolygonToPath(feature.geometry.coordinates);
      }
      
      if (d) {
        regions[region].push({
          id: enName ? enName.toLowerCase().replace(/\s+/g, '_') : thName,
          label: enName || thName,
          labelTH: thName,
          d
        });
      }
    });
    
    const outputPath = path.join(__dirname, 'frontend', 'public', 'thailand_regions.json');
    fs.writeFileSync(outputPath, JSON.stringify(regions, null, 2));
    
    console.log('\n✅ Generated thailand_regions.json');
    Object.entries(regions).forEach(([k, v]) => {
      console.log(`  ${k}: ${v.length} provinces`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
