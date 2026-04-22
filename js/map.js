/* ═══════════════════════════════════════════════════
   VRS Map — Google Maps + Uber-Style Flow
   ═══════════════════════════════════════════════════ */

let map = null;
let userMarker = null;
let mechanicGMarkers = [];
let directionsService = null;
let directionsRenderer = null;
let userLat = 18.5204;
let userLng = 73.8567;
let mechanicsWithDistance = [];
let filteredMechanics = [];
let selectedMechanic = null;
let currentState = 'browse'; // browse | selected | searching | tracking | arrived
let trackingInterval = null;
let animatedMechMarker = null;
let routePath = [];
let routeStepIndex = 0;
let googleMapsReady = false;

// ── Garage Owner state ──
let goCurrentRequest = null;
let goRouteRenderer = null;

/* ═══════════════════════════════════════════
   GOOGLE MAPS READY CALLBACK (if used)
   ═══════════════════════════════════════════ */

function onGoogleMapsReady() {
  googleMapsReady = true;
  if (!map) initMap();
}

/* ═══════════════════════════════════════════
   INIT MAP
   ═══════════════════════════════════════════ */

function initMap() {
  if (!window.google || !window.google.maps) {
    // Google Maps not loaded yet, poll every 200ms
    setTimeout(initMap, 200);
    return;
  }

  const darkStyle = [
    { elementType: 'geometry', stylers: [{ color: '#0a0a14' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a14' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#6b6b7b' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a1a28' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#22222f' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#252535' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#070712' }] },
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ];

  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: userLat, lng: userLng },
    zoom: 15,
    styles: darkStyle,
    disableDefaultUI: true,
    zoomControl: true,
    zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
    gestureHandling: 'greedy'
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: '#ff2d55',
      strokeWeight: 5,
      strokeOpacity: 0.8
    }
  });

  // Search input
  const searchInput = document.getElementById('mapSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      filteredMechanics = mechanicsWithDistance.filter(m =>
        m.name.toLowerCase().includes(q) || m.specialization.toLowerCase().includes(q)
      );
      renderMechanicsOnMap();
      renderMechanicsList();
    });
  }

  getUserLocation();
}

/* ═══════════════════════════════════════════
   GET USER LOCATION (GPS)
   ═══════════════════════════════════════════ */

function getUserLocation() {
  if (!navigator.geolocation) {
    showToast('Geolocation not supported', 'warning');
    placeUserMarker();
    loadNearbyMechanics();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      map.setCenter({ lat: userLat, lng: userLng });
      placeUserMarker();
      loadNearbyMechanics();
      showToast('Location detected!', 'success');
    },
    () => {
      showToast('GPS unavailable — using default location.', 'warning');
      placeUserMarker();
      loadNearbyMechanics();
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
  );
}

function placeUserMarker() {
  if (userMarker) userMarker.setMap(null);

  userMarker = new google.maps.Marker({
    position: { lat: userLat, lng: userLng },
    map: map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#3b82f6',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 3,
      scale: 10
    },
    title: 'Your Location',
    zIndex: 100
  });

  // Pulsing circle around user
  new google.maps.Circle({
    map: map,
    center: { lat: userLat, lng: userLng },
    radius: 100,
    fillColor: '#3b82f6',
    fillOpacity: 0.08,
    strokeColor: '#3b82f6',
    strokeOpacity: 0.3,
    strokeWeight: 1,
    clickable: false
  });
}

function recenterMap() {
  if (map) {
    map.setCenter({ lat: userLat, lng: userLng });
    map.setZoom(15);
    showToast('Map recentered', 'info');
  }
}

/* ═══════════════════════════════════════════
   LOAD NEARBY MECHANICS
   ═══════════════════════════════════════════ */

async function loadNearbyMechanics() {
  const role = localStorage.getItem('vrs_user_role') || 'car_owner';
  if (role === 'garage_owner') {
    return loadCustomerRequests();
  }

  clearMechanicMarkers();

  try {
    const res = await fetch(`/api/mechanics/nearby?lat=${userLat}&lng=${userLng}`);
    const data = await res.json();
    if (data.success && data.mechanics && data.mechanics.length > 0) {
      mechanicsWithDistance = data.mechanics;
    } else {
      throw new Error('No mechanics');
    }
  } catch {
    // Fallback to dummy mechanics near user
    mechanicsWithDistance = DUMMY_MECHANICS.map((m, i) => {
      const latOff = (i % 2 === 0 ? 1 : -1) * (0.005 + i * 0.002);
      const lngOff = (i % 3 === 0 ? 1 : -1) * (0.005 + i * 0.001);
      const lat = userLat + latOff;
      const lng = userLng + lngOff;
      const dist = haversineDistance(userLat, userLng, lat, lng);
      return { ...m, latitude: lat, longitude: lng, distance: dist, eta: estimateETA(dist) };
    }).sort((a, b) => a.distance - b.distance);
  }

  filteredMechanics = [...mechanicsWithDistance];
  renderMechanicsOnMap();
  renderMechanicsList();
}

