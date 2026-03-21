/* ═══════════════════════════════════════════════════
   VRS API — Admin Dashboard Routes
   ═══════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middleware/auth');
const { sanitizeInput, calculateTrustScore } = require('../middleware/validation');

// ── In-memory data (fallback when MySQL not connected) ──
let adminMechanics = [
  { id: 1, name: 'Rajesh Kumar', phone: '+91-9876543210', specialization: 'Engine Specialist', rating: 4.8, total_reviews: 156, completed_bookings: 180, verified: true, trust_score: 9.6, is_available: true },
  { id: 2, name: 'Priya Patel', phone: '+91-9876543211', specialization: 'Electrical & Battery', rating: 4.6, total_reviews: 89, completed_bookings: 102, verified: true, trust_score: 8.4, is_available: true },
  { id: 3, name: 'Ajay Singh', phone: '+91-9876543212', specialization: 'Tire & Suspension', rating: 4.9, total_reviews: 234, completed_bookings: 260, verified: true, trust_score: 10.0, is_available: true },
  { id: 4, name: 'Sneha Deshmukh', phone: '+91-9876543213', specialization: 'General Mechanic', rating: 4.5, total_reviews: 67, completed_bookings: 75, verified: false, trust_score: 5.2, is_available: false },
  { id: 5, name: 'Rahul Mehta', phone: '+91-9876543214', specialization: 'AC & Cooling', rating: 4.7, total_reviews: 112, completed_bookings: 130, verified: true, trust_score: 9.0, is_available: true },
  { id: 6, name: 'Amit Verma', phone: '+91-9876543215', specialization: 'Brake Specialist', rating: 4.4, total_reviews: 45, completed_bookings: 50, verified: false, trust_score: 4.5, is_available: true },
];

let adminReviews = [
  { id: 1, booking_id: 'BK001', user_id: 'demo-user-123', mechanic_id: 3, mechanic_name: 'Ajay Singh', rating: 5, comment: 'Excellent service! Fixed the tire in 20 minutes.', is_flagged: false, created_at: '2026-03-18T11:30:00Z' },
  { id: 2, booking_id: 'BK002', user_id: 'demo-user-123', mechanic_id: 2, mechanic_name: 'Priya Patel', rating: 4, comment: 'Quick response, got my car running again.', is_flagged: false, created_at: '2026-03-15T15:00:00Z' },
  { id: 3, booking_id: 'BK003', user_id: 'demo-user-123', mechanic_id: 1, mechanic_name: 'Rajesh Kumar', rating: 5, comment: 'Very knowledgeable, fixed the issue permanently.', is_flagged: false, created_at: '2026-03-10T11:00:00Z' },
];

let adminBookings = [
  { id: 'BK001', user_id: 'demo-user-123', mechanic_id: 3, mechanic_name: 'Ajay Singh', service: 'Flat Tire Repair', status: 'completed', total_price: 1200, created_at: '2026-03-18T10:30:00Z', is_suspicious: false },
  { id: 'BK002', user_id: 'demo-user-123', mechanic_id: 2, mechanic_name: 'Priya Patel', service: 'Battery Jump Start', status: 'completed', total_price: 800, created_at: '2026-03-15T14:15:00Z', is_suspicious: false },
  { id: 'BK003', user_id: 'demo-user-123', mechanic_id: 1, mechanic_name: 'Rajesh Kumar', service: 'Engine Diagnosis', status: 'completed', total_price: 3500, created_at: '2026-03-10T09:00:00Z', is_suspicious: false },
];

let auditLog = [];

/**
 * GET /api/admin/stats — Dashboard statistics
 */
