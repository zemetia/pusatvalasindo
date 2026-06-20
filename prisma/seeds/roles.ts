
import type { PrismaClient } from '../../src/generated/prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

export async function seedRoles(prisma: PrismaClient, companyIds: Record<string, string>) {
  console.log('  🗑️ Cleaning up old roles and matrices...')
  await prisma.roleKpi.deleteMany()
  await prisma.bonusMatrix.deleteMany()
  await prisma.custom_role.deleteMany()

  const filePath = path.join(process.cwd(), 'docs/PVI Data/PERHITUNGAN KOMISI KPI_.xlsx');
  const workbook = XLSX.readFile(filePath);

  const sheetMapping: Record<string, string> = {
    'MATRIK BONUS KPI ': 'PVI',
    'MATRIK BONUS  pusat tukar uang': 'PTU',
    'MATRIX PUSAT KIRIM DUIT': 'PKD',
  };

  for (const [sheetName, companyCode] of Object.entries(sheetMapping)) {
    const companyId = companyIds[companyCode];
    if (!companyId) continue;

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      console.warn(`  ! Sheet not found: ${sheetName}`);
      continue;
    }

    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    const roles: string[] = [];

    const formatRoleName = (name: string) => {
      return name
        .split(' ')
        .map((word) => {
          const lower = word.toLowerCase();
          if (lower === 'dan' || lower === 'and') return '&';
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
    };

    data.forEach((row) => {
      if (!row || row.length === 0) return;
      
      const firstCell = row[0];
      if (typeof firstCell === 'string' && firstCell.trim() !== '' && 
          !firstCell.toLowerCase().includes('matrix') && 
          !firstCell.toLowerCase().includes('note')) {
        const roleName = formatRoleName(firstCell.trim());
        if (!roles.includes(roleName)) {
          roles.push(roleName);
        }
      }
    });

    console.log(`  🌱 Seeding roles for ${companyCode}: ${roles.join(', ')}`);

    for (const roleName of roles) {
      await prisma.custom_role.upsert({
        where: {
          name_companyId: {
            name: roleName,
            companyId: companyId,
          },
        },
        update: {},
        create: {
          name: roleName,
          companyId: companyId,
          permissions: [], // Default empty
        },
      });
    }
  }
}
