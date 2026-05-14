/* ═══════════════════════════════════════════════════
   VRS Map — Google Maps JavaScript API
   Interactive map with dark theme
   ═══════════════════════════════════════════════════ */

let map = null;
let userMarker = null;
let userCircle = null;
let mechanicGMarkers = [];
let routePolyline = null;
let userLat = 11.9416;
let userLng = 79.8083;
let mechanicsWithDistance = [];
let filteredMechanics = [];
let selectedMechanic = null;
let currentState = 'browse';
let trackingInterval = null;
let animatedMechMarker = null;
let routePath = [];
let routeStepIndex = 0;
let infoWindow = null;
let directionsService = null;

// Garage Owner state
let goCurrentRequest = null;
let goRoutePolyline = null;

/* ═══════════════════════════════════════════
   DARK MAP STYLES
   ═══════════════════════════════════════════ */
const DARK_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#1d1d2b" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8b8b9b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1d1d2b" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a2a3d" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#8b8b9b" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6b6b7b" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a2e1a" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2a2a3d" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6b6b7b" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#333347" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3d3d55" }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#4a4a66" }] },
  { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#5b5b6b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d5c8c" }] },
];

/* ═══════════════════════════════════════════
   SHEET TOGGLE
   ═══════════════════════════════════════════ */
function toggleSheet() {
  const sheet = document.getElementById('carOwnerSheet');
  if (sheet) sheet.classList.toggle('collapsed');
}

/* ═══════════════════════════════════════════
   INIT MAP
   ═══════════════════════════════════════════ */
function initMap() {
  if (map) return;

  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: userLat, lng: userLng },
    zoom: 15,
    styles: DARK_MAP_STYLES,
    disableDefaultUI: true,
    zoomControl: true,
    zoomControlOptions: {
      position: google.maps.ControlPosition.RIGHT_CENTER,
    },
    fullscreenControl: false,
    gestureHandling: 'greedy',
    minZoom: 3,
    maxZoom: 20,
    clickableIcons: false,
  });

  directionsService = new google.maps.DirectionsService();
  infoWindow = new google.maps.InfoWindow();

  // ── Custom Map Controls ──
  addCustomControls();

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

  // ── Auto-start tracking if redirected from booking ──
  checkTrackingMode();
}

function checkTrackingMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('tracking') === 'true') {
    const trackingRaw = localStorage.getItem('vrs_tracking_data');
    if (trackingRaw) {
      try {
        const data = JSON.parse(trackingRaw);
        // Wait for map to be ready, then start tracking
        setTimeout(() => startTrackingFromBooking(data), 1500);
      } catch (e) { console.error('Invalid tracking data', e); }
    }
  }
}

function startTrackingFromBooking(data) {
  const mech = data.mechanic;
  // Set selectedMechanic so tracking functions work
  // parseFloat ensures coordinates are numbers (MySQL DECIMAL comes as strings)
  selectedMechanic = {
    id: mech.id,
    name: mech.name,
    specialization: mech.specialization,
    phone: mech.phone,
    rating: mech.rating,
    latitude: parseFloat(mech.latitude) || userLat,
    longitude: parseFloat(mech.longitude) || userLng,
    eta: 5
  };

  // Hide browse sheet, show tracking
  showToast(`${mech.name} is on the way! 🚗`, 'success');
  startTracking();
}

/* ═══════════════════════════════════════════
   CUSTOM MAP CONTROLS
   ═══════════════════════════════════════════ */
function addCustomControls() {
  const controlDiv = document.createElement('div');
  controlDiv.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-right:12px;margin-bottom:120px;';

  // Fullscreen
  const fsBtn = createControlButton('⛶', 'Toggle Fullscreen');
  fsBtn.id = 'customFsBtn';
  fsBtn.style.fontSize = '22px';
  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  });
  controlDiv.appendChild(fsBtn);

  // Update icon when fullscreen changes
  document.addEventListener('fullscreenchange', () => {
    fsBtn.textContent = document.fullscreenElement ? '⛶' : '⛶';
    fsBtn.title = document.fullscreenElement ? 'Exit Fullscreen' : 'Toggle Fullscreen';
  });

  // My Location — re-centers map on user's GPS position
  const locBtn = createControlButton('◎', 'My Location');
  locBtn.style.fontSize = '18px';
  locBtn.addEventListener('click', () => recenterMap());
  controlDiv.appendChild(locBtn);

  map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(controlDiv);
}

