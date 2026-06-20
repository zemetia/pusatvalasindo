# Comparison Analysis: Stok Harian vs. Stok Barang

## 1. Q&A
**What is the difference in functionality and what is their function?**

The fundamental difference is between **Definition** and **Recording**:

*   **Stok Barang (Stock Items)** is the **Master Data** management module. Its function is to define the inventory entities (items) that a branch is allowed to track. It answers the question: *"What items (currencies, gold, or cash) do we have in this branch?"*
*   **Stok Harian (Daily Stock)** is the **Operational Recording** module. Its function is to record the specific balance and market rate for those defined items at the end of a specific day. It answers the question: *"How much of each item did we have on May 4th, and what was its value in IDR?"*

---

## 2. Analysis Overview
This report analyzes the backend and frontend implementation of the Stock management system in the Pusat Valas Indo project. The analysis covers the Prisma schema definitions (`stock.prisma`), frontend page structures (`stock-items/page.tsx` and `stok-harian/page.tsx`), and the core logic in the `DailyStockForm` component.

## 3. Value - Score
| Metric | Score (1-100) | Notes |
| :--- | :--- | :--- |
| **Performance** | 85/100 | Uses server components for listing and efficient Promise.all for fetching. |
| **Security** | 80/100 | Basic CRUD operations; needs verification of role-based access for daily entries. |
| **Maintainability** | 90/100 | Clean separation between master data and transactional data. Uses modular Prisma schemas. |
| **Overall Quality** | **85/100** | **Solid architecture that follows standard ERP/Accounting patterns (Master vs. Transaction).** |

## 4. Advice & Observations

### Data Relationship
*   **Dependency**: `DailyStockEntry` (Stok Harian) has a strictly required foreign key to `StockItem` (Stok Barang). This ensures data integrity; you cannot record a daily balance for an item that hasn't been defined in the master list.
*   **Multi-Tenancy**: Both modules are branch-aware (`branchId`), ensuring that each branch only manages its own inventory list and daily records.

### Logic Flow
1.  **Setup**: Admin adds "USD" to "Cabang Jakarta" in **Stok Barang**.
2.  **Daily Ops**: Every evening, the teller in Jakarta opens **Stok Harian**, selects the branch and date, and the system automatically populates the list with "USD".
3.  **Calculation**: The teller enters the `closingQty` (e.g., 1000) and `rateIdr` (e.g., 16000). The system calculates the `totalIdr` (16,000,000) on the fly and aggregates it into the "TOTAL ASET PT".

### Features in Stok Harian
Interestingly, `Stok Harian` is more than just inventory; it's a **Daily Financial Snapshot**. It also incorporates:
*   **Bank Balances**: Recording the closing balance of PT bank accounts.
*   **Tarik Cek**: Deducting pending check withdrawals from the total assets.
*   **Automatic IDR Conversion**: Calculating total value based on daily rates.

## 5. Recommendations
- [ ] **Critical**: Implement a "Lock" mechanism for `Stok Harian`. Once a day is closed/reconciled, entries should not be editable by regular staff.
- [ ] **Optimization**: Add a "Copy from Yesterday" button in `Stok Harian` to speed up data entry for closing balances that rarely change.
- [ ] **Refactor**: The calculation logic in `DailyStockForm` (useMemo) is quite complex. Consider moving the business logic for "Total Asset" calculation to a utility function or the backend to ensure consistency across the app.

## 6. Further Development
- **Trend Analysis**: Since daily data is captured, a dashboard chart showing the value of assets over time per branch can be easily implemented.
- **Audit Log**: Track who edited the daily stock entries and when, especially for historical corrections.
- **Auto-Rate Integration**: Integration with a currency API to provide "Suggested Rates" in the Stok Harian form.
