/* ═══════════════════════════════════════════════════
   VRS History — Repair History Management
   ═══════════════════════════════════════════════════ */

let currentFilter = 'all';
let currentHistory = [];
let hasFetchedHistory = false;

/**
 * Load repair history
 */
async function loadHistory(filter = 'all') {
  currentFilter = filter;
  const container = document.getElementById('historyList');
  const emptyState = document.getElementById('emptyHistory');
  if (!container) return;

  if (!hasFetchedHistory) {
    try {
      const userId = localStorage.getItem('user_id') || 'demo-user-123';
      const res = await fetch(`/api/bookings/user/${userId}`);
      const data = await res.json();
      
      if (data.success && data.bookings && data.bookings.length > 0) {
        currentHistory = data.bookings.map(b => ({
          id: b.id,
          status: b.status ? String(b.status).toLowerCase().trim() : 'pending',
          date: b.created_at,
          issue: b.issue_description || b.service_name || 'General Repair',
          mechanic: b.mechanic_name || 'Unknown Mechanic',
          vehicle: b.vehicle_type || 'car',
          cost: parseFloat(b.total_price) || 0,
          rating: null,
          review: null
        }));
      } else {
        throw new Error("No bookings found via API");
      }
    } catch (err) {
      console.warn('Failed to fetch history, falling back to dummy data:', err);
      currentHistory = typeof DUMMY_HISTORY !== 'undefined' ? JSON.parse(JSON.stringify(DUMMY_HISTORY)) : [];
      
      // Ensure we have dummy data for all statuses for filtering demonstration
      if (!currentHistory.find(h => String(h.status).toLowerCase() === 'pending')) {
        currentHistory.unshift({
          id: 'BK-PENDING-' + Math.floor(Math.random() * 1000),
          date: new Date().toISOString(),
          issue: 'Engine Diagnostics',
          mechanic: 'Pending Mechanic...',
          mechanic_verified: false,
          vehicle: 'Car',
          cost: 0,
          status: 'pending',
          rating: null,
          review: null
        });
      }
    }
    
    // Normalize existing statuses to ensure robust filtering
    currentHistory = currentHistory.map(h => ({
      ...h,
      status: h.status ? String(h.status).toLowerCase().trim() : 'unknown'
    }));
    
    hasFetchedHistory = true;
  }

  // Apply filter
  let displayHistory = currentHistory;
  const normalizedFilter = String(filter).toLowerCase().trim();
  
  if (normalizedFilter !== 'all') {
    displayHistory = currentHistory.filter(h => h.status === normalizedFilter);
  }

  if (displayHistory.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  container.innerHTML = displayHistory.map((item, index) => `
    <div class="history-card mb-md animate-slideUp" style="animation-delay:${index * 60}ms;" onclick="viewBookingDetail('${item.id}')">
      <div class="history-header">
        <span class="badge badge-${item.status}">${item.status}</span>
        <span class="history-date">${timeAgo(item.date)}</span>
      </div>
      <div class="history-body">
        <div class="history-issue">${item.issue}</div>
        <div class="history-mechanic">🔧 ${item.mechanic} • 🚗 ${item.vehicle}</div>
      </div>
      <div class="history-footer">
        ${item.rating ? `
          <div class="rating-display">
            <span class="rating-value">★ ${item.rating}.0</span>
          </div>
        ` : '<span></span>'}
        <span class="history-cost">${item.cost > 0 ? formatCurrency(item.cost) : '—'}</span>
      </div>
      ${item.review ? `
        <div style="margin-top:var(--space-sm);padding-top:var(--space-sm);border-top:1px solid var(--border-subtle);">
          <p style="font-size:var(--fs-xs);color:var(--text-tertiary);font-style:italic;">"${item.review}"</p>
        </div>
      ` : ''}
    </div>
  `).join('');
}

/**
 * Filter history by status
 */
function filterHistory(status, buttonEl) {
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.className = 'btn btn-sm btn-outline';
  });
  if (buttonEl) {
    buttonEl.className = 'btn btn-sm btn-primary';
  }

  loadHistory(status);
}

/**
 * View booking detail
 */
function viewBookingDetail(bookingId) {
  const booking = currentHistory.find(h => h.id === bookingId);
  if (!booking) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };

  overlay.innerHTML = `
    <div class="modal-sheet animate-slideUp">
      <div class="modal-handle"></div>
      <div class="modal-title">${booking.issue}</div>

      <div class="flex items-center gap-md mb-lg">
        <div class="mechanic-avatar" style="width:48px;height:48px;">🔧</div>
        <div>
          <div class="mechanic-name">${booking.mechanic}</div>
          <div class="text-muted" style="font-size:var(--fs-sm);">${new Date(booking.date).toLocaleDateString('en-IN', { dateStyle: 'long' })}</div>
        </div>
        <span class="badge badge-${booking.status}" style="margin-left:auto;">${booking.status}</span>
      </div>

      <div class="price-breakdown mb-lg">
        <div class="price-row">
          <span class="price-label">Vehicle</span>
          <span class="price-value">${booking.vehicle}</span>
        </div>
        <div class="price-row">
          <span class="price-label">Issue</span>
          <span class="price-value">${booking.issue}</span>
        </div>
        <div class="price-row">
          <span class="price-label">Status</span>
          <span class="price-value" style="text-transform:capitalize;">${booking.status}</span>
        </div>
        ${booking.cost > 0 ? `
          <div class="price-row total">
            <span class="price-label">Total Paid</span>
            <span class="price-value highlight">${formatCurrency(booking.cost)}</span>
          </div>
        ` : ''}
      </div>

      ${booking.rating ? `
        <div class="card mb-lg" style="padding:var(--space-md);">
          <div class="flex items-center gap-sm mb-sm">
            <span style="font-size:1.25rem;">★</span>
            <strong>Your Review</strong>
            <span class="rating-value" style="margin-left:auto;">${booking.rating}.0</span>
          </div>
          <p style="font-size:var(--fs-sm);color:var(--text-secondary);font-style:italic;">"${booking.review}"</p>
        </div>
      ` : `
        <button class="btn btn-outline btn-block mb-md" onclick="this.closest('.modal-overlay').remove(); showToast('Review feature coming soon', 'info');">
          ★ Write a Review
        </button>
      `}

      <button class="btn btn-ghost btn-block" onclick="this.closest('.modal-overlay').remove();">Close</button>
    </div>
  `;

  document.body.appendChild(overlay);
}