function createControlButton(text, title) {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.title = title;
  btn.style.cssText = `
    width:40px;height:40px;border-radius:10px;
    background:rgba(10,10,18,0.88);backdrop-filter:blur(12px);
    border:1px solid rgba(255,255,255,0.1);
    color:#e8e8ef;font-size:20px;font-weight:600;
    cursor:pointer;display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 8px rgba(0,0,0,0.4);transition:background 0.2s;
    font-family:'Inter',sans-serif;line-height:1;
  `;
  btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(30,30,48,0.95)');
  btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(10,10,18,0.88)');
  return btn;
}

/* ═══════════════════════════════════════════
   GET USER LOCATION
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
  if (userCircle) userCircle.setMap(null);

  userMarker = new google.maps.Marker({
    position: { lat: userLat, lng: userLng },
    map: map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: '#3b82f6',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 3,
    },
    zIndex: 1000,
    title: 'Your Location',
  });

  userCircle = new google.maps.Circle({
    center: { lat: userLat, lng: userLng },
    radius: 100,
    fillColor: '#3b82f6',
    fillOpacity: 0.08,
    strokeColor: '#3b82f6',
    strokeWeight: 1,
    strokeOpacity: 0.3,
    map: map,
    clickable: false,
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
  if (role === 'garage_owner') return loadCustomerRequests();

  clearMechanicMarkers();
  try {
    const res = await fetch(`/api/mechanics/nearby?lat=${userLat}&lng=${userLng}`);
    const data = await res.json();
    if (data.success && data.mechanics && data.mechanics.length > 0) {
      mechanicsWithDistance = data.mechanics;
    } else { throw new Error('No mechanics'); }
  } catch {
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
   SVG ICON HELPERS
   ═══════════════════════════════════════════ */
