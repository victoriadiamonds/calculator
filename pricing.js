const BASE = { gold24: 62.0, silver: 0.85, platinum: 34.0 };

const DIAMOND_CARATS = ['0.05','0.1','0.15','0.25','0.50','0.75','1.00','2.00','3.00','4.00','5.00'];

const DIAMOND_PRICES = {
  luxe: {
    '0.05': 16.50,
    '0.1': 59,
    '0.15': 89,
    '0.25': 149,
    '0.50': 297,
    '0.75': 446,
    '1.00': 594,
    '2.00': 1063,
    '3.00': 1594,
    '4.00': 1688,
    '5.00': 2313
  },
  select: {
    '0.05': 12.50,
    '0.1': 23,
    '0.15': 35,
    '0.25': 90,
    '0.50': 150,
    '0.75': 188,
    '1.00': 250,
    '2.00': 500,
    '3.00': 850,
    '4.00': 1300,
    '5.00': 1500
  }
};

const PRICING_PACKAGE_MATRIX = {
  basic: {
    '22K': 1325,
    '18K': 1125,
    '14K': 850,
    '9K': 575,
    'platinum': 575
  },
  signature: {
    '22K': 1855,
    '18K': 1575,
    '14K': 1190,
    '9K': 805,
    'platinum': 805
  }
};

const TIERS = {
  essentials: { label: 'Essentials', emoji: '✦', color: '#2d7d46', tierLabel: 'S' },
  signature: { label: 'Signature', emoji: '◆', color: '#b8860b', tierLabel: 'M' }
};

const TIER_TO_PACKAGE = {
  essentials: 'basic',
  signature: 'signature'
};

const TYPE_LABELS = {
  ring: 'Ring',
  necklace: 'Necklace',
  bracelet: 'Bracelet',
  earrings: 'Earrings',
  tiara: 'Tiara',
  brooch: 'Brooch'
};

const NON_CALCULATED_TYPES = ['tiara', 'brooch'];

const COLLECTION_TIERS = {
  dailySparkle: ['essentials', 'signature'],
  occasionWear: ['essentials', 'signature'],
  foreverBond: ['essentials', 'signature']
};

