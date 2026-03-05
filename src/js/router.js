// Client-side Router
const Router = {
  currentPage: null,

  async navigate(pageName, params = null) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
    });

    // Handle routing based on page name
    switch (pageName) {
      case 'login':
        this.showPage('loginPage');
        break;

      case 'firstLogin':
        this.showPage('firstLoginPage');
        break;

      case 'admin':
        if (!AuthModule.isLoggedIn() || !AuthModule.isAdmin()) {
          this.navigate('login');
          return;
        }
        this.showPage('adminPage');
        if (!window.adminInitialized) {
          AdminModule.init();
          window.adminInitialized = true;
        }
        break;

      case 'member':
        if (!AuthModule.isLoggedIn() || !AuthModule.isMember()) {
          this.navigate('login');
          return;
        }
        this.showPage('memberPage');
        if (!window.memberInitialized) {
          MemberModule.init();
          window.memberInitialized = true;
        }
        break;

      case 'results':
        if (!AuthModule.isLoggedIn()) {
          this.navigate('login');
          return;
        }
        this.showPage('resultsPage');
        if (params) {
          ResultsModule.init(params);
        }
        break;

      default:
        this.navigate('login');
    }

    this.currentPage = pageName;
    console.log('📍 Navigated to:', pageName);
  },

  showPage(pageId) {
    const page = document.getElementById(pageId);
    if (page) {
      page.classList.add('active');
    }
  },

  getCurrentPage() {
    return this.currentPage;
  }
};

// Update navbar
function updateNavbar() {
  const userInfo = document.getElementById('userInfo');
  const userName = AuthModule.getUserName();
  const role = AuthModule.isAdmin() ? 'Админ' : 'Участник';
  userInfo.textContent = `${userName} (${role})`;
}

// Handle logout button (other event listeners in app.js)
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('btnLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      AuthModule.handleLogout();
    });
  }

  // Login mode toggle (login form listeners handled in app.js)
  const toggleBtns = document.querySelectorAll('.toggle-btn');
  toggleBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const mode = btn.dataset.mode;
      
      // Update active button
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Show/hide forms
      document.querySelectorAll('.form[data-mode]').forEach(form => {
        form.style.display = form.dataset.mode === mode ? '' : 'none';
      });

      // Clear error messages
      const loginError = document.getElementById('loginError');
      const guestError = document.getElementById('guestLoginError');
      if (loginError) loginError.style.display = 'none';
      if (guestError) guestError.style.display = 'none';

      // Clear form inputs
      if (mode === 'regular') {
        const email = document.getElementById('loginEmail');
        const password = document.getElementById('loginPassword');
        if (email) email.value = '';
        if (password) password.value = '';
      } else {
        const guestCode = document.getElementById('guestCode');
        if (guestCode) guestCode.value = '';
      }
    });
  });
});

window.Router = Router;
