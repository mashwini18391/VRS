/* ═══════════════════════════════════════════════════
   VRS Booking — Trust & Fixed Pricing System
   ═══════════════════════════════════════════════════ */

let selectedVehicle = 'car';
let selectedIssue = null;
let selectedMechanic = null;
let isEmergency = false;

// Global loaded data
let availableMechanics = [];
let availableServices = [];

/**
 * Initialize booking page
 */
async function initBookingPage() {
  // Check if emergency mode
  isEmergency = getUrlParam('emergency') === 'true';
  if (isEmergency) {
    const banner = document.getElementById('emergencyBanner');
    if (banner) banner.style.display = 'block';
  }

  // Detect user location
  detectLocation();

  // Load services and mechanics
  await loadAvailableServices();
  await loadAvailableMechanics();

  // Check if a mechanic was pre-selected from map
  const mechanicId = getUrlParam('mechanic');
  if (mechanicId) {
    const mechanic = availableMechanics.find(m => m.id === parseInt(mechanicId));
    if (mechanic) {
      // Must wait for DOM to be populated
      setTimeout(() => chooseMechanic(mechanic.id), 100);
    } else {
      showToast('Selected mechanic is not verified or unavailable.', 'warning');
    }
  }
}

/**
 * Detect user location
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
  document.querySelectorAll('.vehicle-option').forEach(opt => opt.classList.remove('selected'));
  element.classList.add('selected');
  selectedVehicle = element.dataset.vehicle;
  updatePrice();
}

/**
 * Select issue type
 */
function selectIssue(element) {
  document.querySelectorAll('.issue-option').forEach(opt => opt.classList.remove('selected'));
  element.classList.add('selected');
  selectedIssue = element.dataset.issue;
  updatePrice();
  validateBooking();
}

/**
 * Load available services
 */
async function loadAvailableServices() {
  try {
    const res = await fetch('/api/services');
    const data = await res.json();
    if (data.success) {
      availableServices = data.services;
    }
  } catch (err) {
    console.error('Failed to load services:', err);
  }
}

/**
 * Load available mechanics
 */
async function loadAvailableMechanics() {
  const container = document.getElementById('availableMechanics');
  if (!container) return;

  const userLat = 18.5204;
  const userLng = 73.8567;

  try {
    const res = await fetch(`/api/mechanics/nearby?lat=${userLat}&lng=${userLng}`);
    const data = await res.json();
    if (data.success) {
      availableMechanics = data.mechanics;
    }
  } catch (err) {
    console.error('Failed to load mechanics', err);
  }

  container.innerHTML = availableMechanics.map(m => `
    <div class="mechanic-card mb-md ${selectedMechanic?.id === m.id ? 'selected' : ''}"
         onclick="chooseMechanic(${m.id})"
         id="mechanic-card-${m.id}"
         style="${selectedMechanic?.id === m.id ? 'border-color:var(--emergency-blue);background:var(--emergency-blue-soft);' : ''}">
      <div class="mechanic-avatar">${m.avatar_url ? `<img src="${m.avatar_url}" style="width:100%;border-radius:50%;">` : m.name.charAt(0)}</div>
      <div class="mechanic-info">
        <div class="mechanic-name">
          ${m.name}
          <span class="verified-badge">✅ Verified</span>
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
 * Choose a mechanic 
 */
function chooseMechanic(mechanicId) {
  const mechanic = availableMechanics.find(m => m.id === mechanicId);

  if (!mechanic) return;

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
 * Update price based on selections
 */
function updatePrice() {
  const pricingSection = document.getElementById('pricingSection');
  if (!pricingSection) return;

  if (selectedIssue && selectedMechanic) {
    pricingSection.style.display = 'block';

    const issueServiceMap = {
      'flat-tire': 'tire',
      'battery': 'battery',
      'engine': 'engine',
      'brake': 'brake',
      'fuel': 'fuel',
      'other': 'other'
    };

    const category = issueServiceMap[selectedIssue] || 'other';
    const service = availableServices.find(s => s.category === category);

    const serviceCharge = service ? parseFloat(service.base_price) : 1000;
    const visitFee = 200;
    const gst = Math.round((serviceCharge + visitFee) * 0.18);
    const total = serviceCharge + visitFee + gst;

    document.getElementById('serviceCharge').textContent = formatCurrency(serviceCharge);
    document.getElementById('visitFee').textContent = formatCurrency(visitFee);

    const gstEl = document.getElementById('gstAmount');
    if (gstEl) gstEl.textContent = formatCurrency(gst);

    const partsEl = document.getElementById('partsCost');
    if (partsEl) partsEl.textContent = formatCurrency(0);

    document.getElementById('totalPrice').textContent = formatCurrency(total);

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
 * Confirm booking using backend API
 */
async function confirmBooking() {
  if (!selectedIssue || !selectedMechanic) {
    showToast('Please select an issue and mechanic', 'warning');
    return;
  }

  const description = document.getElementById('issueDesc')?.value || '';
  
  const issueServiceMap = {
    'flat-tire': 'tire',
    'battery': 'battery',
    'engine': 'engine',
    'brake': 'brake',
    'fuel': 'fuel',
    'other': 'other'
  };
  const category = issueServiceMap[selectedIssue] || 'other';
  const service = availableServices.find(s => s.category === category);

  const btn = document.getElementById('confirmBookingBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-sm"></span> Processing...';
  }

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('vrs_token') // Optional auth
      },
      body: JSON.stringify({
        vehicle_type: selectedVehicle,
        issue_type: selectedIssue,
        issue_description: description,
        mechanic_id: selectedMechanic.id,
        service_id: service ? service.id : null,
        latitude: 18.5204, // Default or use GPS if tracked
        longitude: 73.8567,
        is_emergency: isEmergency
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showToast(`Booking confirmed! ${selectedMechanic.name} (Verified ✅) is on the way.`, 'success');
      
      // Store active booking ID for reference
      localStorage.setItem('vrs_active_booking_id', data.booking.id);
      
      // Redirect to chat
      setTimeout(() => {
        window.location.href = `chat.html?booking=${data.booking.id}`;
      }, 1500);
    } else {
      throw new Error(data.error || 'Failed to book');
    }
  } catch (err) {
    console.error('Booking error:', err);
    showToast('Failed to create booking. Please try again.', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Confirm Booking';
    }
  }
}