const PRODUCTS_BY_COLLECTION = {
  dailySparkle: {
    essentials: [
      { id: 'ds_s_solenne', name: 'Solenne', weight: 3.0, labor: 30, stones: 1, type: 'ring' },
      { id: 'ds_s_aria', name: 'Aria', weight: 2.8, labor: 28, stones: 0, type: 'ring' },
      { id: 'ds_s_aurelle', name: 'Aurelle', weight: 3.2, labor: 32, stones: 1, type: 'ring' },
      { id: 'ds_s_aurelia', name: 'Aurelia', weight: 3.4, labor: 33, stones: 1, type: 'ring' },
      { id: 'ds_s_princess', name: 'Princess', weight: 3.5, labor: 30, stones: 1, type: 'ring' },
      { id: 'ds_s_elan', name: 'Elan', weight: 2.5, labor: 26, stones: 0, type: 'ring' },
      { id: 'ds_s_solitaire', name: 'Solitaire', weight: 4.0, labor: 35, stones: 1, type: 'ring' },
      { id: 'ds_s_timeless', name: 'Timeless Classic', weight: 3.8, labor: 33, stones: 0, type: 'ring' },
      { id: 'ds_m_eternity', name: 'Eternity Ring', weight: 5.5, labor: 45, stones: 2, type: 'ring' },
      { id: 'ds_m_splendor', name: 'Splendor Rings', weight: 6.0, labor: 48, stones: 2, type: 'ring' },
      { id: 'ds_s_fiora', name: 'Fiora Earrings', weight: 5.7, labor: 30, stones: 8, type: 'earrings', diamondPreset: { q: 'select', c: '0.25', qty: 8 } },
      { id: 'ds_s_luminea', name: 'Luminea Earrings', weight: 5.23, labor: 30, stones: 6, type: 'earrings', diamondPreset: { q: 'select', c: '0.25', qty: 6 } },
      { id: 'ds_s_martini', name: 'Martini Studs', weight: 5.0, labor: 40, stones: 2, type: 'earrings' },
      { id: 'ds_s_diamond_dust', name: 'Diamond Dust', weight: 3.0, labor: 30, stones: 1, type: 'ring' },
      { id: 'ds_s_nocturne', name: 'Nocturne', weight: 3.2, labor: 30, stones: 1, type: 'ring' },
      { id: 'ds_s_gianna', name: 'Gianna', weight: 3.0, labor: 28, stones: 0, type: 'ring' },
      { id: 'ds_s_raya', name: 'Raya', weight: 3.2, labor: 30, stones: 1, type: 'ring' },
      { id: 'ds_s_mirabelle', name: 'Mirabelle', weight: 3.5, labor: 32, stones: 1, type: 'ring' },
      { id: 'ds_s_cascade', name: 'Cascade', weight: 3.2, labor: 30, stones: 1, type: 'ring' },
      { id: 'ds_s_nova', name: 'Nova', weight: 3.0, labor: 30, stones: 1, type: 'ring' },
      { id: 'ds_s_elara', name: 'Elara', weight: 3.2, labor: 30, stones: 1, type: 'ring' },
      { id: 'ds_m_solenne_bracelet', name: 'Solenne Bracelet', weight: 7.0, labor: 50, stones: 2, type: 'bracelet', diamondPreset: { q: 'select', c: '0.50', qty: 2 } },
      { id: 'ds_m_aurea_bracelet', name: 'Aurea Bracelet', weight: 7.5, labor: 52, stones: 2, type: 'bracelet', diamondPreset: { q: 'select', c: '0.50', qty: 2 } },
      { id: 'ds_m_liora_bracelet', name: 'Liora Bracelet', weight: 6.5, labor: 48, stones: 1, type: 'bracelet', diamondPreset: { q: 'select', c: '0.50', qty: 1 } },
      { id: 'ds_m_celeste_bracelet', name: 'Celeste Bracelet', weight: 7.0, labor: 50, stones: 1, type: 'bracelet', diamondPreset: { q: 'select', c: '0.50', qty: 1 } },
      { id: 'ds_m_lumiere_bracelet', name: 'Lumiere Bracelet', weight: 8.0, labor: 54, stones: 3, type: 'bracelet', diamondPreset: { q: 'select', c: '0.50', qty: 3 } }
    ],
    signature: [
      { id: 'ds_m_solstice', name: 'Solstice Necklace', weight: 8.0, labor: 55, stones: 3, type: 'necklace', diamondPreset: { q: 'select', c: '0.75', qty: 3 } },
      { id: 'ds_m_aurora', name: 'Aurora Necklace', weight: 9.0, labor: 58, stones: 3, type: 'necklace', diamondPreset: { q: 'select', c: '0.75', qty: 3 } },
      { id: 'ds_m_celeste', name: 'Celeste Necklace', weight: 8.5, labor: 56, stones: 2, type: 'necklace', diamondPreset: { q: 'select', c: '0.50', qty: 2 } },
      { id: 'ds_l_serenity', name: 'Serenity Necklace', weight: 16.0, labor: 80, stones: 5, type: 'necklace', diamondPreset: { q: 'select', c: '0.75', qty: 5 } },
      { id: 'ds_l_virelle', name: 'Virelle Necklace', weight: 18.0, labor: 85, stones: 6, type: 'necklace', diamondPreset: { q: 'select', c: '0.50', qty: 6 } },
      { id: 'ds_l_luvia', name: 'Luvia Necklace', weight: 20.0, labor: 90, stones: 7, type: 'necklace', diamondPreset: { q: 'select', c: '0.50', qty: 7 } }
    ]
  },
  occasionWear: {
    essentials: [
      { id: 'ow_s_promise', name: 'Promise of Forever', weight: 4.0, labor: 35, stones: 1, type: 'ring' },
      { id: 'ow_s_tranquility', name: 'Tranquility', weight: 3.5, labor: 32, stones: 0, type: 'ring' },
      { id: 'ow_s_anora', name: 'Anora', weight: 3.8, labor: 33, stones: 1, type: 'ring' },
      { id: 'ow_s_amour', name: 'Amour', weight: 4.2, labor: 36, stones: 1, type: 'ring' },
      { id: 'ow_s_promise_rg', name: 'Promise of Forever (Rose Gold)', weight: 4.0, labor: 38, stones: 1, type: 'ring' },
      { id: 'ow_m_skylar', name: 'Skylar', weight: 9.5, labor: 62, stones: 4, type: 'ring', diamondPreset: { q: 'select', c: '0.50', qty: 4 } },
      { id: 'ow_m_fae', name: 'Fae', weight: 8.0, labor: 55, stones: 3, type: 'ring', diamondPreset: { q: 'select', c: '0.50', qty: 3 } },
      { id: 'ow_m_athena', name: 'Athena', weight: 9.0, labor: 60, stones: 4, type: 'ring', diamondPreset: { q: 'select', c: '0.50', qty: 4 } },
      { id: 'ow_m_victorian', name: 'Victorian', weight: 11.0, labor: 68, stones: 5, type: 'ring', diamondPreset: { q: 'select', c: '0.50', qty: 5 } },
      { id: 'ow_m_elysia', name: 'Elysia', weight: 9.0, labor: 60, stones: 4, type: 'ring', diamondPreset: { q: 'select', c: '0.50', qty: 4 } },
      { id: 'ow_m_eternelle', name: 'Eternelle Grand', weight: 10.0, labor: 65, stones: 5, type: 'ring', diamondPreset: { q: 'select', c: '0.50', qty: 5 } },
      { id: 'ow_m_rosebloom', name: 'Rose Bloom', weight: 8.5, labor: 58, stones: 3, type: 'ring', diamondPreset: { q: 'select', c: '0.50', qty: 3 } },
      { id: 'ow_m_celestia', name: 'Celestia', weight: 10.0, labor: 65, stones: 5, type: 'ring', diamondPreset: { q: 'select', c: '0.50', qty: 5 } },
      { id: 'ow_m_lunelle', name: 'Lunelle', weight: 8.5, labor: 56, stones: 3, type: 'ring', diamondPreset: { q: 'select', c: '0.50', qty: 3 } },
      { id: 'ow_m_celestia_brooch', name: 'Celestia Brooch', weight: 7.0, labor: 50, stones: 3, type: 'brooch' },
      { id: 'ow_m_eternelle_brooch', name: 'Eternelle Brooch', weight: 7.5, labor: 52, stones: 3, type: 'brooch' },
      { id: 'ow_m_illusion', name: 'Round Illusion', weight: 8.0, labor: 55, stones: 2, type: 'earrings' },
      { id: 'ow_m_fiora', name: 'Fiora', weight: 9.0, labor: 60, stones: 4, type: 'earrings', diamondPreset: { q: 'select', c: '0.50', qty: 4 } },
      { id: 'ow_m_luminia_tiara', name: 'Luminia Tiara', weight: 12.0, labor: 75, stones: 6, type: 'tiara' },
      { id: 'ow_l_lumina', name: 'Lumina', weight: 18.0, labor: 88, stones: 7, type: 'bracelet', diamondPreset: { q: 'select', c: '0.50', qty: 7 } },
      { id: 'ow_l_arabella', name: 'Arabella', weight: 20.0, labor: 95, stones: 8, type: 'bracelet', diamondPreset: { q: 'select', c: '0.50', qty: 8 } }
    ],
    signature: [
      { id: 'ow_l_venus', name: 'Venus', weight: 18.0, labor: 90, stones: 8, type: 'ring', diamondPreset: { q: 'select', c: '0.50', qty: 8 } },
      { id: 'ow_l_imperial', name: 'Imperial Pave', weight: 22.0, labor: 100, stones: 10, type: 'ring', diamondPreset: { q: 'select', c: '0.50', qty: 10 } }
    ]
  },
  foreverBond: {
    essentials: [
      { id: 'fb_s_moment_to_shine', name: 'Moment to Shine Ring', weight: 3.0, labor: 28, stones: 0, type: 'ring' },
      { id: 'fb_s_unbreakable_hearts', name: 'Unbreakable Hearts Ring', weight: 3.5, labor: 32, stones: 1, type: 'ring' },
      { id: 'fb_s_bound_by_destiny', name: 'Bound by Destiny Ring', weight: 4.0, labor: 35, stones: 1, type: 'ring' },
      { id: 'fb_s_amour_eternel', name: 'Amour Éternel Ring', weight: 3.8, labor: 33, stones: 1, type: 'ring' },
      { id: 'fb_s_eternal_promise', name: 'Eternal Promise Ring', weight: 5.0, labor: 40, stones: 1, type: 'ring' },
      { id: 'fb_s_wedding_bands', name: 'Wedding Bands', weight: 4.5, labor: 38, stones: 0, type: 'ring' },
      { id: 'fb_m_stellar', name: 'Stellar Promise', weight: 7.0, labor: 50, stones: 2, type: 'ring' },
      { id: 'fb_m_elegance', name: 'Elegance Unie', weight: 8.0, labor: 55, stones: 3, type: 'ring' },
      { id: 'fb_m_lumiere_eternity', name: 'Lumière Eternity Ring', weight: 7.5, labor: 52, stones: 2, type: 'ring' },
      { id: 'fb_m_endless', name: 'Endless Devotion Ring', weight: 8.5, labor: 58, stones: 3, type: 'ring' },
      { id: 'fb_m_everlasting', name: 'Everlasting Embrace Ring', weight: 9.0, labor: 60, stones: 3, type: 'ring' },
      { id: 'fb_m_knot', name: 'The Knot Ring', weight: 7.0, labor: 50, stones: 2, type: 'ring' },
      { id: 'fb_m_eternal_connection', name: 'Eternal Connection Ring', weight: 8.0, labor: 55, stones: 2, type: 'ring' },
      { id: 'fb_m_eternal_harmony', name: 'Eternal Harmony Ring', weight: 8.5, labor: 56, stones: 3, type: 'ring' },
      { id: 'fb_m_destiny_couple', name: 'Destiny Couple Ring', weight: 10.0, labor: 65, stones: 4, type: 'ring' },
      { id: 'fb_l_eternal_promise_set', name: 'Eternal Promise Ring Set (Couple\'s Ring)', weight: 12.0, labor: 80, stones: 5, type: 'ring' }
    ],
    signature: [
      { id: 'fb_m_luminous', name: 'Luminous Devotion Ring', weight: 8.0, labor: 55, stones: 3, type: 'ring' },
      { id: 'fb_m_elysian', name: 'Elysian Ring', weight: 7.5, labor: 54, stones: 2, type: 'ring' },
      { id: 'fb_l_ethereal_halo', name: 'Ethereal Halo Ring', weight: 14.0, labor: 78, stones: 6, type: 'ring' },
      { id: 'fb_l_celestial_embrace', name: 'Celestial Embrace Ring', weight: 9.5, labor: 62, stones: 4, type: 'ring' }
    ]
  }
};

