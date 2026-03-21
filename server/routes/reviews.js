/* ═══════════════════════════════════════════════════
   VRS API — Reviews & Ratings Routes
   Authentic Reviews System
   ═══════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { sanitizeInput } = require('../middleware/validation');

// In-memory bookings reference for review validation
const COMPLETED_BOOKINGS = {
  'BK001': { user_id: 'demo-user-123', mechanic_id: 3, status: 'completed' },
  'BK002': { user_id: 'demo-user-123', mechanic_id: 2, status: 'completed' },
  'BK003': { user_id: 'demo-user-123', mechanic_id: 1, status: 'completed' },
};

// In-memory reviews store
let reviews = [
  { id: 1, booking_id: 'BK001', user_id: 'demo-user-123', mechanic_id: 3, rating: 5, comment: 'Excellent service! Fixed the tire in 20 minutes.', is_flagged: false, created_at: '2026-03-18T11:30:00Z' },
  { id: 2, booking_id: 'BK002', user_id: 'demo-user-123', mechanic_id: 2, rating: 4, comment: 'Quick response, got my car running again.', is_flagged: false, created_at: '2026-03-15T15:00:00Z' },
  { id: 3, booking_id: 'BK003', user_id: 'demo-user-123', mechanic_id: 1, rating: 5, comment: 'Very knowledgeable, fixed the issue permanently.', is_flagged: false, created_at: '2026-03-10T11:00:00Z' },
  { id: 4, booking_id: 'BK-EXT-001', user_id: 'user-456', mechanic_id: 1, rating: 4, comment: 'Good service, slight delay but overall satisfied.', is_flagged: false, created_at: '2026-03-08T16:00:00Z' },
  { id: 5, booking_id: 'BK-EXT-002', user_id: 'user-789', mechanic_id: 3, rating: 5, comment: 'Best mechanic in the area! Highly recommended.', is_flagged: false, created_at: '2026-03-05T09:00:00Z' },
];

/**
 * POST /api/reviews — Submit a review
 * Validates: booking exists + completed, one review per user per mechanic
 */
router.post('/', optionalAuth, (req, res) => {
  try {
    const { booking_id, mechanic_id, rating, comment } = req.body;
    const userId = req.userId || 'anonymous';

    // ── Validation 1: Required fields ──
    if (!booking_id || !mechanic_id || !rating) {
      return res.status(400).json({ error: 'Missing required fields: booking_id, mechanic_id, rating' });
    }

    // ── Validation 2: Rating range ──
    const ratingNum = parseInt(rating);
    if (ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // ── Validation 3: Booking exists and is completed ──
    const booking = COMPLETED_BOOKINGS[booking_id];
    if (!booking) {
      return res.status(400).json({
        error: 'Cannot submit review: No completed booking found with this ID.',
        hint: 'Reviews can only be submitted for completed bookings.'
      });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({
        error: 'Cannot submit review: This booking is not yet completed.',
        hint: 'Please wait until the service is finished before reviewing.'
      });
    }

    // ── Validation 4: Booking belongs to this user ──
    if (booking.user_id !== userId && userId !== 'anonymous') {
      return res.status(403).json({
        error: 'Cannot submit review: This booking does not belong to you.'
      });
    }

    // ── Validation 5: Mechanic matches booking ──
    if (booking.mechanic_id !== parseInt(mechanic_id)) {
      return res.status(400).json({
        error: 'Cannot submit review: Mechanic ID does not match the booking.'
      });
    }

    // ── Validation 6: Duplicate review check (booking_id unique) ──
    const existingByBooking = reviews.find(r => r.booking_id === booking_id);
    if (existingByBooking) {
      return res.status(409).json({ error: 'A review already exists for this booking.' });
    }

    // ── Validation 7: One review per user per mechanic ──
    const existingByUserMechanic = reviews.find(
      r => r.user_id === userId && r.mechanic_id === parseInt(mechanic_id)
    );
    if (existingByUserMechanic) {
      return res.status(409).json({
        error: 'You have already reviewed this mechanic.',
        hint: 'Only one review per mechanic is allowed.'
      });
    }

    // ── Create review ──
    const review = {
      id: reviews.length + 1,
      booking_id,
      user_id: userId,
      mechanic_id: parseInt(mechanic_id),
      rating: ratingNum,
      comment: sanitizeInput(comment || ''),
      is_flagged: false,
      created_at: new Date().toISOString()
    };

    reviews.push(review);

    res.status(201).json({ success: true, message: 'Review submitted successfully', review });
  } catch (err) {
    console.error('Error submitting review:', err);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

/**
 * GET /api/reviews/mechanic/:id — Get reviews for a mechanic
 */
router.get('/mechanic/:id', (req, res) => {
  try {
    const mechanicId = parseInt(req.params.id);
    const mechanicReviews = reviews
      .filter(r => r.mechanic_id === mechanicId && !r.is_flagged)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Calculate average rating (excluding flagged reviews)
    const avgRating = mechanicReviews.length > 0
      ? (mechanicReviews.reduce((sum, r) => sum + r.rating, 0) / mechanicReviews.length).toFixed(1)
      : 0;

    res.json({
      success: true,
      mechanic_id: mechanicId,
      average_rating: parseFloat(avgRating),
      total_reviews: mechanicReviews.length,
      reviews: mechanicReviews
    });
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

/**
 * GET /api/reviews/user/:userId — Get user's reviews
 */
router.get('/user/:userId', (req, res) => {
  try {
    const userReviews = reviews
      .filter(r => r.user_id === req.params.userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      success: true,
      count: userReviews.length,
      reviews: userReviews
    });
  } catch (err) {
    console.error('Error fetching user reviews:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

/**
 * GET /api/reviews/check/:bookingId — Check if a review can be submitted
 */
router.get('/check/:bookingId', optionalAuth, (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    const userId = req.userId || 'anonymous';

    const booking = COMPLETED_BOOKINGS[bookingId];
    const existingReview = reviews.find(r => r.booking_id === bookingId);

    res.json({
      success: true,
      canReview: !!booking && booking.status === 'completed' && !existingReview,
      reason: !booking ? 'Booking not found'
        : booking.status !== 'completed' ? 'Booking not completed'
        : existingReview ? 'Review already submitted'
        : 'Eligible for review'
    });
  } catch (err) {
    console.error('Error checking review eligibility:', err);
    res.status(500).json({ error: 'Failed to check review eligibility' });
  }
});

module.exports = router;