function clearMechanicMarkers() {
  mechanicGMarkers.forEach(m => m.setMap(null));
  mechanicGMarkers = [];
}

/* ═══════════════════════════════════════════
   RENDER MECHANICS ON MAP
   ═══════════════════════════════════════════ */

function renderMechanicsOnMap() {
  clearMechanicMarkers();

  filteredMechanics.forEach(mech => {
    const marker = new google.maps.Marker({
      position: { lat: mech.latitude, lng: mech.longitude },
      map: map,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
            <rect x="2" y="2" width="36" height="36" rx="10" fill="#1a1a28" stroke="#ff2d55" stroke-width="2"/>
            <text x="20" y="26" text-anchor="middle" font-size="18">🔧</text>
          </svg>
        `),
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 20)
      },
      title: mech.name,
      zIndex: 10
    });

    marker.addListener('click', () => selectMechanic(mech.id));
    mechanicGMarkers.push(marker);
  });

  document.getElementById('mechCount').textContent = filteredMechanics.length;
}

/* ═══════════════════════════════════════════
   RENDER MECHANICS LIST (Bottom Sheet)
   ═══════════════════════════════════════════ */

function renderMechanicsList() {
  const container = document.getElementById('mechList');
  if (!container) return;

  if (filteredMechanics.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#6b6b7b;">No mechanics found nearby.</div>';
    return;
  }

  container.innerHTML = filteredMechanics.map(m => `
    <div class="mech-list-item" onclick="selectMechanic(${m.id})" id="mechItem-${m.id}">
      <div class="mech-avatar">${m.name.charAt(0)}</div>
      <div class="mech-details">
        <div class="mech-name">
          ${m.name}
          ${m.verified ? '<span style="color:#2ed573;font-size:11px;">✓</span>' : ''}
        </div>
        <div class="mech-spec">${m.specialization}</div>
        <div class="mech-meta">
          <span>⭐ ${m.rating}</span>
          <span>📍 ${formatDistance(m.distance)}</span>
          <span>🛡️ ${m.trust_score}</span>
        </div>
      </div>
      <div class="mech-eta-box">
        <div class="mech-eta-val">${m.eta}</div>
        <div class="mech-eta-lbl">min</div>
      </div>
    </div>
  `).join('');
}

/* ═══════════════════════════════════════════
   CAR OWNER FLOW — SELECT MECHANIC
   ═══════════════════════════════════════════ */

function selectMechanic(id) {
  selectedMechanic = mechanicsWithDistance.find(m => m.id === id);
  if (!selectedMechanic) return;

  // Pan map
  map.panTo({ lat: selectedMechanic.latitude, lng: selectedMechanic.longitude });
  map.setZoom(16);

  // Fill detail card
  document.getElementById('selAvatar').textContent = selectedMechanic.name.charAt(0);
  document.getElementById('selName').textContent = selectedMechanic.name;
  document.getElementById('selSpec').textContent = selectedMechanic.specialization;
  document.getElementById('selVerified').textContent = selectedMechanic.verified ? '✓ Verified' : '⚠️ Unverified';
  document.getElementById('selVerified').className = 'detail-badge ' + (selectedMechanic.verified ? 'green' : 'yellow');
  document.getElementById('selPhone').textContent = '📞 ' + (selectedMechanic.phone || 'N/A');
  document.getElementById('selRating').textContent = '⭐ ' + selectedMechanic.rating;
  document.getElementById('selDist').textContent = formatDistance(selectedMechanic.distance);
  document.getElementById('selEta').textContent = selectedMechanic.eta;

  setState('selected');
}

function backToBrowse() {
  selectedMechanic = null;
  directionsRenderer.setDirections({ routes: [] });
  map.setCenter({ lat: userLat, lng: userLng });
  map.setZoom(15);
  setState('browse');
}

/* ═══════════════════════════════════════════
   CAR OWNER FLOW — REQUEST SERVICE
   ═══════════════════════════════════════════ */

function requestService() {
  if (!selectedMechanic) return;

  document.getElementById('searchMechName').textContent = selectedMechanic.name;
  setState('searching');

  // Simulate mechanic accepting after 3-5 seconds
  setTimeout(() => {
    if (currentState !== 'searching') return; // cancelled
    showToast(`${selectedMechanic.name} accepted your request!`, 'success');
    startTracking();
  }, 3000 + Math.random() * 2000);
}

/* ═══════════════════════════════════════════
   CAR OWNER FLOW — LIVE TRACKING
   ═══════════════════════════════════════════ */

function startTracking() {
  // Fill tracking card
  document.getElementById('trackAvatar').textContent = selectedMechanic.name.charAt(0);
  document.getElementById('trackName').textContent = selectedMechanic.name;
  document.getElementById('trackSpec').textContent = selectedMechanic.specialization;
  document.getElementById('trackPhone').textContent = '📞 ' + (selectedMechanic.phone || 'N/A');

  setState('tracking');
  document.getElementById('trackStatus').textContent = 'Mechanic En Route 🚗';

  // Draw route from mechanic to user
  const origin = { lat: selectedMechanic.latitude, lng: selectedMechanic.longitude };
  const destination = { lat: userLat, lng: userLng };

  directionsService.route({
    origin: origin,
    destination: destination,
    travelMode: google.maps.TravelMode.DRIVING
  }, (result, status) => {
    if (status === 'OK') {
      directionsRenderer.setDirections(result);

      const leg = result.routes[0].legs[0];
      document.getElementById('trackDist').textContent = leg.distance.text;
      document.getElementById('trackEta').textContent = leg.duration.text;
      document.getElementById('trackEtaBadge').textContent = leg.duration.text;

      // Fit map to route bounds
      map.fitBounds(result.routes[0].bounds);

      // Extract path for animation
      routePath = [];
      result.routes[0].overview_path.forEach(p => {
        routePath.push({ lat: p.lat(), lng: p.lng() });
      });

      // Start animated mechanic marker
      routeStepIndex = 0;
      placeAnimatedMechMarker(routePath[0]);
      beginAnimation();
    } else {
      // Fallback: straight line animation
      showToast('Route unavailable — simulating path.', 'warning');
      document.getElementById('trackDist').textContent = formatDistance(selectedMechanic.distance);
      document.getElementById('trackEta').textContent = selectedMechanic.eta + ' min';
      document.getElementById('trackEtaBadge').textContent = selectedMechanic.eta + ' min';

      routePath = interpolatePoints(origin, destination, 30);
      routeStepIndex = 0;
      placeAnimatedMechMarker(routePath[0]);
      beginAnimation();
    }
  });
}

function placeAnimatedMechMarker(pos) {
  if (animatedMechMarker) animatedMechMarker.setMap(null);

  animatedMechMarker = new google.maps.Marker({
    position: pos,
    map: map,
    icon: {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="20" fill="#ff2d55" stroke="#fff" stroke-width="3"/>
          <text x="22" y="28" text-anchor="middle" font-size="18" fill="#fff">🚗</text>
        </svg>
      `),
      scaledSize: new google.maps.Size(44, 44),
      anchor: new google.maps.Point(22, 22)
    },
    zIndex: 200
  });
}

