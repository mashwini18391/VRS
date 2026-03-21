/* ═══════════════════════════════════════════════════
   VRS API — Services & Pricing Routes
   ═══════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();

// Services catalog with pricing
const SERVICES = [
  { id: 1, name: 'Flat Tire Repair', category: 'tire', base_price: 500, description: 'Puncture repair or spare tire mounting', estimated_time_minutes: 30 },
  { id: 2, name: 'Tire Replacement', category: 'tire', base_price: 3500, description: 'New tire fitting and balancing', estimated_time_minutes: 45 },
  { id: 3, name: 'Battery Jump Start', category: 'battery', base_price: 800, description: 'Battery jump start with portable booster', estimated_time_minutes: 20 },
  { id: 4, name: 'Battery Replacement', category: 'battery', base_price: 4500, description: 'Old battery removal and new battery installation', estimated_time_minutes: 30 },
  { id: 5, name: 'Engine Diagnosis', category: 'engine', base_price: 1500, description: 'OBD-II scan and engine fault diagnosis', estimated_time_minutes: 60 },
  { id: 6, name: 'Engine Oil Change', category: 'engine', base_price: 1200, description: 'Complete engine oil and filter change', estimated_time_minutes: 45 },
  { id: 7, name: 'Brake Pad Replacement', category: 'brake', base_price: 2500, description: 'Front or rear brake pad replacement', estimated_time_minutes: 90 },
  { id: 8, name: 'Brake Fluid Refill', category: 'brake', base_price: 600, description: 'Brake fluid top-up and bleeding', estimated_time_minutes: 30 },
  { id: 9, name: 'Emergency Fuel Delivery', category: 'fuel', base_price: 600, description: '5L emergency fuel delivery', estimated_time_minutes: 25 },
  { id: 10, name: 'Towing Service', category: 'other', base_price: 2000, description: 'Vehicle towing up to 20km', estimated_time_minutes: 45 },
  { id: 11, name: 'AC Gas Refill', category: 'other', base_price: 1800, description: 'AC refrigerant recharge', estimated_time_minutes: 40 },
  { id: 12, name: 'Coolant Refill', category: 'other', base_price: 500, description: 'Engine coolant top-up', estimated_time_minutes: 15 },
  { id: 13, name: 'Spark Plug Replacement', category: 'engine', base_price: 800, description: 'Spark plug inspection and replacement', estimated_time_minutes: 30 },
  { id: 14, name: 'Headlight/Taillight Fix', category: 'other', base_price: 400, description: 'Bulb replacement for headlights or taillights', estimated_time_minutes: 20 },
];

/**
 * GET /api/services — List all services
 * Optional query: category
 */
router.get('/', (req, res) => {
  try {
    const { category } = req.query;
    let services = [...SERVICES];

    if (category) {
      services = services.filter(s => s.category === category);
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
router.get('/:id', (req, res) => {
  try {
    const service = SERVICES.find(s => s.id === parseInt(req.params.id));

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Add pricing breakdown
    const visitFee = 200;
    const pricing = {
      service_charge: service.base_price,
      visit_fee: visitFee,
      gst: Math.round((service.base_price + visitFee) * 0.18),
      total: Math.round((service.base_price + visitFee) * 1.18)
    };

    res.json({ success: true, service: { ...service, pricing } });
  } catch (err) {
    console.error('Error fetching service:', err);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

module.exports = router;
