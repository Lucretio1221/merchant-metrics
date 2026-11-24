# Merchant metrics

Five metric functions over the Shopify order history, May to October 2025 (`data/orders.csv`, 28 lines). Each takes `start` and `end` (`YYYY-MM-DD`, inclusive).

| Metric | Function | Counts | Dated by |
| --- | --- | --- | --- |
| `daily_sales` | `dailySales` | sum of `line_total`, orders, units per day | `order_date` |
| `new_customers` | `newCustomers` | distinct `customer_id` with `is_repeat_customer = false` | `order_date` |
| `returning_customers` | `returningCustomers` | distinct `customer_id` with `is_repeat_customer = true` | `order_date` |
| `returns_by_product` | `returnsByProduct` | units returned, `refund_amount`, reasons per product | `return_date` |
| `units_sold_by_product` | `unitsSoldByProduct` | units and sales per product (reorder planning) | `order_date` |

Notes: sales are gross (before refunds) and include unfulfilled lines. Returns use `return_date`, so a jacket bought in September and returned last week counts last week.

## Turning "last week" into dates

`resolveDateRange(phrase, referenceDate)` in `lib/dates.ts`. Weeks run Monday to Sunday.

| Phrase | Range |
| --- | --- |
| `last week` | previous full Monday to Sunday |
| `this week` / `this month` | start of period to the reference date |
| `last 7 days` / `last 30 days` | ending on the reference date, inclusive |
| `yesterday` / `today` | that single day |
| `last month` | the previous calendar month |

The reference date is always passed in, never read inside the function, so results are repeatable. The data ends on 2025-10-27, so the demo page uses 2025-10-28 as "today".

## Use

```
npm install
npm test
npm run dev
```

- Page: `/` (try `/?range=last month&today=2025-10-28`)
- API: `/api/metrics/returns_by_product?start=2025-10-20&end=2025-10-26`
- API with a phrase: `/api/metrics/daily_sales?range=last week&today=2025-10-28`
