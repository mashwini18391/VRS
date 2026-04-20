/* ===================================================
   VRS API - Services Routes
   Dynamic Pricing & Availability
   =================================================== */

const express = require('express');
const router = express.Router();

const db = require('../db');

// Fallback data when DB is missing
const mockServices = [
  { id: 1, name: 'Flat Tire Repair', category: 'tire', base_price: 500.00, description: 'Puncture repair or spare tire mounting', estimated_time_minutes: 30, is_active: true },
  { id: 2, name: 'Tire Replacement', category: 'tire', base_price: 3500.00, description: 'New tire fitting and balancing', estimated_time_minutes: 45, is_active: true },
  { id: 3, name: 'Battery Jump Start', category: 'battery', base_price: 800.00, description: 'Battery jump start with portable booster', estimated_time_minutes: 20, is_active: true },
  { id: 4, name: 'Battery Replacement', category: 'battery', base_price: 4500.00, description: 'Old battery removal and new battery installation', estimated_time_minutes: 30, is_active: true },
  { id: 5, name: 'Engine Diagnosis', category: 'engine', base_price: 1500.00, description: 'OBD-II scan and engine fault diagnosis', estimated_time_minutes: 60, is_active: true }
];

/**
 * GET /api/services — List all services
 * Optional query: category
 */
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    
    let queryArgs = [];
    let sql = 'SELECT * FROM services WHERE is_active = TRUE';
    
    if (category) {
      sql += ' AND category = ?';
      queryArgs.push(category);
    }

    let services = [];
    try {
      services = await db.query(sql, queryArgs);
    } catch (dbErr) {
      console.warn('DB error, using fallback services:', dbErr.message);
      services = category ? mockServices.filter(s => s.category === category) : mockServices;
    }

    // Group by category
    const grouped = services.reduce((acc, s) => {
      if (!acc[s.category]) acc[s.category] = [];
      acc[s.category].push(s);
      return acc;
    }, {});

    res.json({
      success: true,
      count: services.length,
      services,
      categories: grouped
    });
  } catch (err) {
    console.error('Error fetching services:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

/**
 * GET /api/services/:id — Get service detail with pricing
 */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    let services = [];
    try {
      services = await db.query('SELECT * FROM services WHERE id = ? AND is_active = TRUE', [id]);
    } catch (dbErr) {
      console.warn('DB error, using fallback service:', dbErr.message);
      const s = mockServices.find(s => s.id === id);
      if (s) services = [s];
    }
    
    if (services.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const service = services[0];

    // Add pricing breakdown
    const visitFee = 200;
    // Base price in DB is string/decimal, need to parse
    const basePrice = parseFloat(service.base_price);
    const pricing = {
      service_charge: basePrice,
      visit_fee: visitFee,
      gst: Math.round((basePrice + visitFee) * 0.18),
      total: Math.round((basePrice + visitFee) * 1.18)
    };

    res.json({ success: true, service: { ...service, pricing } });
  } catch (err) {
    console.error('Error fetching service:', err);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

module.exports = router;
