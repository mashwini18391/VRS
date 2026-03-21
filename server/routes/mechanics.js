/* ═══════════════════════════════════════════════════
   VRS API — Mechanics Routes
   Trust & Verification System
   ═══════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();
const { calculateTrustScore } = require('../middleware/validation');

// Mechanics data with verification fields (fallback when MySQL not connected)
const MECHANICS = [
  { id: 1, name: 'Rajesh Kumar', phone: '+91-9876543210', specialization: 'Engine Specialist', rating: 4.8, total_reviews: 156, completed_bookings: 180, verified: true, trust_score: 9.6, latitude: 18.5204, longitude: 73.8567, is_available: true, avatar_url: null },
  { id: 2, name: 'Priya Patel', phone: '+91-9876543211', specialization: 'Electrical & Battery', rating: 4.6, total_reviews: 89, completed_bookings: 102, verified: true, trust_score: 8.4, latitude: 18.5280, longitude: 73.8650, is_available: true, avatar_url: null },
  { id: 3, name: 'Ajay Singh', phone: '+91-9876543212', specialization: 'Tire & Suspension', rating: 4.9, total_reviews: 234, completed_bookings: 260, verified: true, trust_score: 10.0, latitude: 18.5150, longitude: 73.8480, is_available: true, avatar_url: null },
  { id: 4, name: 'Sneha Deshmukh', phone: '+91-9876543213', specialization: 'General Mechanic', rating: 4.5, total_reviews: 67, completed_bookings: 75, verified: false, trust_score: 5.2, latitude: 18.5320, longitude: 73.8720, is_available: false, avatar_url: null },
  { id: 5, name: 'Rahul Mehta', phone: '+91-9876543214', specialization: 'AC & Cooling', rating: 4.7, total_reviews: 112, completed_bookings: 130, verified: true, trust_score: 9.0, latitude: 18.5100, longitude: 73.8600, is_available: true, avatar_url: null },
  { id: 6, name: 'Amit Verma', phone: '+91-9876543215', specialization: 'Brake Specialist', rating: 4.4, total_reviews: 45, completed_bookings: 50, verified: false, trust_score: 4.5, latitude: 18.5350, longitude: 73.8500, is_available: true, avatar_url: null },
];

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

    // Try MySQL first, fallback to dummy data
    let mechanics = MECHANICS;

    try {
      const db = require('../db');
      const query = showUnverified
        ? 'SELECT * FROM mechanics WHERE is_available = TRUE'
        : 'SELECT * FROM mechanics WHERE is_available = TRUE AND verified = TRUE';
      mechanics = await db.query(query);
    } catch {
      // MySQL not available, use dummy data
    }

    // Filter: only available + verified (unless includeUnverified)
    const results = mechanics
      .filter(m => m.is_available && (showUnverified || m.verified))
      .map(m => {
        const dist = haversineDistance(userLat, userLng, m.latitude, m.longitude);
        const trustScore = m.trust_score || calculateTrustScore(m.rating, m.completed_bookings, m.verified);
        return {
          ...m,
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
    res.status(500).json({ error: 'Failed to fetch nearby mechanics' });
  }
});

/**
 * GET /api/mechanics/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let mechanic = MECHANICS.find(m => m.id === id);

    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic not found' });
    }

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
