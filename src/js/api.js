// API Layer - All Firebase operations
const API = {
  // ===== AUTH OPERATIONS =====
  
  loginUser(email, password) {
    return firebase.auth().signInWithEmailAndPassword(email, password);
  },

  logoutUser() {
    return firebase.auth().signOut();
  },

  onAuthStateChange(callback) {
    return firebase.auth().onAuthStateChanged(callback);
  },

  getCurrentUser() {
    return firebase.auth().currentUser;
  },

  // ===== USER OPERATIONS =====

  async getUserProfile(userId) {
    const doc = await firebase.firestore()
      .collection('users')
      .doc(userId)
      .get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async createUserProfile(userId, userData) {
    return firebase.firestore()
      .collection('users')
      .doc(userId)
      .set(userData, { merge: true });
  },

  async updateUserProfile(userId, userData) {
    return firebase.firestore()
      .collection('users')
      .doc(userId)
      .update(userData);
  },

  // ===== VOTE OPERATIONS =====

  async createVote(voteData) {
    return firebase.firestore()
      .collection('votes')
      .add({
        ...voteData,
        createdAt: firebase.firestore.Timestamp.now(),
        isOpen: false,
        isClosed: false
      });
  },

  async getVote(voteId) {
    const doc = await firebase.firestore()
      .collection('votes')
      .doc(voteId)
      .get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async getAllVotes() {
    const snapshot = await firebase.firestore()
      .collection('votes')
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async openVote(voteId) {
    return firebase.firestore()
      .collection('votes')
      .doc(voteId)
      .update({ isOpen: true });
  },

  async closeVote(voteId) {
    return firebase.firestore()
      .collection('votes')
      .doc(voteId)
      .update({ isOpen: false, isClosed: true });
  },

  subscribeToVote(voteId, callback) {
    return firebase.firestore()
      .collection('votes')
      .doc(voteId)
      .onSnapshot(doc => {
        if (doc.exists) {
          callback({ id: doc.id, ...doc.data() });
        }
      });
  },

  subscribeToActiveVote(callback) {
    return firebase.firestore()
      .collection('votes')
      .where('isOpen', '==', true)
      .limit(1)
      .onSnapshot(snapshot => {
        if (snapshot.docs.length > 0) {
          const doc = snapshot.docs[0];
          callback({ id: doc.id, ...doc.data() });
        } else {
          callback(null);
        }
      });
  },

  // ===== RESPONSE OPERATIONS =====

  async submitResponse(voteId, userId, selectedOption) {
    // Check if user already voted
    const existingVote = await firebase.firestore()
      .collection('responses')
      .where('voteId', '==', voteId)
      .where('userId', '==', userId)
      .get();

    if (!existingVote.empty) {
      throw new Error('You have already voted in this election');
    }

    return firebase.firestore()
      .collection('responses')
      .add({
        voteId,
        userId,
        selectedOption,
        timestamp: firebase.firestore.Timestamp.now()
      });
  },

  async getUserResponse(voteId, userId) {
    const snapshot = await firebase.firestore()
      .collection('responses')
      .where('voteId', '==', voteId)
      .where('userId', '==', userId)
      .get();
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  },

  subscribeToResponses(voteId, callback) {
    return firebase.firestore()
      .collection('responses')
      .where('voteId', '==', voteId)
      .onSnapshot(snapshot => {
        const responses = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(responses);
      });
  },

  async getVoteResponses(voteId) {
    const snapshot = await firebase.firestore()
      .collection('responses')
      .where('voteId', '==', voteId)
      .get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  },

  // ===== UTILITY FUNCTIONS =====

  calculateResults(responses, voteOptions) {
    const results = {
      totalResponses: responses.length,
      options: voteOptions.map(option => ({
        option,
        count: responses.filter(r => r.selectedOption === option).length,
        percentage: 0
      }))
    };

    // Calculate percentages
    results.options.forEach(option => {
      option.percentage = results.totalResponses > 0 
        ? (option.count / results.totalResponses) * 100 
        : 0;
    });

    return results;
  },

  formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  }
};

window.API = API;
