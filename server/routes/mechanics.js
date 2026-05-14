/* ===================================================
   VRS API - Mechanics Routes
   Trust & Verification System
   =================================================== */

const express = require('express');
const router = express.Router();
const { calculateTrustScore } = require('../middleware/validation');

const db = require('../db');



/**
 * GET /api/mechanics/nearby
 * Query params: lat, lng, radius (km, default 10), includeUnverified (default false)
 * Only returns VERIFIED mechanics by default
 */
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 10, includeUnverified = 'false' } = req.query;
    const userLat = parseFloat(lat) || 18.5204;
    const userLng = parseFloat(lng) || 73.8567;
    const maxRadius = parseFloat(radius);
    const showUnverified = includeUnverified === 'true';

    const query = showUnverified
      ? 'SELECT * FROM mechanics WHERE is_available = TRUE'
      : 'SELECT * FROM mechanics WHERE is_available = TRUE AND verified = TRUE';
    const mechanics = await db.query(query);

    // Filter: only available + verified (unless includeUnverified)
    const results = mechanics
      .filter(m => m.is_available && (showUnverified || m.verified))
      .map(m => {
        // MySQL DECIMAL returns strings — convert to numbers
        const mechLat = parseFloat(m.latitude) || userLat;
        const mechLng = parseFloat(m.longitude) || userLng;
        const dist = haversineDistance(userLat, userLng, mechLat, mechLng);
        const trustScore = m.trust_score || calculateTrustScore(m.rating, m.completed_bookings, m.verified);
        return {
          ...m,
          latitude: mechLat,
          longitude: mechLng,
          rating: parseFloat(m.rating) || 0,
          distance: Math.round(dist * 100) / 100,
          eta: Math.max(Math.round((dist / 30) * 60), 1),
          trust_score: trustScore
        };
      })
      .filter(m => m.distance <= maxRadius)
      .sort((a, b) => a.distance - b.distance);

    res.json({ success: true, count: results.length, mechanics: results });
  } catch (err) {
    console.error('Error fetching mechanics:', err);
    res.status(500).json({ error: 'Failed to fetch nearby mechanics', details: err.message, stack: err.stack });
  }
});

/**
 * GET /api/mechanics/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const results = await db.query('SELECT * FROM mechanics WHERE id = ?', [id]);

    if (results.length === 0) {
      return res.status(404).json({ error: 'Mechanic not found' });
    }

    let mechanic = results[0];

    // Calculate trust score if missing
    if (!mechanic.trust_score) {
      mechanic.trust_score = calculateTrustScore(mechanic.rating, mechanic.completed_bookings, mechanic.verified);
    }

    res.json({ success: true, mechanic });
  } catch (err) {
    console.error('Error fetching mechanic:', err);
    res.status(500).json({ error: 'Failed to fetch mechanic' });
  }
});

// Haversine helper
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;
