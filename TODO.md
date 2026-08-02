# Design Fee Overrides + Diamond Presets for Necklaces & Bracelets — Task List

## Context
- Necklaces (all, across collections/tiers) should use the **Signature** design/labor fee.
- Bracelets (all) should use the **Essential (basic)** design/labor fee.
- Necklaces & bracelets auto-fill diamond carat **0.50** with quantity adjustable like rings (preset to the product's stone count).
- Keep existing metal weights.

## Steps
- [x] 1. Add type-based design fee override in `computePricing()`: necklace → signature, bracelet → basic
- [x] 2. Add `diamondPreset: { q:'select', c:'0.50', qty:<stones> }` to all Daily Sparkle necklaces & bracelets
- [x] 3. Add `diamondPreset: { q:'select', c:'0.50', qty:<stones> }` to all Occasion Wear necklaces
- [x] 4. Verify in browser that necklaces use Signature fee and bracelets use Essential fee, with 0.50ct auto-filled

