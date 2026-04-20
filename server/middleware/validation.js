/* ═══════════════════════════════════════════════════
   VRS Middleware — Validation & Sanitization
   ═══════════════════════════════════════════════════ */

/**
 * Validate GPS coordinates
 */
function validateCoordinates(lat, lng) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (isNaN(latitude) || isNaN(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;

  return true;
}

/**
 * Validate location jump — reject if distance > maxKm
 * Prevents spoofed teleportation of mechanic location
 */
function validateLocationJump(prevLat, prevLng, newLat, newLng, maxKm = 50) {
  const R = 6371;
  const dLat = (newLat - prevLat) * Math.PI / 180;
  const dLng = (newLng - prevLng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(prevLat * Math.PI / 180) * Math.cos(newLat * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return distance <= maxKm;
}

/**
 * Sanitize string input — strip HTML/script tags
 */
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/**
 * Validate booking status transitions
 * Returns true if the transition is allowed
 */
function isValidStatusTransition(currentStatus, newStatus) {
  const transitions = {
    'pending':     ['accepted', 'cancelled'],
    'accepted':    ['in_progress', 'cancelled'],
    'in_progress': ['completed', 'cancelled'],
    'completed':   [],
    'cancelled':   []
  };

  const allowed = transitions[currentStatus];
  if (!allowed) return false;
  return allowed.includes(newStatus);
}

/**
 * Calculate trust score for a mechanic
 * Formula: (rating × 2) + min(completed_bookings × 0.1, 4) + (verified ? 2 : 0)
 * Capped at 10.0
 */
function calculateTrustScore(rating, completedBookings, verified) {
  const ratingComponent = (parseFloat(rating) || 0) * 2;
  const bookingComponent = Math.min((parseInt(completedBookings) || 0) * 0.1, 4);
  const verifiedComponent = verified ? 2 : 0;

  const score = ratingComponent + bookingComponent + verifiedComponent;
  return Math.min(Math.round(score * 10) / 10, 10.0);
}

/**
 * Middleware: Validate coordinates in request body
 */
function requireValidCoordinates(req, res, next) {
  const { latitude, longitude } = req.body;

  if (latitude !== undefined || longitude !== undefined) {
    if (!validateCoordinates(latitude, longitude)) {
      return res.status(400).json({
        error: 'Invalid coordinates. Latitude must be -90 to 90, longitude must be -180 to 180.'
      });
    }
  }

  next();
}

module.exports = {
  validateCoordinates,
  validateLocationJump,
  sanitizeInput,
  isValidStatusTransition,
  calculateTrustScore,
  requireValidCoordinates
};
