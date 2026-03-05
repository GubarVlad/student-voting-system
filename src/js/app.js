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
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('user')) {
    const email = urlParams.get('user');
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginEmail').focus();
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
  Router.navigate(pageName);
}

window.showLoading = showLoading;
window.showPage = showPage;
window.updateNavbar = updateNavbar;
