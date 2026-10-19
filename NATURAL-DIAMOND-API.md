# Natural diamond website integration

The catalogue also includes 1,369 verified lowest-price combinations for exact 0.25, 0.50 and 0.75ct natural diamonds from 77 Diamonds, audited on 17 October 2026 (Asia/Manila). Searches covered the workbook's five shapes and D–L, SI2–FL, Good/Very Good/Excellent/Cupid's Ideal parameters. Only combinations actually returned by the source are offered. The underlying audit records 135 complete, distinct colour/shape/carat searches covering 69,988 listings. `natural-diamond-audit.json` retains the selected source stone code, raw GBP price, audit time and coverage totals.

For these new combinations the source amount is the public final GBP price **including UK VAT and the current public source promotion**; the owner’s additional 10% reduction is applied once to that displayed source price. The original workbook entries retain their original source amounts. The source does not provide matching prices below its 0.18ct search floor, so 0.05, 0.10 and 0.15ct are not offered or interpolated. Source availability and promotions may change; these are audited snapshots, not live stock reservations.

Users can select up to four independently graded natural diamond groups, each with its own quantity. “Add another diamond” returns to the selection controls without discarding earlier selections.

Prices use GBP and the exact combinations imported from the owner-supplied workbook. Each natural diamond price is reduced by 10% from its workbook price and rounded to the nearest penny (half up). `price` is the amount charged; `sourcePrice` preserves the original workbook amount for reference. The reduction applies to natural diamonds only. Entries describe price combinations, not individually certified or reserved inventory. No cut/colour/clarity or stock details are invented. Stable row IDs belong to this catalogue version; refreshing the workbook requires review of IDs and prices.

- `GET /api/v1/collections`: available collection IDs and labels.
- `GET /api/v1/pieces?collection=mens&type=ring`: product IDs and presets.
- `GET /api/v1/natural-diamonds/facets`: supported shapes, carats, colours, clarity and cuts.
- `GET /api/v1/natural-diamonds?shape=Round&carat=1&colour=D&clarity=VS1&cut=Excellent&maxPrice=10000&sort=price-asc&offset=0&limit=40`: exact priced combinations. `sort=price-desc` reverses price order; maximum page size 100.
- `POST /api/v1/quote`: side-effect-free authoritative quote, returns `total`, `due`, `balance`, `currency`, `paymentPercentage`. Client pricing adjustments are ignored for website purchase quotes.
- `POST /api/v1/payment-link`: existing Airwallex payment-link flow, with a fresh `expectedTotal`, customer name/email, and the quote configuration. Price mismatch returns 409. Requires the existing configured Airwallex credentials. Existing collection-specific quote/payment-link endpoints also accept natural selections.

Example quote payload (use a product ID from the pieces endpoint):

```json
{
  "collection": "mens",
  "productId": "mens_atlas_band",
  "diamondOrigin": "natural",
  "metal": "gold",
  "karat": 18,
  "diamonds": [{"naturalId": "nd-0002", "qty": 1}],
  "quantity": 1,
  "paymentPercentage": 50
}
```

For bracelets include `braceletMetalTier`. Natural groups require a valid catalogue ID and integer quantity 1–100, maximum four groups. The server resolves price and grading attributes from the catalogue and ignores caller-provided prices. Lab is the default when `diamondOrigin` is omitted. Lab diamond payloads remain unchanged. Silver Collection retains its fixed specification and does not accept natural substitutions.

Payment-link requests add `expectedTotal` from a fresh quote, `customerName` and `customerEmail`. The same webhook, receipts, deposits and payment handling apply. Integrate from an existing allowed Victoria Diamonds origin; configure additional trusted origins on the server if needed. Never place Airwallex secrets in website code. This change does not publish or connect the main website itself.