const DIAMOND_SECTION_NAMES = ['Main Diamond', 'Diamond 2', 'Diamond 3', 'Diamond 4'];

function getCollectionName(id) {
  const names = { dailySparkle: 'Daily Sparkle', occasionWear: 'Occasion Wear', foreverBond: 'Forever Bond' };
  return names[id] || id;
}

function getProductInherentTier(collection, productId) {
  const tiers = PRODUCTS_BY_COLLECTION[collection];
  for (var tierKey in tiers) {
    if (tiers.hasOwnProperty(tierKey)) {
      var found = tiers[tierKey].find(function(p) { return p.id === productId; });
      if (found) return tierKey;
    }
  }
  return null;
}

function getProductsForCollection(collection, typeFilter) {
  var allProducts = [];
  const tiers = PRODUCTS_BY_COLLECTION[collection] || {};
  for (var tierKey in tiers) {
    if (tiers.hasOwnProperty(tierKey)) {
      var tierProducts = tiers[tierKey];
      if (typeFilter && typeFilter !== 'all') {
        tierProducts = tierProducts.filter(function(p) { return p.type === typeFilter; });
      }
      allProducts = allProducts.concat(tierProducts);
    }
  }
  return allProducts;
}

function isNonCalculatedType(type) {
  return NON_CALCULATED_TYPES.indexOf(type) !== -1;
}

