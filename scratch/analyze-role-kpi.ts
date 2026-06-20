import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'docs/PVI Data/PERHITUNGAN KOMISI KPI_.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    const sheets = ['pusat valas indo ', 'PUSAT TUKAR UANG', 'PUSAT KIRIM DUIT '];

    const allMappings: any[] = [];
    sheets.forEach(name => {
        const sheet = workbook.Sheets[name];
        if (!sheet) return;
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        
        let currentRole = "";
        let weightCol = -1;
        let kpiCol = -1;

        data.forEach((row, index) => {
            if (!row || row.length === 0) return;
            if (row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('% weight'))) {
                weightCol = row.findIndex(cell => typeof cell === 'string' && cell.toLowerCase().includes('% weight'));
                kpiCol = row.findIndex(cell => typeof cell === 'string' && cell.toLowerCase().includes('objective')) + 1;
                if (kpiCol <= 0) kpiCol = 2;
                return;
            }

            if (weightCol !== -1) {
                const weight = row[weightCol];
                const kpi = row[kpiCol];
                const roleCandidate = row[0];

                if (roleCandidate && typeof roleCandidate === 'string' && roleCandidate.trim() !== "" && 
                    !roleCandidate.toLowerCase().includes('objective') && 
                    !roleCandidate.toLowerCase().includes('division')) {
                    currentRole = roleCandidate.trim();
                }

                if (currentRole && kpi && typeof kpi === 'string' && typeof weight === 'number') {
                    allMappings.push({
                        sheet: name,
                        role: currentRole,
                        kpi: kpi.trim(),
                        weight: weight
                    });
                }
            }
        });
    });

    const fs = require('fs');
    fs.writeFileSync('scratch/role-kpi-mapping.json', JSON.stringify(allMappings, null, 2));
    console.log('Successfully wrote scratch/role-kpi-mapping.json');
} catch (err) {
    console.error(err);
}
