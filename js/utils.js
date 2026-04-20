/* ═══════════════════════════════════════════════════
   VRS Utilities — Trust & Validation Enhanced
   ═══════════════════════════════════════════════════ */

/**
 * Calculate distance between two GPS coordinates (Haversine formula)
 * @returns distance in kilometers
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Format distance to human-readable string
 */
function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)} km`;
}

/**
 * Estimate ETA in minutes based on distance (avg speed 30 km/h in city)
 */
function estimateETA(distanceKm) {
  const minutes = Math.round((distanceKm / 30) * 60);
  return Math.max(minutes, 1);
}

/**
 * Format currency in INR
 */
function formatCurrency(amount) {
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

/**
 * Time ago from date
 */
function timeAgo(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) return `${Math.floor(days / 30)} months ago`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} min ago`;
  return 'Just now';
}

/**
 * Format time (HH:MM AM/PM)
 */
function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 300ms ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Debounce function
 */
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Generate random ID
 */
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Get URL parameter
 */
function getUrlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

/**
 * Add ripple effect to button
 */
function addRipple(event) {
  const button = event.currentTarget;
  const rect = button.getBoundingClientRect();
  const ripple = document.createElement('span');
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
  ripple.className = 'ripple';
  button.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

// ═══════════════════════════════════════════════════
// TRUST SYSTEM — UI Helpers
// ═══════════════════════════════════════════════════

/**
 * Render verified badge HTML
 */
function renderVerifiedBadge(mechanic) {
  if (!mechanic.verified) {
    return '<span class="unverified-badge" title="Not yet verified">⚠️ Unverified</span>';
  }
  return '<span class="verified-badge" title="Verified Mechanic">✅ Verified</span>';
}

/**
 * Render trust score UI
 */
function renderTrustScore(score) {
  const numScore = parseFloat(score) || 0;
  let level = 'low';
  let label = 'Low Trust';

  if (numScore >= 8) {
    level = 'high';
    label = 'Highly Trusted';
  } else if (numScore >= 5) {
    level = 'medium';
    label = 'Trusted';
  }

  return `<span class="trust-score trust-level-${level}" title="${label}">
    <span class="trust-score-icon">🛡️</span>
    <span class="trust-score-value">${numScore.toFixed(1)}</span>
  </span>`;
}

/**
 * Render completed jobs count
 */
function renderCompletedJobs(count) {
  const num = parseInt(count) || 0;
  return `<span class="completed-jobs" title="${num} completed jobs">🔧 ${num} jobs</span>`;
}

/**
 * Get trust level class name
 */
function getTrustLevel(score) {
  const numScore = parseFloat(score) || 0;
  if (numScore >= 8) return 'high';
  if (numScore >= 5) return 'medium';
  return 'low';
}

// ═══════════════════════════════════════════════════
// DUMMY DATA — With Trust & Verification Fields
// ═══════════════════════════════════════════════════

/**
 * Dummy mechanics data
 */
const DUMMY_MECHANICS = [
  {
    id: 1,
    name: 'Rajesh Kumar',
    specialization: 'Engine Specialist',
    rating: 4.8,
    total_reviews: 156,
    completed_bookings: 180,
    verified: true,
    trust_score: 9.6,
    latitude: 18.5204,
    longitude: 73.8567,
    is_available: true,
    avatar_url: null,
    phone: '+91-9876543210'
  },
  {
    id: 2,
    name: 'Priya Patel',
    specialization: 'Electrical & Battery',
    rating: 4.6,
    total_reviews: 89,
    completed_bookings: 102,
    verified: true,
    trust_score: 8.4,
    latitude: 18.5280,
    longitude: 73.8650,
    is_available: true,
    avatar_url: null,
    phone: '+91-9876543211'
  },
  {
    id: 3,
    name: 'Ajay Singh',
    specialization: 'Tire & Suspension',
    rating: 4.9,
    total_reviews: 234,
    completed_bookings: 260,
    verified: true,
    trust_score: 10.0,
    latitude: 18.5150,
    longitude: 73.8480,
    is_available: true,
    avatar_url: null,
    phone: '+91-9876543212'
  },
  {
    id: 4,
    name: 'Sneha Deshmukh',
    specialization: 'General Mechanic',
    rating: 4.5,
    total_reviews: 67,
    completed_bookings: 75,
    verified: false,
    trust_score: 5.2,
    latitude: 18.5320,
    longitude: 73.8720,
    is_available: false,
    avatar_url: null,
    phone: '+91-9876543213'
  },
  {
    id: 5,
    name: 'Rahul Mehta',
    specialization: 'AC & Cooling',
    rating: 4.7,
    total_reviews: 112,
    completed_bookings: 130,
    verified: true,
    trust_score: 9.0,
    latitude: 18.5100,
    longitude: 73.8600,
    is_available: true,
    avatar_url: null,
    phone: '+91-9876543214'
  },
  {
    id: 6,
    name: 'Amit Verma',
    specialization: 'Brake Specialist',
    rating: 4.4,
    total_reviews: 45,
    completed_bookings: 50,
    verified: false,
    trust_score: 4.5,
    latitude: 18.5350,
    longitude: 73.8500,
    is_available: true,
    avatar_url: null,
    phone: '+91-9876543215'
  }
];

/**
 * Dummy services data
 */
const DUMMY_SERVICES = [
  { id: 1, name: 'Flat Tire Repair', category: 'tire', base_price: 500, estimated_time: 30 },
  { id: 2, name: 'Battery Jump Start', category: 'battery', base_price: 800, estimated_time: 20 },
  { id: 3, name: 'Engine Diagnosis', category: 'engine', base_price: 1500, estimated_time: 60 },
  { id: 4, name: 'Brake Pad Replacement', category: 'brake', base_price: 2500, estimated_time: 90 },
  { id: 5, name: 'Emergency Fuel Delivery', category: 'fuel', base_price: 600, estimated_time: 25 },
  { id: 6, name: 'Towing Service', category: 'other', base_price: 2000, estimated_time: 45 },
  { id: 7, name: 'AC Gas Refill', category: 'other', base_price: 1800, estimated_time: 40 },
  { id: 8, name: 'Battery Replacement', category: 'battery', base_price: 4500, estimated_time: 30 },
];

/**
 * Dummy booking history
 */
const DUMMY_HISTORY = [
  {
    id: 'BK001',
    date: '2026-03-18T10:30:00',
    issue: 'Flat Tire Replacement',
    mechanic: 'Ajay Singh',
    mechanic_verified: true,
    vehicle: 'Hyundai i20',
    cost: 1200,
    status: 'completed',
    rating: 5,
    review: 'Excellent service! Fixed the tire in 20 minutes.'
  },
  {
    id: 'BK002',
<<<<<<< HEAD
    date: '2026-04-10T14:15:00',
    issue: 'Battery Replacement',
    mechanic: 'Priya Patel',
    mechanic_verified: true,
    vehicle: 'Hyundai i20',
    cost: 4500,
    status: 'pending',
    rating: null,
    review: null
=======
    date: '2026-03-15T14:15:00',
    issue: 'Battery Jump Start',
    mechanic: 'Priya Patel',
    mechanic_verified: true,
    vehicle: 'Hyundai i20',
    cost: 800,
    status: 'completed',
    rating: 4,
    review: 'Quick response, got my car running again.'
>>>>>>> 792c9bf5557c932829c314716be1f2369dc0acf9
  },
  {
    id: 'BK003',
    date: '2026-03-10T09:00:00',
    issue: 'Engine Overheating',
    mechanic: 'Rajesh Kumar',
    mechanic_verified: true,
    vehicle: 'Honda Activa',
    cost: 3500,
    status: 'completed',
    rating: 5,
    review: 'Very knowledgeable, fixed the issue permanently.'
  },
  {
    id: 'BK004',
<<<<<<< HEAD
    date: '2026-04-08T16:45:00',
=======
    date: '2026-03-05T16:45:00',
>>>>>>> 792c9bf5557c932829c314716be1f2369dc0acf9
    issue: 'AC Not Cooling',
    mechanic: 'Rahul Mehta',
    mechanic_verified: true,
    vehicle: 'Hyundai i20',
    cost: 2200,
<<<<<<< HEAD
    status: 'pending',
    rating: null,
    review: null
=======
    status: 'completed',
    rating: 4,
    review: 'Good service, AC working like new.'
>>>>>>> 792c9bf5557c932829c314716be1f2369dc0acf9
  },
  {
    id: 'BK005',
    date: '2026-03-01T11:20:00',
    issue: 'Brake Pad Check',
    mechanic: 'Amit Verma',
    mechanic_verified: false,
    vehicle: 'Honda Activa',
    cost: 0,
    status: 'cancelled',
    rating: null,
    review: null
<<<<<<< HEAD
  },
  {
    id: 'BK006',
    date: '2026-04-05T09:30:00',
    issue: 'Scheduled Periodic Service',
    mechanic: 'Sneha Deshmukh',
    mechanic_verified: false,
    vehicle: 'Honda City',
    cost: 0,
    status: 'cancelled',
    rating: null,
    review: null
=======
>>>>>>> 792c9bf5557c932829c314716be1f2369dc0acf9
  }
];
