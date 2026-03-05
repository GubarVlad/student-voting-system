// Authentication Module
const AuthModule = {
  currentUser: null,
  userProfile: null,

  async init() {
    // Listen for auth state changes
    API.onAuthStateChange(async (user) => {
      this.currentUser = user;
      
      if (user) {
        // Get user profile from Firestore
        this.userProfile = await API.getUserProfile(user.uid);
        console.log('✅ User logged in:', user.email);
        this.onLoginSuccess();
      } else {
        this.userProfile = null;
        console.log('✅ User logged out');
        this.onLogoutSuccess();
      }
    });
  },

  async handleLogin(email, password) {
    const errorEl = document.getElementById('loginError');
    const btnEl = document.getElementById('btnLogin');
    
    try {
      errorEl.style.display = 'none';
      btnEl.disabled = true;
      btnEl.textContent = 'Logging in...';

      const result = await API.loginUser(email, password);
      const user = result.user;

      // Check if first login
      const profile = await API.getUserProfile(user.uid);
      
      if (!profile || !profile.firstLoginCompleted) {
        // Show first login page
        showPage('firstLoginPage');
      } else {
        // Determine which page to show based on role
        if (profile.role === 'admin') {
          showPage('adminPage');
        } else {
          showPage('memberPage');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      errorEl.textContent = this.getErrorMessage(error.code);
      errorEl.style.display = 'block';
    } finally {
      btnEl.disabled = false;
      btnEl.textContent = 'Login';
    }
  },

  async handleFirstLogin(fullName) {
    const errorEl = document.getElementById('firstLoginError');
    const btnEl = document.getElementById('btnCompleteProfile');
    
    try {
      errorEl.style.display = 'none';
      btnEl.disabled = true;
      btnEl.textContent = 'Saving...';

      const user = API.getCurrentUser();
      if (!user) throw new Error('No user found');

      // Update user profile
      await API.updateUserProfile(user.uid, {
        fullName,
        firstLoginCompleted: true,
        completedAt: new Date().toISOString()
      });

      // Refresh user profile
      this.userProfile = await API.getUserProfile(user.uid);

      // Navigate based on role
      if (this.userProfile.role === 'admin') {
        showPage('adminPage');
      } else {
        showPage('memberPage');
      }
    } catch (error) {
      console.error('First login error:', error);
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
    } finally {
      btnEl.disabled = false;
      btnEl.textContent = 'Continue to Voting';
    }
  },

  async handleLogout() {
    try {
      await API.logoutUser();
      showPage('loginPage');
      console.log('✅ Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  onLoginSuccess() {
    // Update UI
    document.getElementById('navbar').style.display = '';
    updateNavbar();
    
    // Determine what page to show
    if (!this.userProfile) return;

    if (!this.userProfile.firstLoginCompleted) {
      showPage('firstLoginPage');
    } else if (this.userProfile.role === 'admin') {
      showPage('adminPage');
    } else {
      showPage('memberPage');
    }
  },

  onLogoutSuccess() {
    // Hide navbar
    document.getElementById('navbar').style.display = 'none';
    
    // Reset forms
    document.getElementById('loginForm').reset();
    document.getElementById('firstLoginForm').reset();
    
    // Show login page
    showPage('loginPage');
  },

  getErrorMessage(code) {
    const messages = {
      'auth/user-not-found': 'User not found. Please check your email.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/too-many-requests': 'Too many login attempts. Please try again later.',
      'auth/email-already-in-use': 'This email is already in use.'
    };
    return messages[code] || 'An error occurred. Please try again.';
  },

  isLoggedIn() {
    return !!this.currentUser;
  },

  isAdmin() {
    return this.userProfile?.role === 'admin';
  },

  isMember() {
    return this.userProfile?.role === 'member';
  },

  getUserName() {
    return this.userProfile?.fullName || this.currentUser?.email || 'User';
  }
};

// Initialize auth module when page loads
document.addEventListener('DOMContentLoaded', () => {
  AuthModule.init();
});

window.AuthModule = AuthModule;
