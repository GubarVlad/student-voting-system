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
  const role = AuthModule.isAdmin() ? 'Admin' : 'Member';
  userInfo.textContent = `${userName} (${role})`;
}

// Handle logout button
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnLogout').addEventListener('click', () => {
    AuthModule.handleLogout();
  });
});

window.Router = Router;
