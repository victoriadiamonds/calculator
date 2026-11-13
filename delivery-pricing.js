function deliveryPricing(subtotal, destination) {
  if (destination !== undefined && !['GB', 'international'].includes(destination)) {
    throw new Error('Choose a delivery destination.');
  }
  const net = Math.round(subtotal * 100);
  const vat = destination === 'GB' ? Math.round(net * 0.20) : 0;
  return {total:(net + vat) / 100, vat:vat / 100, delivery:destination === 'GB' ? 0 : null};
}
module.exports = {deliveryPricing};
