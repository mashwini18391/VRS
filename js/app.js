/* ═══════════════════════════════════════════════════
   VRS App — Entry Point & Global Init
   ═══════════════════════════════════════════════════ */

<<<<<<< HEAD
// Initialize global theme from storage
if (localStorage.getItem('theme') === 'light') {
  document.body.classList.add('light-theme');
}

// GLOBAL DUMMY DATASOURCE
const dummyBookings = [
  { id: 'BKG-01', mechanic: 'Ramesh Auto Works', issue: 'Engine Overheating', date: 'Oct 24, 2026', amount: '₹1200', status: 'completed' },
  { id: 'BKG-02', mechanic: 'QuickFix Motors', issue: 'Flat Tire', date: 'Oct 25, 2026', amount: '₹300', status: 'cancelled' },
  { id: 'BKG-03', mechanic: 'A1 Garage', issue: 'Battery Replacement', date: 'Oct 26, 2026', amount: '₹4500', status: 'completed' },
  { id: 'BKG-04', mechanic: 'City Roadside', issue: 'Brake Pad Change', date: 'Oct 27, 2026', amount: '₹1800', status: 'pending' },
  { id: 'BKG-05', mechanic: 'Highway Help', issue: 'Oil Leak', date: 'Oct 28, 2026', amount: '₹2200', status: 'pending' },
  { id: 'BKG-06', mechanic: 'Super Repair', issue: 'Suspension Check', date: 'Oct 29, 2026', amount: '₹5500', status: 'cancelled' }
];

=======
>>>>>>> 792c9bf5557c932829c314716be1f2369dc0acf9
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
