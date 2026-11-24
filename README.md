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


## Output for last week

Run with `npm run last-week` (reference date 2025-10-28, so last week is Mon 2025-10-20 to Sun 2025-10-26).

```text
"last week" as of 2025-10-28 -> 2025-10-20 to 2025-10-26

$ daily_sales("2025-10-20", "2025-10-26")
[
  {
    "date": "2025-10-20",
    "sales": 0,
    "orders": 0,
    "units": 0
  },
  {
    "date": "2025-10-21",
    "sales": 159,
    "orders": 1,
    "units": 1
  },
  {
    "date": "2025-10-22",
    "sales": 0,
    "orders": 0,
    "units": 0
  },
  {
    "date": "2025-10-23",
    "sales": 238.5,
    "orders": 1,
    "units": 2
  },
  {
    "date": "2025-10-24",
    "sales": 0,
    "orders": 0,
    "units": 0
  },
  {
    "date": "2025-10-25",
    "sales": 72,
    "orders": 1,
    "units": 3
  },
  {
    "date": "2025-10-26",
    "sales": 74,
    "orders": 1,
    "units": 1
  }
]

$ new_customers("2025-10-20", "2025-10-26")
[
  {
    "date": "2025-10-20",
    "customers": 0
  },
  {
    "date": "2025-10-21",
    "customers": 0
  },
  {
    "date": "2025-10-22",
    "customers": 0
  },
  {
    "date": "2025-10-23",
    "customers": 1
  },
  {
    "date": "2025-10-24",
    "customers": 0
  },
  {
    "date": "2025-10-25",
    "customers": 0
  },
  {
    "date": "2025-10-26",
    "customers": 1
  }
]

$ returning_customers("2025-10-20", "2025-10-26")
[
  {
    "date": "2025-10-20",
    "customers": 0
  },
  {
    "date": "2025-10-21",
    "customers": 1
  },
  {
    "date": "2025-10-22",
    "customers": 0
  },
  {
    "date": "2025-10-23",
    "customers": 0
  },
  {
    "date": "2025-10-24",
    "customers": 0
  },
  {
    "date": "2025-10-25",
    "customers": 1
  },
  {
    "date": "2025-10-26",
    "customers": 0
  }
]

$ returns_by_product("2025-10-20", "2025-10-26")
[
  {
    "productId": "P-1001",
    "productTitle": "Alpine Down Parka",
    "productCategory": "Outerwear",
    "unitsReturned": 3,
    "refundAmount": 657,
    "reasons": {
      "Too small": 1,
      "Too large": 1,
      "Defective": 1
    }
  },
  {
    "productId": "P-1002",
    "productTitle": "Northridge Insulated Jacket",
    "productCategory": "Outerwear",
    "unitsReturned": 1,
    "refundAmount": 135.15,
    "reasons": {
      "Too small": 1
    }
  }
]

$ units_sold_by_product("2025-10-20", "2025-10-26")
[
  {
    "productId": "P-1010",
    "productTitle": "Wool Beanie",
    "productCategory": "Accessories",
    "unitsSold": 3,
    "sales": 72
  },
  {
    "productId": "P-1002",
    "productTitle": "Northridge Insulated Jacket",
    "productCategory": "Outerwear",
    "unitsSold": 1,
    "sales": 159
  },
  {
    "productId": "P-1001",
    "productTitle": "Alpine Down Parka",
    "productCategory": "Outerwear",
    "unitsSold": 1,
    "sales": 197.1
  },
  {
    "productId": "P-1011",
    "productTitle": "Leather Gloves",
    "productCategory": "Accessories",
    "unitsSold": 1,
    "sales": 41.4
  },
  {
    "productId": "P-1009",
    "productTitle": "Utility Chino",
    "productCategory": "Bottoms",
    "unitsSold": 1,
    "sales": 74
  }
]
```
