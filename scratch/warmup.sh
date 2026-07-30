#!/usr/bin/env bash
# Panaskan seluruh rute yang dipakai uji izin, supaya kompilasi Turbopack tidak
# mengacaukan pengukuran (dan tidak menabrak timeout undici).
BASE=${1:-http://localhost:52425}
COOKIE=$(curl -s -D - -o /dev/null -X POST -H "content-type: application/json" \
  -H "x-forwarded-for: 10.9.9.9" \
  -d '{"email":"owner@pvi.com","password":"password123"}' \
  "$BASE/api/auth/sign-in/email" | grep -i '^set-cookie:' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1 | paste -sd'; ' -)

PAGES="
/dashboard/attendance
/dashboard/kpi/presensi
/dashboard/kpi
/dashboard/kpi/definitions
/dashboard/kpi/log
/dashboard/kpi/analisis
/dashboard/payroll
/dashboard/payroll/komponen
/dashboard/laporan-finance
/dashboard/watcher-valas
/dashboard/bank-accounts
/dashboard/stockist/bank
/dashboard/stockist
/dashboard/stockist/konfirmasi
/dashboard/stock-management-pt
/dashboard/mata-uang
/dashboard/harga-valas
/dashboard/patokan-harga
/dashboard/persetujuan-koreksi
/dashboard/users
/dashboard/pt
/dashboard/branches
/dashboard/roles
/dashboard
"

APIS="
/api/roles
/api/companies
/api/branches
/api/users
/api/salary-components
/api/bank-accounts
/api/currencies
/api/kpi-definitions
/api/bank-harian?companyId=2&date=$(date +%Y-%m-%d)
"

for p in $PAGES; do
  printf "%-36s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code} %{time_total}s' --max-time 900 -H "cookie: $COOKIE" -H "x-forwarded-for: 10.9.9.9" "$BASE/id$p")"
done

for p in $APIS; do
  printf "%-36s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code} %{time_total}s' --max-time 900 -H "cookie: $COOKIE" -H "x-forwarded-for: 10.9.9.9" "$BASE$p")"
done
echo WARMUP_DONE
