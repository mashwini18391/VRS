/* ===================================================
   VRS API - Bookings Routes
   Booking Validation & State Transition System
   =================================================== */

const express = require('express');
const router = express.Router();
const { verifyAuth, optionalAuth } = require('../middleware/auth');
const { isValidStatusTransition, validateCoordinates, sanitizeInput } = require('../middleware/validation');
const db = require('../db');

const VISIT_FEE = 200;

/**
 * POST /api/bookings — Create a new booking
 */
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { vehicle_type, issue_type, issue_description, mechanic_id, service_id, latitude, longitude, is_emergency } = req.body;

    if (!vehicle_type || !mechanic_id) {
      return res.status(400).json({ error: 'Missing required fields: vehicle_type, mechanic_id' });
    }

    const lat = parseFloat(latitude) || 18.5204;
    const lng = parseFloat(longitude) || 73.8567;

    if (!validateCoordinates(lat, lng)) {
      return res.status(400).json({ error: 'Invalid GPS coordinates. Location must be from device GPS.' });
    }

    let totalPrice = null;
    let sid = parseInt(service_id);
    if (isNaN(sid)) sid = null;
    
    try {
      if (sid) {
        const services = await db.query('SELECT base_price FROM services WHERE id = ?', [sid]);
        if (services.length > 0) {
          const basePrice = parseFloat(services[0].base_price);
          totalPrice = Math.round((basePrice + VISIT_FEE) * 1.18);
        }
      }
    } catch (dbErr) {
      console.warn('DB error when fetching service pricing:', dbErr.message);
      totalPrice = 1180; // Fallback estimate
    }

    const safeDescription = sanitizeInput(issue_description || '');
    const bookingId = 'BK' + Date.now().toString(36).toUpperCase();
    const userId = req.userId || 'anonymous';
    const emergencyFlag = is_emergency || false;
    const initialStatus = emergencyFlag ? 'accepted' : 'pending';

    let bookingRecord = {
      id: bookingId,
      user_id: userId,
      mechanic_id: parseInt(mechanic_id),
      service_id: sid,
      status: initialStatus,
      vehicle_type: sanitizeInput(vehicle_type),
      issue_description: safeDescription,
      latitude: lat,
      longitude: lng,
      total_price: totalPrice,
      is_emergency: emergencyFlag,
      created_at: new Date().toISOString()
    };

    await db.query(
      `INSERT INTO bookings 
      (id, user_id, mechanic_id, service_id, status, vehicle_type, issue_description, latitude, longitude, total_price, is_emergency) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [bookingId, userId, parseInt(mechanic_id), sid, initialStatus, sanitizeInput(vehicle_type), safeDescription, lat, lng, totalPrice, emergencyFlag]
    );

    const newBooking = await db.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (newBooking.length > 0) bookingRecord = newBooking[0];

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking: bookingRecord
    });
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

/**
 * GET /api/bookings/all — Get all bookings (for Garage Owner dashboard)
 */
router.get('/all', optionalAuth, async (req, res) => {
  try {
    const query = `
      SELECT b.*, m.name AS mechanic_name, s.name AS service_name 
      FROM bookings b
      LEFT JOIN mechanics m ON b.mechanic_id = m.id
      LEFT JOIN services s ON b.service_id = s.id
      ORDER BY b.created_at DESC
    `;
    const allBookings = await db.query(query, []);

    res.json({ success: true, count: allBookings.length, bookings: allBookings });
  } catch (err) {
    console.error('Error fetching all bookings:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * GET /api/bookings/user/:userId — Get user's bookings
 */
router.get('/user/:userId', optionalAuth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const query = `
      SELECT b.*, m.name AS mechanic_name, s.name AS service_name 
      FROM bookings b
      LEFT JOIN mechanics m ON b.mechanic_id = m.id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.user_id = ? 
      ORDER BY b.created_at DESC
    `;
    const userBookings = await db.query(query, [userId]);

    res.json({ success: true, count: userBookings.length, bookings: userBookings });
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * GET /api/bookings/:id — Get booking detail
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const bookings = await db.query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);

    if (bookings.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ success: true, booking: bookings[0] });
  } catch (err) {
    console.error('Error fetching booking:', err);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

/**
 * PATCH /api/bookings/:id/status — Update booking status
 */
router.patch('/:id/status', optionalAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'accepted', 'rejected', 'in_progress', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    let booking = { id: req.params.id, status: 'pending' };
    const bookings = await db.query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (bookings.length > 0) booking = bookings[0];

    if (!isValidStatusTransition(booking.status, status)) {
      return res.status(400).json({
        error: `Invalid status transition: "${booking.status}" → "${status}" is not allowed.`,
        allowed: getNextStatuses(booking.status)
      });
    }
    
    const isCompleted = status === 'completed';
    if (isCompleted) {
        await db.query('UPDATE bookings SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?', [status, req.params.id]);
    } else {
        await db.query('UPDATE bookings SET status = ? WHERE id = ?', [status, req.params.id]);
    }

    const updated = await db.query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (updated.length > 0) booking = updated[0];

    res.json({
      success: true,
      message: `Booking status updated to ${status}`,
      booking: booking
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
    'pending':     ['accepted', 'rejected', 'cancelled'],
    'accepted':    ['in_progress', 'cancelled'],
    'in_progress': ['completed', 'cancelled'],
    'completed':   [],
    'cancelled':   [],
    'rejected':    []
  };
  return transitions[current] || [];
}

module.exports = router;
