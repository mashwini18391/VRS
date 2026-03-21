/* ═══════════════════════════════════════════════════
   VRS API — Bookings Routes
   Booking Validation & State Transition System
   ═══════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();
const { verifyAuth, optionalAuth } = require('../middleware/auth');
const { isValidStatusTransition, validateCoordinates, sanitizeInput } = require('../middleware/validation');

// Services lookup for fixed pricing
const SERVICES_PRICING = {
  1: { name: 'Flat Tire Repair', base_price: 500 },
  2: { name: 'Tire Replacement', base_price: 3500 },
  3: { name: 'Battery Jump Start', base_price: 800 },
  4: { name: 'Battery Replacement', base_price: 4500 },
  5: { name: 'Engine Diagnosis', base_price: 1500 },
  6: { name: 'Engine Oil Change', base_price: 1200 },
  7: { name: 'Brake Pad Replacement', base_price: 2500 },
  8: { name: 'Brake Fluid Refill', base_price: 600 },
  9: { name: 'Emergency Fuel Delivery', base_price: 600 },
  10: { name: 'Towing Service', base_price: 2000 },
  11: { name: 'AC Gas Refill', base_price: 1800 },
  12: { name: 'Coolant Refill', base_price: 500 },
  13: { name: 'Spark Plug Replacement', base_price: 800 },
  14: { name: 'Headlight/Taillight Fix', base_price: 400 },
};

const VISIT_FEE = 200;

// In-memory bookings store (Demo mode)
let bookings = [
  {
    id: 'BK001', user_id: 'demo-user-123', mechanic_id: 3, service_id: 1,
    status: 'completed', vehicle_type: 'car', issue_description: 'Flat tire on highway',
    latitude: 18.5204, longitude: 73.8567, total_price: 1200,
    created_at: '2026-03-18T10:30:00Z', completed_at: '2026-03-18T11:15:00Z'
  },
  {
    id: 'BK002', user_id: 'demo-user-123', mechanic_id: 2, service_id: 3,
    status: 'completed', vehicle_type: 'car', issue_description: 'Battery dead, car won\'t start',
    latitude: 18.5210, longitude: 73.8570, total_price: 800,
    created_at: '2026-03-15T14:15:00Z', completed_at: '2026-03-15T14:45:00Z'
  },
  {
    id: 'BK003', user_id: 'demo-user-123', mechanic_id: 1, service_id: 5,
    status: 'completed', vehicle_type: 'bike', issue_description: 'Engine overheating',
    latitude: 18.5190, longitude: 73.8555, total_price: 3500,
    created_at: '2026-03-10T09:00:00Z', completed_at: '2026-03-10T10:30:00Z'
  }
];

/**
 * POST /api/bookings — Create a new booking
 * Enforces fixed pricing from services table
 * Validates GPS coordinates
 */
router.post('/', optionalAuth, (req, res) => {
  try {
    const { vehicle_type, issue_type, issue_description, mechanic_id, service_id, latitude, longitude, is_emergency } = req.body;

    if (!vehicle_type || !mechanic_id) {
      return res.status(400).json({ error: 'Missing required fields: vehicle_type, mechanic_id' });
    }

    // Validate coordinates
    const lat = parseFloat(latitude) || 18.5204;
    const lng = parseFloat(longitude) || 73.8567;

    if (!validateCoordinates(lat, lng)) {
      return res.status(400).json({ error: 'Invalid GPS coordinates. Location must be from device GPS.' });
    }

    // Calculate fixed price from services table — no client-provided price accepted
    let totalPrice = null;
    const sid = parseInt(service_id);
    if (sid && SERVICES_PRICING[sid]) {
      const service = SERVICES_PRICING[sid];
      totalPrice = Math.round((service.base_price + VISIT_FEE) * 1.18); // base + visit + GST
    }

    // Sanitize text inputs
    const safeDescription = sanitizeInput(issue_description || '');

    const booking = {
      id: 'BK' + Date.now().toString(36).toUpperCase(),
      user_id: req.userId || 'anonymous',
      mechanic_id: parseInt(mechanic_id),
      service_id: sid || null,
      vehicle_type: sanitizeInput(vehicle_type),
      issue_type: sanitizeInput(issue_type || 'other'),
      issue_description: safeDescription,
      status: is_emergency ? 'accepted' : 'pending',
      latitude: lat,
      longitude: lng,
      total_price: totalPrice,
      created_at: new Date().toISOString(),
      completed_at: null
    };

    bookings.push(booking);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking
    });
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

/**
 * GET /api/bookings/user/:userId — Get user's bookings
 */
router.get('/user/:userId', optionalAuth, (req, res) => {
  try {
    const userId = req.params.userId;
    const userBookings = bookings
      .filter(b => b.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ success: true, count: userBookings.length, bookings: userBookings });
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * GET /api/bookings/:id — Get booking detail
 */
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const booking = bookings.find(b => b.id === req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ success: true, booking });
  } catch (err) {
    console.error('Error fetching booking:', err);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

/**
 * PATCH /api/bookings/:id/status — Update booking status
 * Enforces valid state transitions only
 */
router.patch('/:id/status', optionalAuth, (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const booking = bookings.find(b => b.id === req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Validate state transition
    if (!isValidStatusTransition(booking.status, status)) {
      return res.status(400).json({
        error: `Invalid status transition: "${booking.status}" → "${status}" is not allowed.`,
        allowed: getNextStatuses(booking.status)
      });
    }

    const previousStatus = booking.status;
    booking.status = status;

    if (status === 'completed') {
      booking.completed_at = new Date().toISOString();
    }

    res.json({
      success: true,
      message: `Booking status updated: ${previousStatus} → ${status}`,
      booking
    });
  } catch (err) {
    console.error('Error updating booking:', err);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

/**
 * Helper: Get allowed next statuses
 */
function getNextStatuses(current) {
  const transitions = {
    'pending':     ['accepted', 'cancelled'],
    'accepted':    ['in_progress', 'cancelled'],
    'in_progress': ['completed', 'cancelled'],
    'completed':   [],
    'cancelled':   []
  };
  return transitions[current] || [];
}

module.exports = router;
