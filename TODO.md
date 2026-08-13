# Necklaces Signature Tiers — Task List

## Context
- All necklaces should be **Signature** tier.

## Steps
- [x] 1. Move all 6 Daily Sparkle necklaces from `essentials` to `signature` in `PRODUCTS_BY_COLLECTION.dailySparkle`
- [x] 2. Remove the `necklace` package override in `computePricing()` (necklaces priced using their tier's Signature design fee)
- [x] 3. Keep bracelets forced to Basic design fee
- [x] 4. Verify necklaces show the Signature badge and use Signature model label

## Follow-up: Diamond carat
- [x] 5. Add `0.05` carat option to `DIAMOND_CARATS` (positioned lower/smaller than `0.1`)
- [x] 6. Add `0.05` pricing to Luxe (£16.50) and Select (£12.50) tiers, both lower than the `0.1` price
- [x] 7. Remove the `0.5` carat entry from `DIAMOND_CARATS` and the Select tier (the one priced at 12.5)
- [x] 8. Set the `0.05` carat Select price to £12.50
- [x] 9. Update Select tier prices: 0.05=12.5, 0.1=23, 0.15=35, 0.25=90, 0.50=150, 1.00=250 (2.00=500, 3.00=850, 4.00=1300, 5.00=1500 unchanged)

## Follow-up: New product
- [x] 10. Add new "Aurelia" ring product to Daily Sparkle essentials tier (id: ds_s_aurelia, weight 3.4, labor 33, 1 stone)

---

# Remove Atelier Tier from Pricing — Task List

## Context
- The **Atelier** tier is removed entirely from pricing.
- All rings use the **Essentials** tier in pricing.
- Exceptions: only 6 premium rings are **Signature**:
  - Venus Ring
  - Imperial Pavé Ring
  - Celestial Embrace Ring
  - Ethereal Halo Ring
  - Elysian Ring
  - Luminous Devotion Ring
- All earrings/studs, necklaces, and bracelets use the **Essentials** tier in pricing.
- The Atelier price matrix and tier configuration are removed.

## Steps
- [x] 1. Remove `atelier` price tier from `PRICING_PACKAGE_MATRIX` (only `basic` & `signature` remain)
- [x] 2. Remove `atelier` from `TIERS` and `TIER_TO_PACKAGE` mappings
- [x] 3. Remove `atelier` from `COLLECTION_TIERS`
- [x] 4. Reassign all non-exception rings to `essentials`
- [x] 5. Reassign the 6 premium rings to `signature`
- [x] 6. Reassign all earrings/studs, necklaces, and bracelets to `essentials`
- [x] 7. Move Daily Sparkle necklaces & Occasion Wear bracelets out of `atelier` into `essentials`
- [x] 8. Update `computePricing()` necklace/bracelet package override (no more `atelier`)
- [x] 9. Update breakdown package labels (remove `atelier`)
- [x] 10. Verify no `atelier` references remain in code

