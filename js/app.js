/* ═══════════════════════════════════════════════════
   VRS App — Entry Point & Global Init
   ═══════════════════════════════════════════════════ */

/**
 * Initialize the app
 */
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  highlightActiveNav();
  addRippleToButtons();
});

/**
 * Highlight active nav item based on current page
 */
function highlightActiveNav() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  // Bottom nav
  document.querySelectorAll('.nav-item').forEach(item => {
    const href = item.getAttribute('href');
    if (href === currentPage) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Desktop nav
  document.querySelectorAll('.desktop-nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

/**
 * Add ripple effects to all buttons
 */
function addRippleToButtons() {
  document.querySelectorAll('.btn, .btn-primary, .btn-emergency').forEach(btn => {
    btn.addEventListener('click', addRipple);
  });
}

/**
 * Service Worker registration (optional for PWA)
 */
if ('serviceWorker' in navigator) {
  // Can be registered for offline support
  // navigator.serviceWorker.register('/sw.js');
}
