/* Estimated necklace construction. Final fit is confirmed by the atelier. */
'use strict';

const DIAMETERS_MM = Object.freeze({ '0.05': 2.4, '0.10': 3.0, '0.15': 3.4, '0.20': 3.8 });
const CLASP_ALLOWANCE_MM = 10;
const SETTING_ALLOWANCE_MM = 0.2;

function estimateStoneCount(lengthInches, carat) {
  const diameter = DIAMETERS_MM[Number(carat).toFixed(2)];
  if (!diameter || !Number.isFinite(lengthInches) || lengthInches <= 0) throw new Error('Choose a supported length and stone size.');
  return Math.max(1, Math.round((lengthInches * 25.4 - CLASP_ALLOWANCE_MM) / (diameter + SETTING_ALLOWANCE_MM)));
}

module.exports = { DIAMETERS_MM, CLASP_ALLOWANCE_MM, SETTING_ALLOWANCE_MM, estimateStoneCount };
