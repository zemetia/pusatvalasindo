import type { PrismaClient } from '../../src/generated/prisma/client'

type BankAccountDef = {
  bankName: string
  accountNumber: string | null
  accountName: string
  sortOrder: number
}

const PVI_PTU_ACCOUNTS: BankAccountDef[] = [
  { bankName: 'BCA', accountNumber: '8650830050', accountName: 'BCA 8650830050 LAMA', sortOrder: 0 },
  { bankName: 'BCA', accountNumber: '8650620608', accountName: 'BCA 8650620608 BARU', sortOrder: 1 },
  { bankName: 'BCA', accountNumber: null, accountName: 'BCA BARU BANGET', sortOrder: 2 },
  { bankName: 'MANDIRI', accountNumber: '1190008807008', accountName: 'MANDIRI BARU 119 0008 807 008', sortOrder: 3 },
  { bankName: 'MANDIRI', accountNumber: null, accountName: 'MANDIRI BARU NEW', sortOrder: 4 },
  { bankName: 'PENDING', accountNumber: null, accountName: 'PENDING PENARIKAN', sortOrder: 5 },
  { bankName: 'BNI', accountNumber: null, accountName: 'BNI PT', sortOrder: 6 },
  { bankName: 'BRI', accountNumber: null, accountName: 'BRI PT', sortOrder: 7 },
  { bankName: 'JTRUST', accountNumber: null, accountName: 'JTRUST PT', sortOrder: 8 },
  { bankName: 'VICTORIA', accountNumber: null, accountName: 'VICTORIA BANK', sortOrder: 9 },
  { bankName: 'MUAMALAT', accountNumber: null, accountName: 'MUAMALAT', sortOrder: 10 },
  { bankName: 'SINARMAS', accountNumber: null, accountName: 'SINARMAS', sortOrder: 11 },
  { bankName: 'SINARMAS', accountNumber: null, accountName: 'SINARMAS SYARIAH', sortOrder: 12 },
]

const PKD_ACCOUNTS: BankAccountDef[] = [
  { bankName: 'BCA', accountNumber: null, accountName: 'BCA PKD', sortOrder: 0 },
  { bankName: 'MANDIRI', accountNumber: null, accountName: 'MANDIRI PKD', sortOrder: 1 },
  { bankName: 'BNI', accountNumber: null, accountName: 'BNI PKD', sortOrder: 2 },
  { bankName: 'BRI', accountNumber: null, accountName: 'BRI PKD', sortOrder: 3 },
  { bankName: 'PENDING', accountNumber: null, accountName: 'PENDING PENARIKAN', sortOrder: 4 },
]

// Rekening milik 1 PT, dipakai bersama semua cabang di bawahnya — bukan per cabang.
const COMPANY_ACCOUNTS: Record<string, BankAccountDef[]> = {
  PVI: PVI_PTU_ACCOUNTS,
  PTU: PVI_PTU_ACCOUNTS,
  PKD: PKD_ACCOUNTS,
}

export async function seedBankAccounts(
  prisma: PrismaClient,
  companyIds: Record<string, string>,
  idrId: string
): Promise<void> {
  for (const [companyCode, companyId] of Object.entries(companyIds)) {
    const accounts = COMPANY_ACCOUNTS[companyCode]
    if (!accounts) continue
    for (const acc of accounts) {
      const existing = await prisma.bankAccount.findFirst({
        where: { companyId, accountName: acc.accountName },
      })
      if (!existing) {
        await prisma.bankAccount.create({
          data: {
            companyId,
            bankName: acc.bankName,
            accountNumber: acc.accountNumber,
            accountName: acc.accountName,
            currencyId: idrId,
            balance: 0,
            isActive: true,
            sortOrder: acc.sortOrder,
          },
        })
      }
    }
    console.log(`  ✓ ${accounts.length} bank accounts seeded for ${companyCode}`)
  }
}
