/* ═══════════════════════════════════════════════════
   VRS Map — Leaflet + GPS + Trust Indicators
   ═══════════════════════════════════════════════════ */

let map = null;
let userMarker = null;
let mechanicMarkers = [];
let userLat = 18.5204; // Default: Pune, India
let userLng = 73.8567;
let mechanicsWithDistance = [];
let filteredMechanics = [];

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

  // Grab the search input
  const searchInput = document.getElementById('mapSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      filteredMechanics = mechanicsWithDistance.filter(m => 
        m.name.toLowerCase().includes(searchTerm) || 
        m.specialization.toLowerCase().includes(searchTerm)
      );
      renderMechanicsOnMap();
      renderMechanicsList();
    });
  }

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
async function loadNearbyMechanics() {
  // Clear existing markers
  mechanicMarkers.forEach(m => map.removeLayer(m));
  mechanicMarkers = [];

  try {
    const res = await fetch(`/api/mechanics/nearby?lat=${userLat}&lng=${userLng}`);
    const data = await res.json();

<<<<<<< HEAD
    if (data.success && data.mechanics && data.mechanics.length > 0) {
      mechanicsWithDistance = data.mechanics;
      filteredMechanics = [...mechanicsWithDistance];
    } else {
      throw new Error("No mechanics returned");
    }
  } catch (err) {
    console.warn('Fallback to dummy mechanics:', err.message || err);
    mechanicsWithDistance = DUMMY_MECHANICS.map((m, index) => {
      // Offset to ensure they appear near the current user location
      const latOffset = (index % 2 === 0 ? 1 : -1) * (0.005 + index * 0.002);
      const lngOffset = (index % 3 === 0 ? 1 : -1) * (0.005 + index * 0.001);
      const newLat = userLat + latOffset;
      const newLng = userLng + lngOffset;
      const dist = haversineDistance(userLat, userLng, newLat, newLng);
      return {
        ...m,
        latitude: newLat,
        longitude: newLng,
        distance: dist,
        eta: estimateETA(dist)
      };
    }).sort((a, b) => a.distance - b.distance);
    filteredMechanics = [...mechanicsWithDistance];
=======
    if (data.success) {
      mechanicsWithDistance = data.mechanics;
      filteredMechanics = [...mechanicsWithDistance];
    } else {
      mechanicsWithDistance = [];
      filteredMechanics = [];
    }
  } catch (err) {
    console.error('Failed to load mechanics:', err);
    mechanicsWithDistance = [];
    filteredMechanics = [];
>>>>>>> 792c9bf5557c932829c314716be1f2369dc0acf9
  }

  renderMechanicsOnMap();
  renderMechanicsList();
}

/**
 * Render mechanics on the map
 */
function renderMechanicsOnMap() {
  // Clear existing markers
  mechanicMarkers.forEach(m => map.removeLayer(m));
  mechanicMarkers = [];

  // Add mechanic markers with verified badges
  filteredMechanics.forEach(mechanic => {
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
        <span style="font-size:12px;">📞 ${mechanic.phone || 'N/A'}</span><br>
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
  if (countEl) countEl.textContent = filteredMechanics.length;
}

/**
 * Render mechanics list in bottom sheet — with trust indicators
 */
function renderMechanicsList() {
  const container = document.getElementById('mechanicsList');
  if (!container) return;

  if (filteredMechanics.length === 0) {
    container.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--text-muted);">No mechanics found.</div>`;
    return;
  }

  container.innerHTML = filteredMechanics.map(m => `
    <div class="mechanic-card mb-md" onclick="window.location.href='booking.html?mechanic=${m.id}'">
      <div class="mechanic-avatar">${m.name.charAt(0)}</div>
      <div class="mechanic-info">
        <div class="mechanic-name">
          ${m.name}
          ${m.verified ? '<span class="verified-badge">✅ Verified</span>' : '<span class="unverified-badge">⚠️</span>'}
        </div>
        <div class="mechanic-specialty">${m.specialization} &bull; 📞 ${m.phone || 'N/A'}</div>
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
