function deliveryPricing(subtotal, destination) {
  if (destination !== undefined && !['GB', 'international'].includes(destination)) {
    throw new Error('Choose a delivery destination.');
  }
  const net = Math.round(subtotal * 100);
  const adjustment = Math.round(net * 0.20);
  return {total:(net + adjustment) / 100, vat:destination === 'GB' ? adjustment / 100 : 0, delivery:destination === 'GB' ? 0 : null};
}
module.exports = {deliveryPricing};
