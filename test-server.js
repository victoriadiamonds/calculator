const { spawn } = require('child_process');

console.log('Starting server...');
const server = spawn('node', ['server.js'], { 
  cwd: __dirname,
  stdio: ['ignore', 'pipe', 'pipe']
});

server.stdout.on('data', (data) => {
  console.log('[SERVER STDOUT]:', data.toString().trim());
});

server.stderr.on('data', (data) => {
  console.log('[SERVER STDERR]:', data.toString().trim());
});

server.on('error', (err) => {
  console.error('[SERVER ERROR]:', err);
});

server.on('close', (code) => {
  console.log('[SERVER CLOSED]:', code);
});

// Wait for server to start
setTimeout(async () => {
  console.log('\n--- Testing /create-payment-intent ---');
  try {
    const response = await fetch('http://localhost:3000/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: 'ds_s_solenne',
        collection: 'dailySparkle',
        typeFilter: 'all',
        metal: 'gold',
        karat: 18,
        purity: 999,
        diamonds: [
          { quality: 'select', carat: '1.00', qty: 1 },
          { quality: 'select', carat: '0', qty: 1 },
          { quality: 'select', carat: '0', qty: 1 },
          { quality: 'select', carat: '0', qty: 1 }
        ],
        quantity: 1,
        discount: 0,
        profit: 0,
        designFee: 0,
        customerName: 'Test User',
        customerEmail: 'test@example.com'
      })
    });
    
    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', text);
    
    if (response.ok) {
      console.log('SUCCESS!');
    } else {
      console.log('FAILED!');
    }
  } catch (err) {
    console.error('Test error:', err.message);
  }
  
  // Give time to see logs
  setTimeout(() => {
    server.kill();
    process.exit(0);
  }, 2000);
}, 3000);

// Timeout safety
setTimeout(() => {
  console.log('Overall timeout - killing server');
  server.kill();
  process.exit(1);
}, 20000);