function getMetalPricePerGram(metal, karat, purity) {
  if (metal === 'gold') {
    return BASE.gold24 * (karat / 24);
  }
  if (metal === 'silver') {
    return BASE.silver * (purity / 1000);
  }
  return BASE.platinum;
}

function computePricing(params) {
  const { collection, productId, typeFilter, metal, karat, purity, diamonds, quantity, discount, profit, designFee } = params;
  
  const products = getProductsForCollection(collection, typeFilter);
  const prod = products.find(function(p) { return p.id === productId; }) || products[0];
  if (!prod) return null;

  const tierKey = getProductInherentTier(collection, prod.id) || 'essentials';

  if (isNonCalculatedType(prod.type)) {
    return {
      priceOnRequest: true,
      prod: prod,
      collection: collection,
      tierKey: tierKey,
      type: prod.type
    };
  }

  let packageKey = TIER_TO_PACKAGE[tierKey] || 'basic';
  if (prod.type === 'bracelet') {
    packageKey = 'basic';
  }

  let metalKey;
  if (metal === 'platinum') {
    metalKey = 'platinum';
  } else if (metal === 'gold') {
    metalKey = karat + 'K';
  } else {
    metalKey = '9K';
  }

  const designComplexityFee = (PRICING_PACKAGE_MATRIX[packageKey] && PRICING_PACKAGE_MATRIX[packageKey][metalKey]) || 0;
  const ringPrice = designComplexityFee;

  let diamondPrice = 0;
  let hasUnpricedDiamond = false;
  const entries = [];
  
  for (var i = 0; i < 4; i++) {
    const d = diamonds[i] || { quality: 'select', carat: '0', qty: 1 };
    const caratNum = Number(d.carat) || 0;
    var price = 0;
    var unpriced = false;
    if (caratNum > 0) {
      const tierPrices = DIAMOND_PRICES[d.quality] || {};
      const rawPrice = tierPrices[d.carat];
      if (rawPrice === null || rawPrice === undefined) {
        unpriced = true;
        price = 0;
      } else {
        price = rawPrice;
      }
    }
    const total = price * (Number(d.qty) || 0);
    diamondPrice += total;
    if (caratNum > 0 && unpriced) hasUnpricedDiamond = true;
    entries.push({
      quality: d.quality,
      carat: d.carat,
      caratNum: caratNum,
      qty: Number(d.qty) || 0,
      price: price,
      unpriced: unpriced,
      total: total
    });
  }

  const qty = Number(quantity) || 1;
  const profitPct = Number(profit) || 0;
  const designFeeAmt = Number(designFee) || 0;
  let discountPct = Number(discount) || 0;
  discountPct = Math.min(Math.max(discountPct, 0), 100);

  const subtotal = ringPrice + diamondPrice + designFeeAmt;
  const profitAmount = subtotal * (profitPct / 100);
  const unitTotal = subtotal + profitAmount;
  const grandTotal = unitTotal * qty;
  const discountAmount = grandTotal * (discountPct / 100);
  const finalTotal = grandTotal - discountAmount;

  return {
    priceOnRequest: false,
    prod: prod,
    collection: collection,
    tierKey: tierKey,
    packageKey: packageKey,
    metal: metal,
    metalKey: metalKey,
    designComplexityFee: designComplexityFee,
    ringPrice: ringPrice,
    entries: entries,
    diamondPrice: diamondPrice,
    hasUnpricedDiamond: hasUnpricedDiamond,
    qty: qty,
    profitPct: profitPct,
    designFee: designFeeAmt,
    discount: discountPct,
    subtotal: subtotal,
    profitAmount: profitAmount,
    unitTotal: unitTotal,
    grandTotal: grandTotal,
    discountAmount: discountAmount,
    finalTotal: finalTotal
  };
}

function formatGBP(v) {
  return '£' + Math.round(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

module.exports = {
  BASE,
  DIAMOND_CARATS,
  DIAMOND_PRICES,
  PRICING_PACKAGE_MATRIX,
  TIERS,
  TIER_TO_PACKAGE,
  TYPE_LABELS,
  NON_CALCULATED_TYPES,
  COLLECTION_TIERS,
  PRODUCTS_BY_COLLECTION,
  DIAMOND_SECTION_NAMES,
  getCollectionName,
  getProductInherentTier,
  getProductsForCollection,
  isNonCalculatedType,
  getMetalPricePerGram,
  computePricing,
  formatGBP
};