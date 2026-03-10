# 月次・Excel 対象期間のルール（再発防止）

## 対象期間の取得方法

- **月次集計・Excel出力・未入力日・通知**など、締め月の対象期間が必要な箇所では、**必ず `getPeriodForClosingMonth(prisma, year, month)`（`@/lib/period-utils`）を使用すること。**
- 前月11日〜当月10日などの**固定ロジックのハードコードは禁止**。

## 理由

- 締め日はシステム設定（CLOSING_DAY）で変更可能。
- 締め月ごとの対象期間は「締め月ごとの対象期間」で個別設定可能（PeriodSetting）。
- 上記を無視して固定で書くと、ExcelのL2/L4や集計期間が設定と一致しなくなる。

## 修正済みファイル

- `src/app/api/attendance/monthly/route.ts` … getPeriodForClosingMonth 使用
- `src/app/api/attendance/monthly/export-excel/route.ts` … getPeriodForClosingMonth 使用、L2/L4 はテンプレ数式削除後に設定
- `src/app/api/attendance/missing-dates/route.ts` … getPeriodForClosingMonth 使用
- `src/lib/notification.ts` … getPeriodForClosingMonth 使用

## Excel の L2（開始日）・L4（締日）

- `export-excel/route.ts` の `buildSheetFromTemplate` 内で、**テンプレの数式を削除してから** startSerial / endSerial を設定すること（数式が残ると上書きされない場合がある）。
