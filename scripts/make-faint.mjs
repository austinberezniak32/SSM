import sharp from 'sharp';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500">
  <rect width="800" height="500" fill="#f2f0ec"/>
  <text x="40" y="60" font-family="Courier New" font-size="26" fill="#c9c4bc">YS PLUMBING SUPPLY</text>
  <text x="40" y="110" font-family="Courier New" font-size="20" fill="#cfcac2">INVOICE 260217009   PO H01460-193</text>
  <text x="40" y="170" font-family="Courier New" font-size="18" fill="#d2cdc5">351-1450  4 X 20 SCH 80 PVC PIPE   240 FT   1560.00</text>
  <text x="40" y="210" font-family="Courier New" font-size="18" fill="#d2cdc5">048-8090  4 COUPLING SCH 80 PVC     20 EA    322.60</text>
  <text x="40" y="270" font-family="Courier New" font-size="20" fill="#ccc7bf">TOTAL  5503.90</text>
</svg>`;
await sharp(Buffer.from(svg)).jpeg().toFile('scripts/faint-slip.jpg');
console.log('made faint slip');