function makeSvgIcon(emoji, border = '#ff2d55', size = 40) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="10" fill="#1a1a28" stroke="${border}" stroke-width="2"/>
    <text x="${size/2}" y="${size*0.65}" text-anchor="middle" font-size="18">${emoji}</text></svg>`;
  return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(size, size), anchor: new google.maps.Point(size/2, size/2) };
}

function makeCircleIcon(emoji, bg = '#ff2d55', size = 44) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${size/2-2}" fill="${bg}" stroke="#fff" stroke-width="3"/>
    <text x="${size/2}" y="${size*0.63}" text-anchor="middle" font-size="18">${emoji}</text></svg>`;
  return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(size, size), anchor: new google.maps.Point(size/2, size/2) };
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
      icon: makeSvgIcon('🔧'),
      zIndex: 100,
      title: mech.name,
    });
    marker.addListener('click', () => {
      infoWindow.setContent(`
        <div style="background:#1a1a28;color:#e8e8ef;padding:12px 16px;border-radius:12px;font-family:'Inter',sans-serif;min-width:180px;">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${mech.name}</div>
          <div style="font-size:12px;color:#8b8b9b;margin-bottom:6px;">${mech.specialization}</div>
          <div style="display:flex;gap:12px;font-size:11px;color:#6b6b7b;">
            <span>⭐ ${mech.rating}</span><span>📍 ${formatDistance(mech.distance)}</span><span>⏱️ ${mech.eta} min</span>
          </div>
          <button onclick="selectMechanic(${mech.id})" style="margin-top:10px;width:100%;padding:8px;background:#ff2d55;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">Select Mechanic</button>
        </div>`);
      infoWindow.open(map, marker);
      selectMechanic(mech.id);
    });
    mechanicGMarkers.push(marker);
  });
  const countEl = document.getElementById('mechCount');
  if (countEl) countEl.textContent = filteredMechanics.length;
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
        <div class="mech-name">${m.name} ${m.verified ? '<span style="color:#2ed573;font-size:11px;">✓</span>' : ''}</div>
        <div class="mech-spec">${m.specialization}</div>
        <div class="mech-meta">
          <span>⭐ ${m.rating}</span><span>📍 ${formatDistance(m.distance)}</span><span>🛡️ ${m.trust_score}</span>
        </div>
      </div>
      <div class="mech-eta-box"><div class="mech-eta-val">${m.eta}</div><div class="mech-eta-lbl">min</div></div>
    </div>`).join('');
}

/* ═══════════════════════════════════════════
   SELECT MECHANIC
   ═══════════════════════════════════════════ */
function selectMechanic(id) {
  selectedMechanic = mechanicsWithDistance.find(m => m.id === id);
  if (!selectedMechanic) return;
  map.panTo({ lat: selectedMechanic.latitude, lng: selectedMechanic.longitude });
  map.setZoom(16);

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
  clearRoute();
  map.setCenter({ lat: userLat, lng: userLng });
  map.setZoom(15);
  infoWindow.close();
  setState('browse');
}

/* ═══════════════════════════════════════════
   ROUTE HELPERS
   ═══════════════════════════════════════════ */
function clearRoute() {
  if (routePolyline) { routePolyline.setMap(null); routePolyline = null; }
}

async function fetchRoute(fromLat, fromLng, toLat, toLng) {
  // Ensure all coordinates are valid numbers (MySQL DECIMAL returns strings)
  fromLat = parseFloat(fromLat);
  fromLng = parseFloat(fromLng);
  toLat = parseFloat(toLat);
  toLng = parseFloat(toLng);
  if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
    console.warn('fetchRoute: invalid coordinates', { fromLat, fromLng, toLat, toLng });
    return null;
  }

  // Try Google Directions
  try {
    const result = await new Promise((resolve, reject) => {
      directionsService.route({
        origin: { lat: fromLat, lng: fromLng },
        destination: { lat: toLat, lng: toLng },
        travelMode: google.maps.TravelMode.DRIVING,
      }, (resp, status) => { status === 'OK' ? resolve(resp) : reject(status); });
    });
    const leg = result.routes[0].legs[0];
    const coords = result.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
    return { coords, distanceKm: (leg.distance.value/1000).toFixed(1), durationMin: Math.round(leg.duration.value/60),
      distanceText: leg.distance.text, durationText: leg.duration.text };
  } catch (e) { console.warn('Google Directions failed, trying OSRM:', e); }

  // Fallback: OSRM
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes.length > 0) {
      const r = data.routes[0];
      const coords = r.geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
      return { coords, distanceKm: (r.distance/1000).toFixed(1), durationMin: Math.round(r.duration/60),
        distanceText: (r.distance/1000).toFixed(1)+' km', durationText: Math.round(r.duration/60)+' min' };
    }
  } catch (e) { console.warn('OSRM also failed:', e); }
  return null;
}

function drawRoute(coords, color = '#ff2d55') {
  clearRoute();
  routePolyline = new google.maps.Polyline({
    path: coords, geodesic: true, strokeColor: color, strokeOpacity: 0.9, strokeWeight: 5, map: map,
  });
  const bounds = new google.maps.LatLngBounds();
  coords.forEach(c => bounds.extend(c));
  map.fitBounds(bounds, { top: 80, bottom: 250, left: 30, right: 30 });
  return routePolyline;
}

/* ═══════════════════════════════════════════
   REPAIR DETAILS MODAL
   ═══════════════════════════════════════════ */
let repairInfo = { vehicleType: 'Car', repairType: 'Engine', description: '' };

function openRepairModal() {
  if (!selectedMechanic) return;
  // Reset defaults
  repairInfo = { vehicleType: 'Car', repairType: 'Engine', description: '' };
  document.getElementById('repairDescription').value = '';
  // Reset chip selections
  document.querySelectorAll('#vehicleChips .repair-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.value === 'Car');
  });
  document.querySelectorAll('#repairChips .repair-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.value === 'Engine');
  });
  document.getElementById('repairModal').style.display = 'flex';
}

function closeRepairModal() {
  document.getElementById('repairModal').style.display = 'none';
}

function selectChip(btn, groupId) {
  document.querySelectorAll('#' + groupId + ' .repair-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  if (groupId === 'vehicleChips') repairInfo.vehicleType = btn.dataset.value;
  if (groupId === 'repairChips') repairInfo.repairType = btn.dataset.value;
}

function submitRepairRequest() {
  repairInfo.description = document.getElementById('repairDescription').value.trim();
  closeRepairModal();
  requestService();
}

/* ═══════════════════════════════════════════
   REQUEST SERVICE
   ═══════════════════════════════════════════ */
function requestService() {
  if (!selectedMechanic) return;
  document.getElementById('searchMechName').textContent = selectedMechanic.name;
  setState('searching');
  console.log('📋 Repair request:', repairInfo);
  setTimeout(() => {
    if (currentState !== 'searching') return;
    showToast(`${selectedMechanic.name} accepted your request!`, 'success');
    startTracking();
  }, 3000 + Math.random() * 2000);
}

/* ═══════════════════════════════════════════
   LIVE TRACKING
   ═══════════════════════════════════════════ */
async function startTracking() {
  document.getElementById('trackAvatar').textContent = selectedMechanic.name.charAt(0);
  document.getElementById('trackName').textContent = selectedMechanic.name;
  document.getElementById('trackSpec').textContent = selectedMechanic.specialization;
  document.getElementById('trackPhone').textContent = '📞 ' + (selectedMechanic.phone || 'N/A');
  setState('tracking');
  document.getElementById('trackStatus').textContent = 'Mechanic En Route 🚗';

  const routeData = await fetchRoute(selectedMechanic.latitude, selectedMechanic.longitude, userLat, userLng);
  if (routeData) {
    drawRoute(routeData.coords);
    document.getElementById('trackDist').textContent = routeData.distanceText;
    document.getElementById('trackEta').textContent = routeData.durationText;
    document.getElementById('trackEtaBadge').textContent = routeData.durationText;
    routePath = routeData.coords;
  } else {
    showToast('Route unavailable — simulating path.', 'warning');
    document.getElementById('trackDist').textContent = formatDistance(selectedMechanic.distance);
    document.getElementById('trackEta').textContent = selectedMechanic.eta + ' min';
    document.getElementById('trackEtaBadge').textContent = selectedMechanic.eta + ' min';
    routePath = interpolatePoints({ lat: selectedMechanic.latitude, lng: selectedMechanic.longitude }, { lat: userLat, lng: userLng }, 30);
    drawRoute(routePath);
  }
  routeStepIndex = 0;
  placeAnimatedMechMarker(routePath[0]);
  beginAnimation();
}

function placeAnimatedMechMarker(pos) {
  if (animatedMechMarker) animatedMechMarker.setMap(null);
  animatedMechMarker = new google.maps.Marker({ position: pos, map: map, icon: makeCircleIcon('🚗'), zIndex: 2000 });
}

function beginAnimation() {
  if (trackingInterval) clearInterval(trackingInterval);
  trackingInterval = setInterval(() => {
    routeStepIndex++;
    if (routeStepIndex >= routePath.length) {
      clearInterval(trackingInterval); trackingInterval = null; mechanicArrived(); return;
    }
    if (animatedMechMarker) animatedMechMarker.setPosition(routePath[routeStepIndex]);
    const remaining = routePath.length - routeStepIndex;
    const etaMin = Math.max(1, Math.round((remaining / routePath.length) * selectedMechanic.eta));
    document.getElementById('trackEta').textContent = etaMin + ' min';
    document.getElementById('trackEtaBadge').textContent = etaMin + ' min';
  }, 1500);
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
  clearRoute();
  routePath = []; routeStepIndex = 0; selectedMechanic = null;
  map.setCenter({ lat: userLat, lng: userLng }); map.setZoom(15);
  if (infoWindow) infoWindow.close();
  setState('browse');
  showToast('Request cancelled.', 'info');
}

/* ═══════════════════════════════════════════
   STATE MANAGEMENT
   ═══════════════════════════════════════════ */
function setState(state) {
  currentState = state;
  ['stateBrowse','stateSelected','stateSearching','stateTracking'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
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
  requests.forEach(req => {
    const marker = new google.maps.Marker({
      position: { lat: req.latitude, lng: req.longitude }, map: map,
      icon: makeSvgIcon('🚨'), zIndex: 100, title: req.user_name,
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

async function acceptRequest() {
  if (!goCurrentRequest) return;
  showToast('Request accepted! Navigating to customer...', 'success');
  document.getElementById('goNavName').textContent = goCurrentRequest.user_name;
  document.getElementById('goNavService').textContent = goCurrentRequest.service;
  document.getElementById('goStateIncoming').style.display = 'none';
  document.getElementById('goStateNavigating').style.display = 'block';

  if (goRoutePolyline) { goRoutePolyline.setMap(null); goRoutePolyline = null; }
  const routeData = await fetchRoute(userLat, userLng, goCurrentRequest.latitude, goCurrentRequest.longitude);
  if (routeData) {
    goRoutePolyline = new google.maps.Polyline({
      path: routeData.coords, geodesic: true, strokeColor: '#2ed573', strokeOpacity: 0.8, strokeWeight: 5, map: map,
    });
    document.getElementById('goNavDist').textContent = routeData.distanceText;
    document.getElementById('goNavEtaVal').textContent = routeData.durationText;
    document.getElementById('goNavEta').textContent = routeData.durationText;
    const bounds = new google.maps.LatLngBounds();
    routeData.coords.forEach(c => bounds.extend(c));
    map.fitBounds(bounds, { top: 80, bottom: 250, left: 30, right: 30 });
  } else {
    document.getElementById('goNavDist').textContent = goCurrentRequest.distance + ' km';
    document.getElementById('goNavEtaVal').textContent = estimateETA(goCurrentRequest.distance) + ' min';
    document.getElementById('goNavEta').textContent = estimateETA(goCurrentRequest.distance) + ' min';
  }
}

function rejectRequest() {
  showToast('Request rejected.', 'info');
  goCurrentRequest = null;
  document.getElementById('goStateIncoming').style.display = 'none';
  document.getElementById('goStateEmpty').style.display = 'block';
}

function finishNavigation() {
  if (goRoutePolyline) { goRoutePolyline.setMap(null); goRoutePolyline = null; }
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
    points.push({ lat: start.lat + (end.lat - start.lat) * t, lng: start.lng + (end.lng - start.lng) * t });
  }
  return points;
}