function beginAnimation() {
  if (trackingInterval) clearInterval(trackingInterval);

  trackingInterval = setInterval(() => {
    routeStepIndex++;

    if (routeStepIndex >= routePath.length) {
      // Arrived!
      clearInterval(trackingInterval);
      trackingInterval = null;
      mechanicArrived();
      return;
    }

    const pos = routePath[routeStepIndex];
    if (animatedMechMarker) {
      animatedMechMarker.setPosition(pos);
    }

    // Update remaining distance / ETA
    const remaining = routePath.length - routeStepIndex;
    const progress = Math.round((routeStepIndex / routePath.length) * 100);
    const etaMin = Math.max(1, Math.round((remaining / routePath.length) * selectedMechanic.eta));
    document.getElementById('trackEta').textContent = etaMin + ' min';
    document.getElementById('trackEtaBadge').textContent = etaMin + ' min';

  }, 1500); // move every 1.5 seconds
}

function mechanicArrived() {
  setState('arrived');
  document.getElementById('arrivedOverlay').style.display = 'flex';
  document.getElementById('arrivedTitle').textContent = selectedMechanic.name + ' Has Arrived!';
  showToast('Your mechanic has arrived! 🎉', 'success');
}

function closeArrived() {
  document.getElementById('arrivedOverlay').style.display = 'none';
  cancelRequest();
}

/* ═══════════════════════════════════════════
   CANCEL REQUEST
   ═══════════════════════════════════════════ */

function cancelRequest() {
  if (trackingInterval) { clearInterval(trackingInterval); trackingInterval = null; }
  if (animatedMechMarker) { animatedMechMarker.setMap(null); animatedMechMarker = null; }
  directionsRenderer.setDirections({ routes: [] });
  routePath = [];
  routeStepIndex = 0;
  selectedMechanic = null;
  map.setCenter({ lat: userLat, lng: userLng });
  map.setZoom(15);
  setState('browse');
  showToast('Request cancelled.', 'info');
}

/* ═══════════════════════════════════════════
   STATE MANAGEMENT
   ═══════════════════════════════════════════ */

