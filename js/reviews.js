/* ═══════════════════════════════════════════════════
   VRS Reviews — Ratings & Review System
   Authentic Reviews with Booking Validation
   ═══════════════════════════════════════════════════ */

/**
 * Create star rating component
 * @param {string} containerId - ID of the container element
 * @param {Function} onChange - Callback with selected rating
 */
function createStarRating(containerId, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.className = 'stars';
  let currentRating = 0;

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('button');
    star.className = 'star';
    star.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    `;
    star.dataset.rating = i;

    star.addEventListener('click', () => {
      currentRating = i;
      updateStars(container, i);
      if (onChange) onChange(i);
    });

    star.addEventListener('mouseenter', () => {
      updateStars(container, i);
    });

    container.addEventListener('mouseleave', () => {
      updateStars(container, currentRating);
    });

    container.appendChild(star);
  }
}

/**
 * Update star visual state
 */
function updateStars(container, rating) {
  container.querySelectorAll('.star').forEach(star => {
    const val = parseInt(star.dataset.rating);
    if (val <= rating) {
      star.classList.add('filled');
      star.querySelector('svg').setAttribute('fill', 'currentColor');
    } else {
      star.classList.remove('filled');
      star.querySelector('svg').setAttribute('fill', 'none');
    }
  });
}

/**
 * Display readonly star rating
 */
function displayStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;

  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

/**
 * Submit a review — with booking validation
 */
async function submitReview(bookingId, mechanicId, rating, comment) {
  if (rating < 1 || rating > 5) {
    showToast('Please select a rating', 'warning');
    return false;
  }

  // Check if booking is completed before allowing review
  const booking = DUMMY_HISTORY.find(b => b.id === bookingId);
  if (!booking) {
    showToast('Cannot submit review: No booking found.', 'error');
    return false;
  }

  if (booking.status !== 'completed') {
    showToast('Cannot submit review: This booking is not yet completed.', 'warning');
    return false;
  }

  // Check if already reviewed
  if (booking.review) {
    showToast('You have already reviewed this booking.', 'warning');
    return false;
  }

  const review = {
    id: generateId(),
    booking_id: bookingId,
    mechanic_id: mechanicId,
    user_id: 'demo-user-123',
    rating: rating,
    comment: comment,
    created_at: new Date().toISOString()
  };

  try {
    // In production, this would POST to the API
    // await fetch('/api/reviews', { method: 'POST', body: JSON.stringify(review) });

    console.log('Review submitted:', review);
    showToast('Review submitted! Thank you. ⭐', 'success');
    return true;
  } catch (err) {
    console.error('Review submission error:', err);
    showToast('Failed to submit review. Try again.', 'error');
    return false;
  }
}

/**
 * Show review modal — with booking validation check
 */
function showReviewModal(bookingId, mechanicName) {
  // Check if booking exists and is completed
  const booking = DUMMY_HISTORY.find(b => b.id === bookingId);

  if (!booking) {
    showToast('Cannot write a review: Booking not found.', 'error');
    return;
  }

  if (booking.status !== 'completed') {
    showToast('Cannot write a review: This booking is not yet completed.', 'warning');
    return;
  }

  if (booking.review) {
    showToast('You have already reviewed this booking.', 'info');
    return;
  }

  let selectedRating = 0;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };

  overlay.innerHTML = `
    <div class="modal-sheet animate-slideUp">
      <div class="modal-handle"></div>
      <div class="modal-title">Rate Your Experience</div>

      <div class="text-center mb-lg">
        <div class="mechanic-avatar" style="width:64px;height:64px;margin:0 auto var(--space-md);">🔧</div>
        <div class="font-semibold">${mechanicName}</div>
        ${booking.mechanic_verified !== false ? '<span class="verified-badge" style="margin-top:4px;display:inline-block;">✅ Verified Mechanic</span>' : ''}
      </div>

      <div class="review-notice" style="background:var(--surface-secondary);border-radius:var(--radius-md);padding:var(--space-sm) var(--space-md);margin-bottom:var(--space-md);font-size:var(--fs-xs);color:var(--text-secondary);">
        ℹ️ Reviews are verified against completed bookings. Only one review per booking is allowed.
      </div>

      <div class="text-center mb-lg">
        <div id="reviewStars" style="display:inline-flex;gap:8px;font-size:2rem;"></div>
        <p class="text-muted mt-sm" id="ratingLabel">Tap to rate</p>
      </div>

      <div class="input-group">
        <label class="input-label" for="reviewComment">Your Review (optional)</label>
        <textarea class="input textarea" id="reviewComment" placeholder="Share your experience..."></textarea>
      </div>

      <button class="btn btn-primary btn-block mb-sm" onclick="handleSubmitReview('${bookingId}', this)">Submit Review</button>
      <button class="btn btn-ghost btn-block" onclick="this.closest('.modal-overlay').remove();">Cancel</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Initialize star rating
  const starsContainer = document.getElementById('reviewStars');
  const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('span');
    star.textContent = '☆';
    star.style.cursor = 'pointer';
    star.style.transition = 'transform 200ms, color 200ms';
    star.dataset.rating = i;

    star.addEventListener('click', () => {
      selectedRating = i;

      starsContainer.querySelectorAll('span').forEach(s => {
        const r = parseInt(s.dataset.rating);
        s.textContent = r <= i ? '★' : '☆';
        s.style.color = r <= i ? 'var(--warning)' : 'var(--text-tertiary)';
      });

      document.getElementById('ratingLabel').textContent = labels[i];
    });

    star.addEventListener('mouseenter', () => {
      star.style.transform = 'scale(1.3)';
    });
    star.addEventListener('mouseleave', () => {
      star.style.transform = 'scale(1)';
    });

    starsContainer.appendChild(star);
  }

  // Store rating for submit
  overlay.dataset.getRating = () => selectedRating;
  window._currentReviewRating = () => selectedRating;
}

/**
 * Handle review submission from modal
 */
async function handleSubmitReview(bookingId, button) {
  const rating = window._currentReviewRating ? window._currentReviewRating() : 0;
  const comment = document.getElementById('reviewComment')?.value || '';

  if (rating < 1) {
    showToast('Please select a star rating', 'warning');
    return;
  }

  button.disabled = true;
  button.innerHTML = '<span class="spinner" style="width:20px;height:20px;"></span> Submitting...';

  const success = await submitReview(bookingId, null, rating, comment);

  if (success) {
    const overlay = button.closest('.modal-overlay');
    if (overlay) {
      setTimeout(() => overlay.remove(), 500);
    }
  } else {
    button.disabled = false;
    button.textContent = 'Submit Review';
  }
}
