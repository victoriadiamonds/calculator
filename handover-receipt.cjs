/* Staff-only offline receipt for verified payments collected separately at handover.
   Accept amounts in GBP, and ISO calendar dates. Keep the input and PDF private. */
const fs = require('node:fs');
const { generateReceiptPDF } = require('./server');
const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw Error('Usage: node handover-receipt.cjs verified-order.json final-receipt.pdf');
const order = JSON.parse(fs.readFileSync(source, 'utf8'));
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const cents = value => Math.round(value * 100);
if (!validDate(order.handoverDate) || !order.merchantOrderId || !order.customerName || !order.product?.name ||
    !Number.isFinite(order.fullAmount) || order.fullAmount <= 0 || !Array.isArray(order.payments) ||
    !order.payments.length || order.payments.length > 2) throw Error('Missing verified order, handover or payment details.');
const references = new Set();
for (const entry of order.payments) {
  if (!entry.reference || references.has(entry.reference) || !validDate(entry.date) || !Number.isFinite(entry.amount) ||
      entry.amount <= 0 || entry.amount !== cents(entry.amount)/100) throw Error('Invalid or duplicate payment record.');
  references.add(entry.reference);
}
if (order.payments.reduce((total,p) => total+cents(p.amount),0) !== cents(order.fullAmount)) throw Error('Confirmed payments must settle the full order.');
const output = fs.createWriteStream(destination, { flags: 'wx' });
output.setHeader = () => {};
generateReceiptPDF({...order, amount:order.fullAmount, isDeposit:false, status:'PAID',
  paymentPercentage:100, updatedAt:order.payments.map(p=>p.date).sort().at(-1),
  settlementPayments:order.payments.length===2?order.payments.map((p,i)=>({label:i?'Balance payment':'Deposit payment',amount:p.amount})):null},output,true);
