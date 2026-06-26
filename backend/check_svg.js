const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, 'thailand.svg');
const content = fs.readFileSync(svgPath, 'utf8');

// Print first 500 chars to check encoding
console.log("First 100 characters of SVG content:", content.substring(0, 100));

const pathRegex = /<path\s+([^>]+)>/g;
let match;
const ids = [];

while ((match = pathRegex.exec(content)) !== null) {
  const tagContent = match[1];
  const idMatch = /id="([^"]+)"/.exec(tagContent);
  const labelMatch = /aria-label="([^"]+)"/.exec(tagContent);
  if (idMatch) {
    ids.push({ id: idMatch[1], label: labelMatch ? labelMatch[1] : 'No Label' });
  }
}

console.log("Total paths with IDs:", ids.length);
console.log("Sample IDs:", ids.slice(0, 15));
console.log("All IDs:", ids.map(x => x.id).join(', '));
