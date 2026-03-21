/* ═══════════════════════════════════════════════════
   VRS Backend — Express Server Entry Point
   Trust, Validation & Anti-Fraud System
   ═══════════════════════════════════════════════════ */

require('dotenv').config({ path: '.env.local' });
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Basic Rate Limiting (per IP) ──
const requestCounts = new Map();
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 100;

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  const timestamps = requestCounts.get(ip).filter(t => now - t < windowMs);
  timestamps.push(now);
  requestCounts.set(ip, timestamps);

  if (timestamps.length > maxRequests) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  next();
});

// ── Serve Static Frontend ──
app.use(express.static(path.join(__dirname, '..')));

// ── API Routes ──
const mechanicsRouter = require('./routes/mechanics');
const bookingsRouter = require('./routes/bookings');
const servicesRouter = require('./routes/services');
const reviewsRouter = require('./routes/reviews');
const adminRouter = require('./routes/admin');
const aiRouter = require('./routes/ai');

app.use('/api/mechanics', mechanicsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/ai', aiRouter);

// ── Health Check ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'VRS Emergency Repair API',
    version: '2.0.0',
    features: ['trust-system', 'validation', 'anti-fraud', 'admin-dashboard'],
    timestamp: new Date().toISOString()
  });
});

// ── Catch-all (serve frontend) ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── Error Handler ──
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start Server ──
app.listen(PORT, () => {
  console.log(`\n⚡ VRS Emergency Repair Server v2.0`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api/health`);
  console.log(`🛡️  Trust & Validation System Active`);
  console.log(`🕐 Started at ${new Date().toLocaleString()}\n`);
});