function setState(state) {
  currentState = state;
  const states = ['stateBrowse', 'stateSelected', 'stateSearching', 'stateTracking'];
  states.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  switch(state) {
    case 'browse':    document.getElementById('stateBrowse').style.display = 'block'; break;
    case 'selected':  document.getElementById('stateSelected').style.display = 'block'; break;
    case 'searching': document.getElementById('stateSearching').style.display = 'block'; break;
    case 'tracking':  document.getElementById('stateTracking').style.display = 'block'; break;
  }
}

/* ═══════════════════════════════════════════
   GARAGE OWNER FLOW
   ═══════════════════════════════════════════ */

async function loadCustomerRequests() {
  // Dummy customer requests near the garage
  const requests = [
    { id: 'REQ-01', user_name: 'Arun M.', service: 'Engine Diagnosis', latitude: userLat + 0.008, longitude: userLng + 0.005, distance: 1.2, is_emergency: true },
    { id: 'REQ-02', user_name: 'Priya K.', service: 'Flat Tire Repair', latitude: userLat - 0.006, longitude: userLng - 0.003, distance: 2.1, is_emergency: false },
    { id: 'REQ-03', user_name: 'Sameer J.', service: 'Battery Jump Start', latitude: userLat + 0.003, longitude: userLng - 0.007, distance: 0.8, is_emergency: false },
  ];

  if (requests.length === 0) {
    document.getElementById('goStateIncoming').style.display = 'none';
    document.getElementById('goStateEmpty').style.display = 'block';
    return;
  }

  goCurrentRequest = requests[0];
  showIncomingRequest(goCurrentRequest);

  // Show all request markers on map
  requests.forEach(req => {
    const marker = new google.maps.Marker({
      position: { lat: req.latitude, lng: req.longitude },
      map: map,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
            <rect x="2" y="2" width="36" height="36" rx="10" fill="#1a1a28" stroke="#ff2d55" stroke-width="2"/>
            <text x="20" y="26" text-anchor="middle" font-size="18">🚨</text>
          </svg>
        `),
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 20)
      },
      title: req.user_name,
      zIndex: 10
    });
    mechanicGMarkers.push(marker);
  });
}

function showIncomingRequest(req) {
  document.getElementById('goCustomerName').textContent = req.user_name;
  document.getElementById('goCustomerService').textContent = (req.is_emergency ? '🚨 EMERGENCY · ' : '') + req.service;
  document.getElementById('goCustomerDist').textContent = req.distance + ' km away';
  document.getElementById('goStateIncoming').style.display = 'block';
  document.getElementById('goStateNavigating').style.display = 'none';
  document.getElementById('goStateEmpty').style.display = 'none';
}

function acceptRequest() {
  if (!goCurrentRequest) return;

  showToast('Request accepted! Navigating to customer...', 'success');
  document.getElementById('goNavName').textContent = goCurrentRequest.user_name;
  document.getElementById('goNavService').textContent = goCurrentRequest.service;

  document.getElementById('goStateIncoming').style.display = 'none';
  document.getElementById('goStateNavigating').style.display = 'block';

  // Draw route to customer
  if (goRouteRenderer) goRouteRenderer.setMap(null);
  goRouteRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: true,
    polylineOptions: { strokeColor: '#2ed573', strokeWeight: 5, strokeOpacity: 0.8 }
  });

  directionsService.route({
    origin: { lat: userLat, lng: userLng },
    destination: { lat: goCurrentRequest.latitude, lng: goCurrentRequest.longitude },
    travelMode: google.maps.TravelMode.DRIVING
  }, (result, status) => {
    if (status === 'OK') {
      goRouteRenderer.setDirections(result);
      const leg = result.routes[0].legs[0];
      document.getElementById('goNavDist').textContent = leg.distance.text;
      document.getElementById('goNavEtaVal').textContent = leg.duration.text;
      document.getElementById('goNavEta').textContent = leg.duration.text;
      map.fitBounds(result.routes[0].bounds);
    } else {
      document.getElementById('goNavDist').textContent = goCurrentRequest.distance + ' km';
      document.getElementById('goNavEtaVal').textContent = estimateETA(goCurrentRequest.distance) + ' min';
      document.getElementById('goNavEta').textContent = estimateETA(goCurrentRequest.distance) + ' min';
    }
  });
}

function rejectRequest() {
  showToast('Request rejected.', 'info');
  goCurrentRequest = null;
  document.getElementById('goStateIncoming').style.display = 'none';
  document.getElementById('goStateEmpty').style.display = 'block';
}

function finishNavigation() {
  if (goRouteRenderer) goRouteRenderer.setMap(null);
  document.getElementById('arrivedOverlay').style.display = 'flex';
  document.getElementById('arrivedTitle').textContent = 'You Have Arrived!';
  document.getElementById('arrivedText').textContent = 'You are at the customer location. Begin the repair service.';
}

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */

function interpolatePoints(start, end, steps) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t
    });
  }
  return points;
}
