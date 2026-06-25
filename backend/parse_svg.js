const fs = require('fs');
const path = require('path');

const srcPath = "C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\ca9291a0-175e-4fe1-b7d4-e4208451a8eb\\.system_generated\\steps\\689\\content.md";
const destPath = path.join(__dirname, 'thailand.svg');
const publicDir = path.join(__dirname, '..', 'frontend', 'public');
const outputPath = path.join(publicDir, 'thailand_regions.json');

try {
  // Ensure the public directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
    console.log("Created directory:", publicDir);
  }

  // Copy the source file to backend/thailand.svg if it exists, stripping the first few lines of frontmatter
  if (fs.existsSync(srcPath)) {
    const rawContent = fs.readFileSync(srcPath, 'utf8');
    const lines = rawContent.split(/\r?\n/);
    const svgStartIndex = lines.findIndex(line => line.trim().startsWith('<svg'));
    if (svgStartIndex !== -1) {
      const cleanSvg = lines.slice(svgStartIndex).join('\n');
      fs.writeFileSync(destPath, cleanSvg, 'utf8');
      console.log("Clean SVG file written to", destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log("SVG file copied to", destPath);
    }
  } else {
    console.log("Source SVG not found at", srcPath, "- checking if destination already exists");
  }

  if (fs.existsSync(destPath)) {
    const content = fs.readFileSync(destPath, 'utf8');
    
    // Regex to match path elements
    const pathRegex = /<path\s+([^>]+)>/g;
    let match;
    const pathsExtracted = [];

    while ((match = pathRegex.exec(content)) !== null) {
      const tagContent = match[1];
      
      const idMatch = /id="([^"]+)"/.exec(tagContent);
      const labelMatch = /aria-label="([^"]+)"/.exec(tagContent);
      const dMatch = /\bd="([^"]+)"/s.exec(tagContent); // use \b to avoid matching the 'd' in id="..."
      
      if (idMatch && labelMatch && dMatch) {
        pathsExtracted.push({
          id: idMatch[1],
          label: labelMatch[1],
          d: dMatch[1].replace(/\s+/g, ' ').trim()
        });
      }
    }

    console.log(`Extracted ${pathsExtracted.length} paths`);

    // 6 regions mapping
    const regionsMap = {
      "ภาคเหนือ": ["cmi", "cri", "lpg", "lpn", "mhs", "nan", "pyo", "pre", "utd"],
      "ภาคตะวันออกเฉียงเหนือ": ["acr", "bkn", "brm", "cpm", "ksn", "kkn", "lei", "msk", "mdh", "npm", "nma", "nbl", "nki", "ret", "snk", "ssk", "srn", "ubn", "udn", "yst"],
      "ภาคกลาง": ["atg", "bkk", "cnt", "kpt", "lri", "nyk", "npt", "nsw", "nbi", "pte", "pnb", "aya", "pct", "plk", "spk", "skn", "skm", "sri", "sbr", "sth", "uti", "spb"],
      "ภาคตะวันออก": ["cco", "cti", "cbi", "pri", "ryg", "skw", "trt"],
      "ภาคตะวันตก": ["kcn", "pbi", "pkk", "rbr", "tak"],
      "ภาคใต้": ["cpn", "kbi", "nst", "nwt", "ptn", "pna", "plg", "pkt", "rng", "stn", "ska", "sni", "trg", "yla"]
    };

    const groupedRegions = {};
    for (const r of Object.keys(regionsMap)) {
      groupedRegions[r] = [];
    }

    pathsExtracted.forEach(pe => {
      let found = false;
      for (const [r, ids] of Object.entries(regionsMap)) {
        if (ids.includes(pe.id)) {
          groupedRegions[r].push(pe);
          found = true;
          break;
        }
      }
    });

    // Write to frontend/src/thailand_regions.json
    fs.writeFileSync(outputPath, JSON.stringify(groupedRegions, null, 2), 'utf8');
    console.log("Grouped regions SVG paths written to:", outputPath);
    
    // Print summary counts
    Object.keys(groupedRegions).forEach(r => {
      console.log(`- ${r}: ${groupedRegions[r].length} provinces`);
    });
  } else {
    console.error("Destination SVG not found! Cannot parse.");
  }
} catch (err) {
  console.error("Parse SVG Error:", err);
}
