/* ═══════════════════════════════════════════════════
   VRS Tracking — Real-time Mechanic Location
   With Location Validation
   ═══════════════════════════════════════════════════ */

let trackingMap = null;
let trackingMarker = null;
let trackingSubscription = null;
let mechanicPosition = { lat: 18.5280, lng: 73.8650 }; // Starting position
let userPosition = { lat: 18.5204, lng: 73.8567 };
let lastUpdateTimestamp = Date.now();

// Validation constants
const MAX_JUMP_KM = 50; // Reject if mechanic "teleports" > 50km
const MAX_UPDATE_AGE_MS = 30000; // Reject updates older than 30 seconds

/**
 * Initialize tracking view
 */
function initTracking() {
  if (typeof L === 'undefined') return;

  // Create map
  trackingMap = L.map('trackingMap', {
    zoomControl: false,
    attributionControl: false
  }).setView([userPosition.lat, userPosition.lng], 14);

  // Dark tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(trackingMap);

  // Add user marker
  const userIcon = L.divIcon({
    className: 'user-marker-wrapper',
    html: '<div class="user-marker"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
  L.marker([userPosition.lat, userPosition.lng], { icon: userIcon })
    .addTo(trackingMap)
    .bindPopup('📍 You');

  // Add mechanic marker
  const mechanicIcon = L.divIcon({
    className: 'mechanic-marker-wrapper',
    html: '<div class="mechanic-marker">🔧</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
  trackingMarker = L.marker([mechanicPosition.lat, mechanicPosition.lng], { icon: mechanicIcon })
    .addTo(trackingMap)
    .bindPopup('🔧 Mechanic (Verified ✅)');

  // Draw route line
  const routeLine = L.polyline([
    [mechanicPosition.lat, mechanicPosition.lng],
    [userPosition.lat, userPosition.lng]
  ], {
    color: '#007aff',
    weight: 3,
    opacity: 0.7,
    dashArray: '10, 10'
  }).addTo(trackingMap);

  // Fit bounds to show both markers
  const bounds = L.latLngBounds([
    [mechanicPosition.lat, mechanicPosition.lng],
    [userPosition.lat, userPosition.lng]
  ]);
  trackingMap.fitBounds(bounds, { padding: [60, 60] });

  // Start real-time tracking
  subscribeToLocationUpdates();

  // Start simulation in demo mode
  startDemoTracking();
}

/**
 * Subscribe to mechanic location updates via Supabase
 * With validation for inconsistent/outdated data
 */
function subscribeToLocationUpdates() {
  const client = initSupabase();
  if (!client || SUPABASE_URL === 'https://your-project.supabase.co') {
    console.log('Demo mode: Using simulated tracking');
    return;
  }

  try {
    trackingSubscription = client
      .channel('mechanic-tracking')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mechanic_locations' },
        (payload) => {
          const newLat = parseFloat(payload.new.latitude);
          const newLng = parseFloat(payload.new.longitude);
          const updateTime = payload.new.updated_at ? new Date(payload.new.updated_at).getTime() : Date.now();

          // ── Validate location update ──
          if (!validateLocationUpdate(newLat, newLng, updateTime)) {
            console.warn('⚠️ Rejected invalid location update:', { newLat, newLng, updateTime });
            return;
          }

          updateMechanicPosition(newLat, newLng);
        }
      )
      .subscribe();
  } catch (err) {
    console.log('Tracking subscription error:', err);
  }
}

/**
 * Validate a location update before applying it
 */
function validateLocationUpdate(newLat, newLng, updateTimestamp) {
  // Check 1: Valid coordinates
  if (isNaN(newLat) || isNaN(newLng)) {
    console.warn('Invalid coordinates:', newLat, newLng);
    return false;
  }

  if (newLat < -90 || newLat > 90 || newLng < -180 || newLng > 180) {
    console.warn('Coordinates out of range:', newLat, newLng);
    return false;
  }

  // Check 2: Reject unrealistic location jumps (> MAX_JUMP_KM)
  const jumpDistance = haversineDistance(
    mechanicPosition.lat, mechanicPosition.lng,
    newLat, newLng
  );

  if (jumpDistance > MAX_JUMP_KM) {
    console.warn(`Location jump too large: ${jumpDistance.toFixed(2)} km (max: ${MAX_JUMP_KM} km)`);
    return false;
  }

  // Check 3: Reject outdated updates (> MAX_UPDATE_AGE_MS)
  const now = Date.now();
  if (updateTimestamp && (now - updateTimestamp) > MAX_UPDATE_AGE_MS) {
    console.warn('Outdated location update:', new Date(updateTimestamp).toISOString());
    return false;
  }

  // Check 4: Reject if update is older than last accepted update
  if (updateTimestamp && updateTimestamp < lastUpdateTimestamp) {
    console.warn('Out-of-order location update rejected');
    return false;
  }

  return true;
}

/**
 * Update mechanic position on map
 */
function updateMechanicPosition(lat, lng) {
  mechanicPosition = { lat, lng };
  lastUpdateTimestamp = Date.now();

  if (trackingMarker) {
    trackingMarker.setLatLng([lat, lng]);
  }

  // Update ETA
  const distance = haversineDistance(lat, lng, userPosition.lat, userPosition.lng);
  const eta = estimateETA(distance);

  const etaEl = document.getElementById('trackingETA');
  if (etaEl) etaEl.textContent = `${eta} min`;

  const distEl = document.getElementById('trackingDistance');
  if (distEl) distEl.textContent = formatDistance(distance);
}

/**
 * Simulate mechanic movement (Demo mode)
 */
function startDemoTracking() {
  const steps = 20;
  let step = 0;

  const latStep = (userPosition.lat - mechanicPosition.lat) / steps;
  const lngStep = (userPosition.lng - mechanicPosition.lng) / steps;

  const interval = setInterval(() => {
    step++;
    if (step >= steps) {
      clearInterval(interval);
      showToast('Mechanic has arrived! 🎉', 'success');
      return;
    }

    // Add some random jitter for realistic movement
    const jitter = () => (Math.random() - 0.5) * 0.001;
    const newLat = mechanicPosition.lat + latStep + jitter();
    const newLng = mechanicPosition.lng + lngStep + jitter();

    // Validate even in demo mode
    if (validateLocationUpdate(newLat, newLng, Date.now())) {
      updateMechanicPosition(newLat, newLng);
    }
  }, 3000); // Move every 3 seconds
}

/**
 * Cleanup on page leave
 */
window.addEventListener('beforeunload', () => {
  if (trackingSubscription) {
    trackingSubscription.unsubscribe();
  }
});
