/* ═══════════════════════════════════════════════════
   VRS Booking — Trust & Fixed Pricing System
   ═══════════════════════════════════════════════════ */

let selectedVehicle = 'car';
let selectedIssue = null;
let selectedMechanic = null;
let isEmergency = false;

/**
 * Initialize booking page
 */
function initBookingPage() {
  // Check if emergency mode
  isEmergency = getUrlParam('emergency') === 'true';
  if (isEmergency) {
    const banner = document.getElementById('emergencyBanner');
    if (banner) banner.style.display = 'block';
  }

  // Check if a mechanic was pre-selected from map
  const mechanicId = getUrlParam('mechanic');
  if (mechanicId) {
    // Only allow verified mechanics
    const mechanic = DUMMY_MECHANICS.find(m => m.id === parseInt(mechanicId) && m.verified);
    if (mechanic) {
      selectedMechanic = mechanic;
    } else {
      showToast('Selected mechanic is not verified. Please choose a verified mechanic.', 'warning');
    }
  }

  // Detect user location — GPS ONLY
  detectLocation();

  // Load available verified mechanics
  loadAvailableMechanics();
}

/**
 * Detect user location for the booking — GPS ONLY, no manual input
 */
function detectLocation() {
  const locationEl = document.getElementById('userLocation');

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (locationEl) {
          locationEl.innerHTML = `<span class="location-gps">📍 ${pos.coords.latitude.toFixed(4)}°N, ${pos.coords.longitude.toFixed(4)}°E</span>
            <span class="location-source">via GPS</span>`;
        }
      },
      () => {
        if (locationEl) {
          locationEl.innerHTML = `<span class="location-gps">📍 18.5204°N, 73.8567°E</span>
            <span class="location-source">Default (GPS unavailable)</span>`;
        }
      },
      { timeout: 5000 }
    );
  } else {
    if (locationEl) {
      locationEl.innerHTML = `<span class="location-gps">📍 18.5204°N, 73.8567°E</span>
        <span class="location-source">Default (GPS not supported)</span>`;
    }
  }
}

/**
 * Select vehicle type
 */
function selectVehicle(element) {
  // Remove previous selection
  document.querySelectorAll('.vehicle-option').forEach(opt => opt.classList.remove('selected'));
  element.classList.add('selected');
  selectedVehicle = element.dataset.vehicle;
  updatePrice();
}

/**
 * Select issue type
 */
function selectIssue(element) {
  // Remove previous selection
  document.querySelectorAll('.issue-option').forEach(opt => opt.classList.remove('selected'));
  element.classList.add('selected');
  selectedIssue = element.dataset.issue;
  updatePrice();
  validateBooking();
}

/**
 * Load available mechanics — ONLY VERIFIED mechanics shown
 */
function loadAvailableMechanics() {
  const container = document.getElementById('availableMechanics');
  if (!container) return;

  const userLat = 18.5204;
  const userLng = 73.8567;

  // Only show verified + available mechanics
  const mechanics = DUMMY_MECHANICS
    .filter(m => m.is_available && m.verified)
    .map(m => ({
      ...m,
      distance: haversineDistance(userLat, userLng, m.latitude, m.longitude),
      eta: estimateETA(haversineDistance(userLat, userLng, m.latitude, m.longitude))
    }))
    .sort((a, b) => a.distance - b.distance);

  container.innerHTML = mechanics.map(m => `
    <div class="mechanic-card mb-md ${selectedMechanic?.id === m.id ? 'selected' : ''}"
         onclick="chooseMechanic(${m.id})"
         id="mechanic-card-${m.id}"
         style="${selectedMechanic?.id === m.id ? 'border-color:var(--emergency-blue);background:var(--emergency-blue-soft);' : ''}">
      <div class="mechanic-avatar">${m.name.charAt(0)}</div>
      <div class="mechanic-info">
        <div class="mechanic-name">
          ${m.name}
          <span class="verified-badge">✅ Verified</span>
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
 * Choose a mechanic — only verified mechanics allowed
 */
function chooseMechanic(mechanicId) {
  const mechanic = DUMMY_MECHANICS.find(m => m.id === mechanicId);

  if (!mechanic) return;

  if (!mechanic.verified) {
    showToast('Cannot select unverified mechanic. Only verified mechanics are available.', 'warning');
    return;
  }

  selectedMechanic = mechanic;

  // Update UI
  document.querySelectorAll('#availableMechanics .mechanic-card').forEach(card => {
    card.style.borderColor = '';
    card.style.background = '';
  });

  const selected = document.getElementById(`mechanic-card-${mechanicId}`);
  if (selected) {
    selected.style.borderColor = 'var(--emergency-blue)';
    selected.style.background = 'var(--emergency-blue-soft)';
  }

  updatePrice();
  validateBooking();
}

/**
 * Update price based on selections — FIXED PRICING from services table
 * Mechanics CANNOT modify prices dynamically
 */
function updatePrice() {
  const pricingSection = document.getElementById('pricingSection');
  if (!pricingSection) return;

  if (selectedIssue && selectedMechanic) {
    pricingSection.style.display = 'block';

    // Find matching service from FIXED pricing table
    const issueServiceMap = {
      'flat-tire': 'tire',
      'battery': 'battery',
      'engine': 'engine',
      'brake': 'brake',
      'fuel': 'fuel',
      'other': 'other'
    };

    const category = issueServiceMap[selectedIssue] || 'other';
    const service = DUMMY_SERVICES.find(s => s.category === category);

    // Fixed pricing — no dynamic modification allowed
    const serviceCharge = service ? service.base_price : 1000;
    const visitFee = 200;
    const gst = Math.round((serviceCharge + visitFee) * 0.18);
    const total = serviceCharge + visitFee + gst;

    document.getElementById('serviceCharge').textContent = formatCurrency(serviceCharge);
    document.getElementById('visitFee').textContent = formatCurrency(visitFee);

    // Show GST if element exists
    const gstEl = document.getElementById('gstAmount');
    if (gstEl) gstEl.textContent = formatCurrency(gst);

    const partsEl = document.getElementById('partsCost');
    if (partsEl) partsEl.textContent = formatCurrency(0);

    document.getElementById('totalPrice').textContent = formatCurrency(total);

    // Show fixed pricing notice
    const priceNotice = document.getElementById('priceNotice');
    if (priceNotice) {
      priceNotice.style.display = 'block';
    }
  }
}

/**
 * Validate booking form
 */
function validateBooking() {
  const btn = document.getElementById('confirmBookingBtn');
  if (btn) {
    btn.disabled = !(selectedIssue && selectedMechanic);
  }
}

/**
 * Confirm booking
 */
function confirmBooking() {
  if (!selectedIssue || !selectedMechanic) {
    showToast('Please select an issue and mechanic', 'warning');
    return;
  }

  if (!selectedMechanic.verified) {
    showToast('Cannot book an unverified mechanic', 'error');
    return;
  }

  const description = document.getElementById('issueDesc')?.value || '';

  const booking = {
    id: 'BK' + generateId().toUpperCase(),
    vehicle: selectedVehicle,
    issue: selectedIssue,
    description: description,
    mechanic: selectedMechanic,
    isEmergency: isEmergency,
    timestamp: new Date().toISOString(),
    status: 'pending'
  };

  // Store booking
  localStorage.setItem('vrs_active_booking', JSON.stringify(booking));

  showToast(`Booking confirmed! ${selectedMechanic.name} (Verified ✅) is on the way.`, 'success');

  // Redirect to chat
  setTimeout(() => {
    window.location.href = 'chat.html';
  }, 1500);
}
