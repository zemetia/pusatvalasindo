
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'docs/PVI Data/PERHITUNGAN KOMISI KPI_.xlsx');

if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const workbook = XLSX.readFile(filePath);
const sheetNames = workbook.SheetNames;

console.log('Sheet Names:', sheetNames);

const matrixSheets = sheetNames.filter(name => 
  (name.toLowerCase().includes('matrix') || name.toLowerCase().includes('matrik')) && 
  (name.toLowerCase().includes('bonus') || name.toLowerCase().includes('kpi'))
);
console.log('Detected Matrix Sheets:', matrixSheets);

matrixSheets.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`\n--- Data for ${sheetName} ---`);
  data.forEach((row, i) => {
    if (row && (row as any[]).length > 0) {
      console.log(`Row ${i}:`, row);
    }
  });
});
