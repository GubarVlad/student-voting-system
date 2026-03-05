// Authentication Module
const AuthModule = {
  currentUser: null,
  userProfile: null,
  authInitialized: false,

  async init() {
    // Listen for auth state changes
    API.onAuthStateChange(async (user) => {
      // Check if we're on a public vote page - don't redirect
      if (this.isPublicVotePage()) {
        console.log('🔓 On public vote page, skipping auth redirect');
        this.authInitialized = true;
        return;
      }

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
      
      this.authInitialized = true;
    });
  },

  isPublicVotePage() {
    // Check if current URL is a public vote page
    const hash = window.location.hash;
    const pathname = window.location.pathname;
    
    // Check hash-based routing: /#/vote/xxxx
    if (hash && hash.includes('#/vote/')) {
      return true;
    }
    
    // Check path-based routing: /vote/xxxx
    if (pathname && pathname.includes('/vote/')) {
      return true;
    }
    
    return false;
  },

  async handleLogin(email, password) {
    const errorEl = document.getElementById('loginError');
    const btnEl = document.getElementById('btnLogin');
    
    try {
      errorEl.style.display = 'none';
      btnEl.disabled = true;
      btnEl.textContent = 'Вход...';

      const result = await API.loginUser(email, password);
      const user = result.user;

      // Check if first login
      const profile = await API.getUserProfile(user.uid);
      
      if (!profile || !profile.firstLoginCompleted) {
        // Show first login page
        showPage('firstLogin');
      } else {
        // **CRITICAL FIX:** Update AuthModule.userProfile BEFORE navigating
        // This ensures Router's role checks use correct profile data
        this.userProfile = profile;
        this.currentUser = user;
        
        // Determine which page to show based on role
        if (profile.role === 'admin') {
          showPage('admin');
        } else {
          showPage('member');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      errorEl.textContent = this.getErrorMessage(error.code);
      errorEl.style.display = 'block';
    } finally {
      btnEl.disabled = false;
      btnEl.textContent = 'Войти';
    }
  },

  async handleFirstLogin(fullName) {
    const errorEl = document.getElementById('firstLoginError');
    const btnEl = document.getElementById('btnCompleteProfile');
    
    try {
      errorEl.style.display = 'none';
      btnEl.disabled = true;
      btnEl.textContent = 'Сохранение...';

      const user = API.getCurrentUser();
      if (!user) throw new Error('Пользователь не найден');

      // **FIX:** Ensure role is set (default to 'member')
      const existingProfile = await API.getUserProfile(user.uid);
      const userRole = existingProfile?.role || 'member';

      // Update user profile
      await API.updateUserProfile(user.uid, {
        fullName,
        role: userRole,
        firstLoginCompleted: true,
        completedAt: new Date().toISOString()
      });

      // Refresh user profile
      this.userProfile = await API.getUserProfile(user.uid);
      this.currentUser = user;

      // Navigate based on role
      if (this.userProfile.role === 'admin') {
        showPage('admin');
      } else {
        showPage('member');
      }
    } catch (error) {
      console.error('First login error:', error);
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
    } finally {
      btnEl.disabled = false;
      btnEl.textContent = 'Продолжить к голосованию';
    }
  },

  async handleLogout() {
    try {
      await API.logoutUser();
      showPage('login');
      console.log('✅ Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  async handleGuestAccess(guestCode) {
    const errorEl = document.getElementById('guestLoginError');
    const btnEl = document.getElementById('btnGuestLogin');
    
    try {
      errorEl.style.display = 'none';
      btnEl.disabled = true;
      btnEl.textContent = 'Проверка...';

      // Validate guest code
      if (!guestCode || guestCode.trim().length === 0) {
        throw new Error('Пожалуйста, введите код доступа');
      }

      await API.validateGuestCode(guestCode);
      
      // Sign in anonymously with Firebase
      const result = await firebase.auth().signInAnonymously();
      const user = result.user;

      // Create guest user profile in Firestore
      const guestProfile = {
        role: 'member',
        fullName: 'Гость',
        firstLoginCompleted: true,
        guestCode: guestCode,
        createdAt: firebase.firestore.Timestamp.now()
      };

      await firebase.firestore()
        .collection('users')
        .doc(user.uid)
        .set(guestProfile);

      // Mark guest code as used
      await API.useGuestCode(guestCode, user.uid, 'Гость');

      // Manually set the user profile and navigate (don't rely on auth listener alone)
      this.currentUser = user;
      this.userProfile = guestProfile;
      
      console.log('✅ Guest access granted');
      
      // Navigate to member page
      showPage('member');
      document.getElementById('navbar').style.display = '';
      updateNavbar();
    } catch (error) {
      console.error('Guest login error:', error);
      errorEl.textContent = error.message || 'Ошибка входа';
      errorEl.style.display = 'block';
    } finally {
      btnEl.disabled = false;
      btnEl.textContent = 'Войти как гость';
    }
  },

  onLoginSuccess() {
    // Update UI
    document.getElementById('navbar').style.display = '';
    updateNavbar();
    
    // Determine what page to show
    if (!this.userProfile) return;

    if (!this.userProfile.firstLoginCompleted) {
      showPage('firstLogin');
    } else if (this.userProfile.role === 'admin') {
      showPage('admin');
    } else {
      showPage('member');
    }
  },

  onLogoutSuccess() {
    // Don't redirect if we're on a public vote page
    if (this.isPublicVotePage()) {
      console.log('🔓 On public vote page, skipping logout redirect');
      return;
    }

    // Hide navbar
    document.getElementById('navbar').style.display = 'none';
    
    // Reset forms
    const loginForm = document.getElementById('loginForm');
    const firstLoginForm = document.getElementById('firstLoginForm');
    if (loginForm) loginForm.reset();
    if (firstLoginForm) firstLoginForm.reset();
    
    // Show login page
    showPage('login');
  },

  getErrorMessage(code) {
    const messages = {
      'auth/user-not-found': 'Пользователь не найден. Проверьте email.',
      'auth/wrong-password': 'Неверный пароль. Попробуйте снова.',
      'auth/invalid-email': 'Некорректный email.',
      'auth/user-disabled': 'Этот аккаунт отключён.',
      'auth/too-many-requests': 'Слишком много попыток входа. Повторите позже.',
      'auth/email-already-in-use': 'Этот email уже используется.'
    };
    return messages[code] || 'Произошла ошибка. Попробуйте снова.';
  },

  isLoggedIn() {
    return !!this.currentUser;
  },

  isAdmin() {
    return this.userProfile?.role === 'admin';
  },

  isMember() {
    // Members include both regular members and guests (who have role='member')
    return this.userProfile?.role === 'member' || this.userProfile?.role === 'guest';
  },

  getUserName() {
    return this.userProfile?.fullName || this.currentUser?.email || 'Пользователь';
  }
};

// Initialize auth module when page loads
document.addEventListener('DOMContentLoaded', () => {
  AuthModule.init();
});

window.AuthModule = AuthModule;
