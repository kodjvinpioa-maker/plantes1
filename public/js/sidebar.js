// public/js/sidebar.js
(function () {
  const sidebar = document.getElementById('app-sidebar');
  const toggle = document.getElementById('sidebar-toggle');

  if (!sidebar || !toggle) return;

  let isTouch = false;
  window.addEventListener('touchstart', () => { isTouch = true; }, {passive:true});

  // Desktop: open on pointerenter, close on pointerleave
  sidebar.addEventListener('pointerenter', (e) => {
    if (isTouch) return;
    sidebar.classList.add('open');
    sidebar.setAttribute('aria-expanded','true');
    toggle.setAttribute('aria-expanded','true');
    document.body.classList.add('sidebar-open');
  });

  sidebar.addEventListener('pointerleave', (e) => {
    if (isTouch) return;
    sidebar.classList.remove('open');
    sidebar.setAttribute('aria-expanded','false');
    toggle.setAttribute('aria-expanded','false');
    document.body.classList.remove('sidebar-open');
  });

  // Toggle on button (for touch & keyboard)
  toggle.addEventListener('click', (e) => {
    const opening = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', opening);
    sidebar.setAttribute('aria-expanded', opening ? 'true' : 'false');
    toggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
    document.body.classList.toggle('sidebar-open', opening);
  });

  // Close on Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      sidebar.setAttribute('aria-expanded','false');
      toggle.setAttribute('aria-expanded','false');
      document.body.classList.remove('sidebar-open');
    }
  });

  // Close when clicking outside (for touch)
  document.addEventListener('click', (e) => {
    if (!sidebar.classList.contains('open')) return;
    if (sidebar.contains(e.target) || toggle.contains(e.target)) return;
    sidebar.classList.remove('open');
    sidebar.setAttribute('aria-expanded','false');
    toggle.setAttribute('aria-expanded','false');
    document.body.classList.remove('sidebar-open');
  });

  // Improve focus: when opening via keyboard, move focus to first link
  toggle.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !sidebar.classList.contains('open')) {
      setTimeout(() => {
        const first = sidebar.querySelector('.sidebar__link');
        if (first) first.focus();
      }, 10);
    }
  });

})();
