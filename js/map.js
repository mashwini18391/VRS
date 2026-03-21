/* ═══════════════════════════════════════════════════
   VRS Map — Leaflet + GPS + Trust Indicators
   ═══════════════════════════════════════════════════ */

let map = null;
let userMarker = null;
let mechanicMarkers = [];
let userLat = 18.5204; // Default: Pune, India
let userLng = 73.8567;
let mechanicsWithDistance = [];

/**
 * Initialize the map
 */
function initMap() {
  // Create map centered on default location
  map = L.map('map', {
    zoomControl: false,
    attributionControl: false
  }).setView([userLat, userLng], 14);

  // Add zoom control to top-right
  L.control.zoom({ position: 'topright' }).addTo(map);

  // Dark tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
  }).addTo(map);

  // Get user location (GPS only — no manual input)
  getUserLocation();
}

/**
 * Get user's GPS location — GPS ONLY, no manual input allowed
 */
function getUserLocation() {
  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser', 'warning');
    loadNearbyMechanics();
    return;
  }

  showToast('Detecting your location via GPS...', 'info');

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLat = position.coords.latitude;
      userLng = position.coords.longitude;

      // Add user marker
      addUserMarker(userLat, userLng);

      // Center map
      map.setView([userLat, userLng], 15);

      // Load nearby mechanics
      loadNearbyMechanics();

      showToast('Location detected via GPS!', 'success');
    },
    (error) => {
      console.warn('Geolocation error:', error);
      showToast('GPS unavailable. Using default location. Enable GPS for accuracy.', 'warning');

      // Use default location
      addUserMarker(userLat, userLng);
      loadNearbyMechanics();
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000
    }
  );
}

/**
 * Add user marker to map
 */
function addUserMarker(lat, lng) {
  if (userMarker) {
    map.removeLayer(userMarker);
  }

  const userIcon = L.divIcon({
    className: 'user-marker-wrapper',
    html: '<div class="user-marker"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
  userMarker.bindPopup('<strong>📍 Your Location</strong><br><span style="font-size:11px;color:#a1a1aa;">Via GPS</span>');
}

/**
 * Load nearby mechanics and show on map
 * Only shows VERIFIED mechanics
 */
function loadNearbyMechanics() {
  // Clear existing markers
  mechanicMarkers.forEach(m => map.removeLayer(m));
  mechanicMarkers = [];

  // Filter only verified + available mechanics
  mechanicsWithDistance = DUMMY_MECHANICS
    .filter(m => m.is_available && m.verified)
    .map(m => ({
      ...m,
      distance: haversineDistance(userLat, userLng, m.latitude, m.longitude),
      eta: estimateETA(haversineDistance(userLat, userLng, m.latitude, m.longitude))
    }))
    .sort((a, b) => a.distance - b.distance);

  // Add mechanic markers with verified badges
  mechanicsWithDistance.forEach(mechanic => {
    const mechanicIcon = L.divIcon({
      className: 'mechanic-marker-wrapper',
      html: `<div class="mechanic-marker">🔧</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    const marker = L.marker([mechanic.latitude, mechanic.longitude], {
      icon: mechanicIcon
    }).addTo(map);

    const trustLevel = getTrustLevel(mechanic.trust_score);
    const stars = '⭐'.repeat(Math.round(mechanic.rating));
    marker.bindPopup(`
      <div style="min-width:200px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          <strong style="font-size:14px;">${mechanic.name}</strong>
          <span style="background:#22c55e;color:#fff;font-size:10px;padding:2px 6px;border-radius:10px;">✓ Verified</span>
        </div>
        <span style="color:#a1a1aa;font-size:12px;">${mechanic.specialization}</span><br>
        <span style="font-size:12px;">${stars} ${mechanic.rating} (${mechanic.total_reviews} reviews)</span><br>
        <div style="display:flex;align-items:center;gap:4px;margin:4px 0;">
          <span style="font-size:11px;color:${trustLevel === 'high' ? '#22c55e' : trustLevel === 'medium' ? '#f59e0b' : '#ef4444'};">🛡️ Trust: ${mechanic.trust_score}/10</span>
          <span style="font-size:11px;color:#a1a1aa;">· 🔧 ${mechanic.completed_bookings} jobs</span>
        </div>
        <span style="color:#007aff;font-size:13px;font-weight:600;">${formatDistance(mechanic.distance)} · ${mechanic.eta} min</span><br>
        <a href="booking.html?mechanic=${mechanic.id}" style="display:inline-block;margin-top:8px;padding:6px 12px;background:#ff2d55;color:#fff;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600;">Book Now</a>
      </div>
    `);

    mechanicMarkers.push(marker);
  });

  // Update count
  const countEl = document.getElementById('mechanicCount');
  if (countEl) countEl.textContent = mechanicsWithDistance.length;

  // Render mechanics list
  renderMechanicsList();
}

/**
 * Render mechanics list in bottom sheet — with trust indicators
 */
function renderMechanicsList() {
  const container = document.getElementById('mechanicsList');
  if (!container) return;

  container.innerHTML = mechanicsWithDistance.map(m => `
    <div class="mechanic-card mb-md" onclick="window.location.href='booking.html?mechanic=${m.id}'">
      <div class="mechanic-avatar">${m.name.charAt(0)}</div>
      <div class="mechanic-info">
        <div class="mechanic-name">
          ${m.name}
          ${m.verified ? '<span class="verified-badge">✅ Verified</span>' : '<span class="unverified-badge">⚠️</span>'}
        </div>
        <div class="mechanic-specialty">${m.specialization}</div>
        <div class="mechanic-meta">
          <span class="mechanic-rating">⭐ ${m.rating} (${m.total_reviews})</span>
          <span class="mechanic-distance">📍 ${formatDistance(m.distance)}</span>
        </div>
        <div class="mechanic-trust-meta">
          ${renderTrustScore(m.trust_score)}
          ${renderCompletedJobs(m.completed_bookings)}
        </div>
      </div>
      <div class="mechanic-eta">
        <div class="mechanic-eta-value">${m.eta}</div>
        <div class="mechanic-eta-label">min</div>
      </div>
    </div>
  `).join('');
}

/**
 * Toggle bottom sheet
 */
function toggleSheet() {
  const sheet = document.getElementById('mechanicsSheet');
  if (sheet) {
    sheet.classList.toggle('collapsed');
  }
}

/**
 * Recenter map to user location
 */
function recenterMap() {
  if (map) {
    map.setView([userLat, userLng], 15);
    showToast('Map recentered', 'info');
  }
}
