const express = require('express');
const path = require('path');
const Stripe = require('stripe');
const bodyParser = require('body-parser');

// Ensure STRIPE_SECRET_KEY is set in environment
const stripeKey = process.env.STRIPE_SECRET_KEY;
if(!stripeKey){
  console.warn('Warning: STRIPE_SECRET_KEY is not set. Checkout will fail until you set it.');
}
const stripe = Stripe(stripeKey || '');

const app = express();
app.use(bodyParser.json());

// Serve static files (the calculator)
app.use(express.static(path.join(__dirname)));

app.post('/create-checkout-session', async (req, res) => {
  try{
    const { amount, productName, quantity } = req.body;
    if(!amount || !productName) return res.status(400).json({ error: 'Missing amount or productName' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: { name: productName },
            unit_amount: Math.round(amount) // amount in cents
          },
          quantity: quantity || 1
        }
      ],
      mode: 'payment',
      success_url: req.body.success_url || `${req.protocol}://${req.get('host')}/?success=1`,
      cancel_url: req.body.cancel_url || `${req.protocol}://${req.get('host')}/?canceled=1`
    });

    res.json({ url: session.url });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 4242;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
