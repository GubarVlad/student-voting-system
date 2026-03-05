// Main Application Entry Point
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Initializing Student Council Voting System...');

  // Setup login form
  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    AuthModule.handleLogin(email, password);
  });

  // Setup first login form
  document.getElementById('firstLoginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fullName = document.getElementById('userFullName').value;
    if (document.getElementById('membershipConfirm').checked) {
      AuthModule.handleFirstLogin(fullName);
    }
  });

  // Check for URL parameters (QR code login)
  // With hash routing, params are in the hash: /#/login?user=...&pass=...
  const hash = window.location.hash;
  const queryStart = hash.indexOf('?');
  const urlParams = queryStart > -1 ? new URLSearchParams(hash.substring(queryStart)) : new URLSearchParams();
  
  if (urlParams.has('user')) {
    const email = urlParams.get('user');
    document.getElementById('loginEmail').value = email;
    
    // Auto-login if password is also provided
    if (urlParams.has('pass')) {
      const password = urlParams.get('pass');
      document.getElementById('loginPassword').value = password;
      // Trigger login automatically after a brief delay to ensure page is ready
      setTimeout(() => {
        AuthModule.handleLogin(email, password);
      }, 100);
    } else {
      document.getElementById('loginPassword').focus();
    }
  }

  console.log('✅ Application initialized successfully');
});

// Show loading spinner
function showLoading(show = true) {
  const spinner = document.getElementById('loadingSpinner');
  if (show) {
    spinner.style.display = 'flex';
  } else {
    spinner.style.display = 'none';
  }
}

// Utility function to show page (conflicts with Router, need to consolidate)
function showPage(pageName) {
  const pageMap = {
    loginPage: 'login',
    firstLoginPage: 'firstLogin',
    adminPage: 'admin',
    memberPage: 'member',
    resultsPage: 'results'
  };

  Router.navigate(pageMap[pageName] || pageName);
}

window.showLoading = showLoading;
window.showPage = showPage;
window.updateNavbar = updateNavbar;
