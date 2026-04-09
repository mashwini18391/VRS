/* ===================================================
   VRS API - Reviews Routes
   Feedback & Reputation Management
   =================================================== */

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { sanitizeInput } = require('../middleware/validation');
const db = require('../db');

/**
 * POST /api/reviews — Submit a review
 */
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { booking_id, mechanic_id, rating, comment } = req.body;
    const userId = req.userId || 'anonymous';

    if (!booking_id || !mechanic_id || !rating) {
      return res.status(400).json({ error: 'Missing required fields: booking_id, mechanic_id, rating' });
    }

    const ratingNum = parseInt(rating);
    if (ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const bookings = await db.query('SELECT * FROM bookings WHERE id = ?', [booking_id]);

    if (bookings.length === 0) {
      return res.status(400).json({
        error: 'Cannot submit review: No completed booking found with this ID.',
        hint: 'Reviews can only be submitted for completed bookings.'
      });
    }

    const booking = bookings[0];

    if (booking.status !== 'completed') {
      return res.status(400).json({
        error: 'Cannot submit review: This booking is not yet completed.',
        hint: 'Please wait until the service is finished before reviewing.'
      });
    }

    if (booking.user_id !== userId && userId !== 'anonymous') {
      return res.status(403).json({
        error: 'Cannot submit review: This booking does not belong to you.'
      });
    }

    if (booking.mechanic_id !== parseInt(mechanic_id)) {
      return res.status(400).json({
        error: 'Cannot submit review: Mechanic ID does not match the booking.'
      });
    }

    // Duplicate review check by booking_id
    const existingByBooking = await db.query('SELECT id FROM reviews WHERE booking_id = ?', [booking_id]);
    if (existingByBooking.length > 0) {
      return res.status(409).json({ error: 'A review already exists for this booking.' });
    }

    // Duplicate review check by user and mechanic
    const existingByUserMechanic = await db.query('SELECT id FROM reviews WHERE user_id = ? AND mechanic_id = ?', [userId, parseInt(mechanic_id)]);
    if (existingByUserMechanic.length > 0) {
      return res.status(409).json({
        error: 'You have already reviewed this mechanic.',
        hint: 'Only one review per mechanic is allowed.'
      });
    }

    const safeComment = sanitizeInput(comment || '');

    const result = await db.query(
      'INSERT INTO reviews (booking_id, user_id, mechanic_id, rating, comment, is_flagged) VALUES (?, ?, ?, ?, ?, FALSE)',
      [booking_id, userId, parseInt(mechanic_id), ratingNum, safeComment]
    );

    const newReview = await db.query('SELECT * FROM reviews WHERE id = ?', [result.insertId]);

    res.status(201).json({ success: true, message: 'Review submitted successfully', review: newReview[0] });
  } catch (err) {
    console.error('Error submitting review:', err);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

/**
 * GET /api/reviews/mechanic/:id — Get reviews for a mechanic
 */
router.get('/mechanic/:id', async (req, res) => {
  try {
    const mechanicId = parseInt(req.params.id);
    const mechanicReviews = await db.query('SELECT * FROM reviews WHERE mechanic_id = ? AND is_flagged = FALSE ORDER BY created_at DESC', [mechanicId]);

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
router.get('/user/:userId', async (req, res) => {
  try {
    const userReviews = await db.query('SELECT * FROM reviews WHERE user_id = ? ORDER BY created_at DESC', [req.params.userId]);

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
router.get('/check/:bookingId', optionalAuth, async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    
    const bookings = await db.query('SELECT status FROM bookings WHERE id = ?', [bookingId]);
    const booking = bookings.length > 0 ? bookings[0] : null;

    const existingReviews = await db.query('SELECT id FROM reviews WHERE booking_id = ?', [bookingId]);
    const existingReview = existingReviews.length > 0;

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