router.get('/stats', (req, res) => {
  try {
    const totalMechanics = adminMechanics.length;
    const verifiedMechanics = adminMechanics.filter(m => m.verified).length;
    const pendingApprovals = adminMechanics.filter(m => !m.verified).length;
    const totalReviews = adminReviews.length;
    const flaggedReviews = adminReviews.filter(r => r.is_flagged).length;
    const totalBookings = adminBookings.length;
    const activeBookings = adminBookings.filter(b => !['completed', 'cancelled'].includes(b.status)).length;
    const suspiciousBookings = adminBookings.filter(b => b.is_suspicious).length;

    res.json({
      success: true,
      stats: {
        totalMechanics,
        verifiedMechanics,
        pendingApprovals,
        totalReviews,
        flaggedReviews,
        totalBookings,
        activeBookings,
        suspiciousBookings
      }
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/admin/mechanics — List all mechanics with verification status
 */
router.get('/mechanics', (req, res) => {
  try {
    const { filter } = req.query; // 'all', 'verified', 'pending'

    let mechanics = [...adminMechanics];

    if (filter === 'verified') {
      mechanics = mechanics.filter(m => m.verified);
    } else if (filter === 'pending') {
      mechanics = mechanics.filter(m => !m.verified);
    }

    res.json({ success: true, count: mechanics.length, mechanics });
  } catch (err) {
    console.error('Error fetching mechanics:', err);
    res.status(500).json({ error: 'Failed to fetch mechanics' });
  }
});

/**
 * PATCH /api/admin/mechanics/:id/verify — Approve a mechanic
 */
router.patch('/mechanics/:id/verify', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const mechanic = adminMechanics.find(m => m.id === id);

    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic not found' });
    }

    mechanic.verified = true;
    mechanic.trust_score = calculateTrustScore(mechanic.rating, mechanic.completed_bookings, true);

    // Log admin action
    auditLog.push({
      id: auditLog.length + 1,
      admin_id: req.userId || 'admin',
      action_type: 'approve_mechanic',
      target_id: String(id),
      reason: req.body.reason || 'Approved by admin',
      created_at: new Date().toISOString()
    });

    res.json({ success: true, message: `${mechanic.name} has been verified`, mechanic });
  } catch (err) {
    console.error('Error verifying mechanic:', err);
    res.status(500).json({ error: 'Failed to verify mechanic' });
  }
});

/**
 * PATCH /api/admin/mechanics/:id/reject — Reject a mechanic
 */
router.patch('/mechanics/:id/reject', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const mechanic = adminMechanics.find(m => m.id === id);

    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic not found' });
    }

    mechanic.verified = false;
    mechanic.trust_score = calculateTrustScore(mechanic.rating, mechanic.completed_bookings, false);

    auditLog.push({
      id: auditLog.length + 1,
      admin_id: req.userId || 'admin',
      action_type: 'reject_mechanic',
      target_id: String(id),
      reason: req.body.reason || 'Rejected by admin',
      created_at: new Date().toISOString()
    });

    res.json({ success: true, message: `${mechanic.name} verification removed`, mechanic });
  } catch (err) {
    console.error('Error rejecting mechanic:', err);
    res.status(500).json({ error: 'Failed to reject mechanic' });
  }
});

/**
 * GET /api/admin/reviews — List all reviews
 */
router.get('/reviews', (req, res) => {
  try {
    const { filter } = req.query; // 'all', 'flagged'

    let reviews = [...adminReviews];

    if (filter === 'flagged') {
      reviews = reviews.filter(r => r.is_flagged);
    }

    res.json({ success: true, count: reviews.length, reviews });
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

/**
 * DELETE /api/admin/reviews/:id — Remove a fake/spam review
 */
router.delete('/reviews/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const index = adminReviews.findIndex(r => r.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const removed = adminReviews.splice(index, 1)[0];

    auditLog.push({
      id: auditLog.length + 1,
      admin_id: req.userId || 'admin',
      action_type: 'remove_review',
      target_id: String(id),
      reason: req.body.reason || 'Removed by admin',
      created_at: new Date().toISOString()
    });

    res.json({ success: true, message: 'Review removed', review: removed });
  } catch (err) {
    console.error('Error removing review:', err);
    res.status(500).json({ error: 'Failed to remove review' });
  }
});

/**
 * PATCH /api/admin/reviews/:id/flag — Flag a review for investigation
 */
router.patch('/reviews/:id/flag', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const review = adminReviews.find(r => r.id === id);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    review.is_flagged = !review.is_flagged;

    res.json({ success: true, message: review.is_flagged ? 'Review flagged' : 'Review unflagged', review });
  } catch (err) {
    console.error('Error flagging review:', err);
    res.status(500).json({ error: 'Failed to flag review' });
  }
});

/**
 * GET /api/admin/bookings — List bookings for monitoring
 */
router.get('/bookings', (req, res) => {
  try {
    const { filter } = req.query; // 'all', 'active', 'suspicious'

    let bookings = [...adminBookings];

    if (filter === 'active') {
      bookings = bookings.filter(b => !['completed', 'cancelled'].includes(b.status));
    } else if (filter === 'suspicious') {
      bookings = bookings.filter(b => b.is_suspicious);
    }

    res.json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * GET /api/admin/audit-log — Get admin action audit log
 */
router.get('/audit-log', (req, res) => {
  try {
    res.json({
      success: true,
      count: auditLog.length,
      actions: auditLog.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    });
  } catch (err) {
    console.error('Error fetching audit log:', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

module.exports = router;
