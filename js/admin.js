/* ═══════════════════════════════════════════════════
   VRS Admin — Dashboard Management
   ═══════════════════════════════════════════════════ */

const API_BASE = '/api/admin';

/**
 * Initialize admin dashboard
 */
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadMechanics('all');
  loadReviews('all');
  loadBookings();
});

// ── Stats ──

async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    const data = await res.json();

    if (data.success) {
      document.getElementById('statVerified').textContent = data.stats.verifiedMechanics;
      document.getElementById('statPending').textContent = data.stats.pendingApprovals;
      document.getElementById('statFlagged').textContent = data.stats.flaggedReviews;
      document.getElementById('statBookings').textContent = data.stats.totalBookings;
    }
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// ── Tab Switching ──

function switchAdminTab(tab) {
  const tabs = ['mechanics', 'reviews', 'bookings'];
  tabs.forEach(t => {
    document.getElementById(`tab${capitalize(t)}`).classList.toggle('active', t === tab);
    document.getElementById(`panel${capitalize(t)}`).classList.toggle('hidden', t !== tab);
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Mechanics Management ──

async function loadMechanics(filter = 'all') {
  try {
    const res = await fetch(`${API_BASE}/mechanics?filter=${filter}`);
    const data = await res.json();

    if (data.success) {
      renderMechanics(data.mechanics);
    }
  } catch (err) {
    console.error('Error loading mechanics:', err);
  }
}

function renderMechanics(mechanics) {
  const container = document.getElementById('mechanicsList');
  if (!container) return;

  if (mechanics.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">No mechanics to display</div></div>';
    return;
  }

  container.innerHTML = mechanics.map(m => `
    <div class="admin-mechanic-card mb-md ${m.verified ? 'verified' : 'pending'}">
      <div class="admin-mechanic-header">
        <div class="mechanic-avatar" style="width:48px;height:48px;">${m.name.charAt(0)}</div>
        <div class="admin-mechanic-info">
          <div class="admin-mechanic-name">
            ${m.name}
            ${m.verified
              ? '<span class="verified-badge">✅ Verified</span>'
              : '<span class="unverified-badge">⏳ Pending</span>'}
          </div>
          <div class="admin-mechanic-detail">${m.specialization} · ${m.phone}</div>
          <div class="admin-mechanic-meta">
            <span>⭐ ${m.rating} (${m.total_reviews} reviews)</span>
            <span>🔧 ${m.completed_bookings} jobs</span>
            <span class="trust-score trust-level-${getTrustLevel(m.trust_score)}">🛡️ ${m.trust_score}</span>
          </div>
        </div>
      </div>
      <div class="admin-mechanic-actions">
        ${m.verified
          ? `<button class="btn btn-sm btn-outline admin-btn-reject" onclick="rejectMechanic(${m.id}, '${m.name}')">❌ Revoke Verification</button>`
          : `<button class="btn btn-sm btn-primary admin-btn-approve" onclick="approveMechanic(${m.id}, '${m.name}')">✅ Approve</button>
             <button class="btn btn-sm btn-outline admin-btn-reject" onclick="rejectMechanic(${m.id}, '${m.name}')">❌ Reject</button>`
        }
      </div>
    </div>
  `).join('');
}

function filterMechanics(filter) {
  loadMechanics(filter);
  // Update button states
  document.querySelectorAll('#panelMechanics .admin-filter-group .btn').forEach(btn => {
    btn.className = 'btn btn-sm btn-outline';
  });
  event.target.className = 'btn btn-sm btn-primary';
}

async function approveMechanic(id, name) {
  if (!confirm(`Approve ${name} as a verified mechanic?`)) return;

  try {
    const res = await fetch(`${API_BASE}/mechanics/${id}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Approved by admin' })
    });
    const data = await res.json();

    if (data.success) {
      showToast(`${name} has been verified ✅`, 'success');
      loadMechanics('all');
      loadStats();
    } else {
      showToast(data.error || 'Failed to approve', 'error');
    }
  } catch (err) {
    showToast('Failed to approve mechanic', 'error');
  }
}

async function rejectMechanic(id, name) {
  if (!confirm(`Remove verification for ${name}?`)) return;

  try {
    const res = await fetch(`${API_BASE}/mechanics/${id}/reject`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Rejected by admin' })
    });
    const data = await res.json();

    if (data.success) {
      showToast(`${name} verification removed`, 'info');
      loadMechanics('all');
      loadStats();
    } else {
      showToast(data.error || 'Failed to reject', 'error');
    }
  } catch (err) {
    showToast('Failed to reject mechanic', 'error');
  }
}

// ── Reviews Management ──

async function loadReviews(filter = 'all') {
  try {
    const res = await fetch(`${API_BASE}/reviews?filter=${filter}`);
    const data = await res.json();

    if (data.success) {
      renderReviews(data.reviews);
    }
  } catch (err) {
    console.error('Error loading reviews:', err);
  }
}

function renderReviews(reviews) {
  const container = document.getElementById('reviewsList');
  if (!container) return;

  if (reviews.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⭐</div><div class="empty-state-title">No reviews to display</div></div>';
    return;
  }

  container.innerHTML = reviews.map(r => `
    <div class="admin-review-card mb-md ${r.is_flagged ? 'flagged' : ''}">
      <div class="admin-review-header">
        <div>
          <strong>${r.mechanic_name || 'Mechanic #' + r.mechanic_id}</strong>
          <span class="admin-review-rating">${'⭐'.repeat(r.rating)}</span>
          ${r.is_flagged ? '<span class="flagged-badge">🚩 Flagged</span>' : ''}
        </div>
        <span class="admin-review-date">${timeAgo(r.created_at)}</span>
      </div>
      <p class="admin-review-comment">${r.comment}</p>
      <div class="admin-review-meta">
        <span>Booking: ${r.booking_id}</span>
        <span>User: ${r.user_id}</span>
      </div>
      <div class="admin-review-actions">
        <button class="btn btn-sm btn-outline" onclick="flagReview(${r.id})">
          ${r.is_flagged ? '🔓 Unflag' : '🚩 Flag'}
        </button>
        <button class="btn btn-sm btn-outline admin-btn-reject" onclick="deleteReview(${r.id})">🗑️ Remove</button>
      </div>
    </div>
  `).join('');
}

function filterReviews(filter) {
  loadReviews(filter);
  document.querySelectorAll('#panelReviews .admin-filter-group .btn').forEach(btn => {
    btn.className = 'btn btn-sm btn-outline';
  });
  event.target.className = 'btn btn-sm btn-primary';
}

async function flagReview(id) {
  try {
    const res = await fetch(`${API_BASE}/reviews/${id}/flag`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'info');
      loadReviews('all');
      loadStats();
    }
  } catch (err) {
    showToast('Failed to flag review', 'error');
  }
}

async function deleteReview(id) {
  if (!confirm('Remove this review permanently?')) return;

  try {
    const res = await fetch(`${API_BASE}/reviews/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();

    if (data.success) {
      showToast('Review removed', 'success');
      loadReviews('all');
      loadStats();
    }
  } catch (err) {
    showToast('Failed to remove review', 'error');
  }
}

// ── Bookings Monitor ──

async function loadBookings() {
  try {
    const res = await fetch(`${API_BASE}/bookings`);
    const data = await res.json();

    if (data.success) {
      renderBookings(data.bookings);
    }
  } catch (err) {
    console.error('Error loading bookings:', err);
  }
}

function renderBookings(bookings) {
  const container = document.getElementById('bookingsList');
  if (!container) return;

  if (bookings.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">No bookings to display</div></div>';
    return;
  }

  const statusColors = {
    pending: '#f59e0b',
    accepted: '#3b82f6',
    in_progress: '#8b5cf6',
    completed: '#22c55e',
    cancelled: '#ef4444'
  };

  container.innerHTML = bookings.map(b => `
    <div class="admin-booking-card mb-md ${b.is_suspicious ? 'suspicious' : ''}">
      <div class="admin-booking-header">
        <div>
          <strong>${b.id}</strong>
          <span class="badge" style="background:${statusColors[b.status]}20;color:${statusColors[b.status]};">${b.status}</span>
          ${b.is_suspicious ? '<span class="flagged-badge">⚠️ Suspicious</span>' : ''}
        </div>
        <span class="admin-review-date">${timeAgo(b.created_at)}</span>
      </div>
      <div class="admin-booking-detail">
        <span>🔧 ${b.mechanic_name || 'Mechanic #' + b.mechanic_id}</span>
        <span>📋 ${b.service || 'N/A'}</span>
        <span>💰 ${b.total_price ? formatCurrency(b.total_price) : 'N/A'}</span>
        <span>👤 ${b.user_id}</span>
      </div>
    </div>
  `).join('');
}

// ── Add Mechanic Modal ──

function showAddMechanicModal() {
  const modal = document.getElementById('addMechanicModal');
  if (modal) modal.classList.remove('hidden');
}

function closeAddMechanicModal() {
  const modal = document.getElementById('addMechanicModal');
  if (modal) {
    modal.classList.add('hidden');
    document.getElementById('addMechanicForm').reset();
  }
}

async function submitAddMechanic(e) {
  e.preventDefault();
  const btn = document.getElementById('addMechanicBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const newMechanic = {
    name: document.getElementById('mechName').value,
    phone: document.getElementById('mechPhone').value,
    specialization: document.getElementById('mechSpec').value,
    latitude: document.getElementById('mechLat').value,
    longitude: document.getElementById('mechLng').value,
    verified: document.getElementById('mechVerified').checked
  };

  try {
    const res = await fetch(`${API_BASE}/mechanics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMechanic)
    });
    
    const data = await res.json();
    if (data.success) {
      showToast('Mechanic added successfully', 'success');
      closeAddMechanicModal();
      loadMechanics('all');
      loadStats();
    } else {
      showToast(data.error || 'Failed to add mechanic', 'error');
    }
  } catch (err) {
    showToast('Network error, could not add mechanic', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Mechanic';
  }
}
