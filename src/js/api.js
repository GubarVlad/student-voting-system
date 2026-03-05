// API Layer - All Firebase operations
const API = {
  _chairmanCache: {
    userIds: [],
    loadedAt: 0
  },

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

  async generateDailyVoteNumber(createdAtTimestamp) {
    const createdAtDate = createdAtTimestamp.toDate
      ? createdAtTimestamp.toDate()
      : new Date(createdAtTimestamp);

    const dayStart = new Date(
      createdAtDate.getFullYear(),
      createdAtDate.getMonth(),
      createdAtDate.getDate(),
      0,
      0,
      0,
      0
    );
    const dayEnd = new Date(
      createdAtDate.getFullYear(),
      createdAtDate.getMonth(),
      createdAtDate.getDate(),
      23,
      59,
      59,
      999
    );

    const sameDayVotesSnapshot = await firebase.firestore()
      .collection('votes')
      .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(dayStart))
      .where('createdAt', '<=', firebase.firestore.Timestamp.fromDate(dayEnd))
      .get();

    const nextQuestionNumber = sameDayVotesSnapshot.size + 1;
    const month = createdAtDate.getMonth() + 1;
    const day = createdAtDate.getDate();

    return `${month}${day}${String(nextQuestionNumber).padStart(2, '0')}`;
  },

  async createVote(voteData) {
    const createdAt = firebase.firestore.Timestamp.now();
    const voteNumber = await this.generateDailyVoteNumber(createdAt);

    return firebase.firestore()
      .collection('votes')
      .add({
        ...voteData,
        createdAt,
        voteNumber,
        voteYear: createdAt.toDate().getFullYear(),
        isOpen: true,
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
      .onSnapshot(
        snapshot => {
          if (snapshot.docs.length > 0) {
            const doc = snapshot.docs[0];
            callback({ id: doc.id, ...doc.data() });
          } else {
            callback(null);
          }
        },
        error => {
          console.error('❌ Error subscribing to active vote:', error);
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);
          callback(null);
        }
      );
  },

  // ===== PUBLIC VOTING URL OPERATIONS (No Auth Required) =====

  async getPublicVote(voteId) {
    try {
      const doc = await firebase.firestore()
        .collection('votes')
        .doc(voteId)
        .get();
      
      if (!doc.exists) {
        throw new Error('Голосование не найдено');
      }
      
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error('❌ Error fetching public vote:', error);
      throw new Error('Ошибка при загрузке голосования: ' + error.message);
    }
  },

  async getPublicVoteByNumber(voteNumber) {
    try {
      const snapshot = await firebase.firestore()
        .collection('votes')
        .where('voteNumber', '==', voteNumber)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        throw new Error('Голосование не найдено');
      }
      
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error('❌ Error fetching public vote by number:', error);
      throw new Error('Ошибка при загрузке голосования: ' + error.message);
    }
  },

  async getPublicVoteResults(voteId) {
    try {
      const responses = await this.getVoteResponses(voteId);
      const vote = await this.getPublicVote(voteId);
      
      const results = this.calculateResults(responses, vote.options || []);
      
      return {
        vote,
        results,
        responses
      };
    } catch (error) {
      console.error('❌ Error fetching public vote results:', error);
      throw new Error('Ошибка при загрузке результатов: ' + error.message);
    }
  },

  subscribeToPublicVote(voteId, callback) {
    return firebase.firestore()
      .collection('votes')
      .doc(voteId)
      .onSnapshot(
        doc => {
          if (doc.exists) {
            callback({ id: doc.id, ...doc.data() });
          }
        },
        error => {
          console.error('❌ Error subscribing to public vote:', error);
          callback(null);
        }
      );
  },

  subscribeToPublicVoteResults(voteId, callback) {
    // Subscribe to vote
    const voteUnsubscribe = this.subscribeToPublicVote(voteId, async (vote) => {
      if (!vote) {
        callback({ vote: null, results: null });
        return;
      }
      
      // Subscribe to responses
      const responsesUnsubscribe = firebase.firestore()
        .collection('responses')
        .where('voteId', '==', voteId)
        .onSnapshot(snapshot => {
          const responses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          const results = this.calculateResults(responses, vote.options || []);
          
          callback({
            vote,
            results,
            responses
          });
        });
      
      return responsesUnsubscribe;
    });

    return voteUnsubscribe;
  },

  // ===== RESPONSE OPERATIONS =====

  async submitResponse(voteId, userId, selectedOption, userName = '') {
    // Validate inputs
    if (!voteId || !userId || !selectedOption) {
      throw new Error('Отсутствуют необходимые параметры голосования');
    }

    // Check if user already voted
    const existingVote = await firebase.firestore()
      .collection('responses')
      .where('voteId', '==', voteId)
      .where('userId', '==', userId)
      .get();

    if (!existingVote.empty) {
      throw new Error('Вы уже проголосовали в этом голосовании');
    }

    return firebase.firestore()
      .collection('responses')
      .add({
        voteId,
        userId,
        selectedOption,
        userName,
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

  getParticipantRoleLabel(user = {}) {
    if (user.position) return user.position;
    if (user.sector) return user.sector;

    const roleMap = {
      admin: 'Администратор',
      member: 'Участник',
      guest: 'Гость',
      chairman: 'Председатель'
    };

    return roleMap[user.role] || 'Участник';
  },

  isChairman(user = {}) {
    const normalizedRole = String(user.role || '').toLowerCase();
    const normalizedPosition = String(user.position || '').toLowerCase();
    const normalizedSector = String(user.sector || '').toLowerCase();

    return normalizedRole === 'chairman' ||
      normalizedPosition === 'председатель' ||
      normalizedSector === 'председатель';
  },

  async getChairmanUserIds(forceReload = false) {
    const cacheAgeMs = Date.now() - this._chairmanCache.loadedAt;
    if (!forceReload && cacheAgeMs < 30000 && this._chairmanCache.userIds.length > 0) {
      return this._chairmanCache.userIds;
    }

    const users = await this.getAllUsers(true);
    const chairmanUserIds = users
      .filter(user => this.isChairman(user))
      .map(user => user.uid);

    this._chairmanCache = {
      userIds: chairmanUserIds,
      loadedAt: Date.now()
    };

    return chairmanUserIds;
  },

  async getWinningOption(vote, responses, preCalculatedResults = null) {
    const results = preCalculatedResults || this.calculateResults(responses, vote.options || []);
    const maxVotes = Math.max(...results.options.map(option => option.count), 0);

    if (maxVotes === 0) {
      return {
        winnerOption: null,
        isTie: false,
        tieResolvedByChairman: false,
        tiedOptions: []
      };
    }

    const leaders = results.options
      .filter(option => option.count === maxVotes)
      .map(option => option.option);

    if (leaders.length === 1) {
      return {
        winnerOption: leaders[0],
        isTie: false,
        tieResolvedByChairman: false,
        tiedOptions: []
      };
    }

    const chairmanUserIds = await this.getChairmanUserIds();
    const chairmanResponse = responses.find(response =>
      chairmanUserIds.includes(response.userId) && leaders.includes(response.selectedOption)
    );

    if (chairmanResponse) {
      return {
        winnerOption: chairmanResponse.selectedOption,
        isTie: true,
        tieResolvedByChairman: true,
        tiedOptions: leaders
      };
    }

    return {
      winnerOption: leaders[0],
      isTie: true,
      tieResolvedByChairman: false,
      tiedOptions: leaders
    };
  },

  async getParticipantsWithVoteHistory(includeInactive = false) {
    const [participants, votesSnapshot, responsesSnapshot] = await Promise.all([
      this.getAllUsers(includeInactive),
      firebase.firestore().collection('votes').get(),
      firebase.firestore().collection('responses').get()
    ]);

    const voteById = new Map();
    votesSnapshot.docs.forEach(doc => {
      voteById.set(doc.id, { id: doc.id, ...doc.data() });
    });

    const responsesByVoteId = new Map();
    responsesSnapshot.docs.forEach(doc => {
      const response = doc.data();
      if (!responsesByVoteId.has(response.voteId)) {
        responsesByVoteId.set(response.voteId, []);
      }
      responsesByVoteId.get(response.voteId).push(response);
    });

    const outcomeByVoteId = new Map();
    await Promise.all(
      Array.from(voteById.values()).map(async (vote) => {
        const voteResponses = responsesByVoteId.get(vote.id) || [];
        const results = this.calculateResults(voteResponses, vote.options || []);
        const outcome = await this.getWinningOption(vote, voteResponses, results);
        outcomeByVoteId.set(vote.id, outcome);
      })
    );

    const historyByUserId = new Map();
    responsesSnapshot.docs.forEach(doc => {
      const response = doc.data();
      const vote = voteById.get(response.voteId);
      const outcome = outcomeByVoteId.get(response.voteId);
      if (!vote) return;

      if (!historyByUserId.has(response.userId)) {
        historyByUserId.set(response.userId, []);
      }

      historyByUserId.get(response.userId).push({
        voteId: response.voteId,
        voteNumber: vote.voteNumber || null,
        question: vote.question || 'Без названия',
        selectedOption: response.selectedOption,
        winnerOption: outcome?.winnerOption || null,
        tieResolvedByChairman: !!outcome?.tieResolvedByChairman,
        isSecret: !!vote.isSecret,
        timestamp: response.timestamp || null
      });
    });

    return participants.map(participant => {
      const voteHistory = (historyByUserId.get(participant.uid) || []).sort((a, b) => {
        const aTime = a.timestamp?.toMillis?.() || 0;
        const bTime = b.timestamp?.toMillis?.() || 0;
        return bTime - aTime;
      });

      return {
        ...participant,
        roleLabel: this.getParticipantRoleLabel(participant),
        isChairman: this.isChairman(participant),
        votesCount: voteHistory.length,
        voteHistory
      };
    });
  },

  formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  },

  // ===== PARTICIPANTS MANAGEMENT =====

  /**
   * Get all users who have completed first login
   * @param {boolean} includeInactive - Whether to include deactivated users (default: false)
   * @returns {Promise<Array>} Array of user objects with uid
   */
  async getAllUsers(includeInactive = false) {
    const snapshot = await firebase.firestore()
      .collection('users')
      .where('firstLoginCompleted', '==', true)
      .get();
    
    let users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    
    // Filter out inactive users unless explicitly requested
    if (!includeInactive) {
      users = users.filter(user => user.active !== false);
    }
    
    return users;
  },

  /**
   * Delete a guest user completely from Firestore
   * WARNING: Only use for guest users (anonymous auth)
   * @param {string} userId - User ID to delete
   * @returns {Promise<void>}
   */
  async deleteGuestUser(userId) {
    // First, check if user is a guest
    const userDoc = await firebase.firestore()
      .collection('users')
      .doc(userId)
      .get();
    
    if (!userDoc.exists) {
      throw new Error('Пользователь не найден');
    }

    const userData = userDoc.data();
    
    // Only allow deletion of guest users
    if (!userData.guestCode && userData.role !== 'guest') {
      throw new Error('Можно удалять только гостевых пользователей');
    }

    // Delete user document
    await firebase.firestore()
      .collection('users')
      .doc(userId)
      .delete();

    // Delete all responses from this user
    const responsesSnapshot = await firebase.firestore()
      .collection('responses')
      .where('userId', '==', userId)
      .get();
    
    const batch = firebase.firestore().batch();
    responsesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    console.log('✅ Guest user deleted:', userId);
  },

  /**
   * Soft delete a regular user (set active: false)
   * @param {string} userId - User ID to deactivate
   * @returns {Promise<void>}
   */
  async deactivateUser(userId) {
    await firebase.firestore()
      .collection('users')
      .doc(userId)
      .update({ active: false });
    console.log('✅ User deactivated:', userId);
  },

  /**
   * Rename a guest user
   * @param {string} userId - User ID to rename
   * @param {string} newName - New full name
   * @returns {Promise<void>}
   */
  async renameGuestUser(userId, newName) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!newName || newName.trim().length === 0) {
      throw new Error('Имя не может быть пустым');
    }

    if (newName.trim().length > 200) {
      throw new Error('Имя слишком длинное (максимум 200 символов)');
    }

    await firebase.firestore()
      .collection('users')
      .doc(userId)
      .update({ fullName: newName.trim() });
    
    console.log('✅ Guest renamed:', userId, newName);
  },

  // ===== GUEST ACCESS MANAGEMENT =====

  async createGuestCode() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const guestCodeRef = await firebase.firestore()
      .collection('guestCodes')
      .add({
        code,
        used: false,
        createdAt: firebase.firestore.Timestamp.now(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      });

    return { id: guestCodeRef.id, code };
  },

  async getGuestCodes() {
    const snapshot = await firebase.firestore()
      .collection('guestCodes')
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async deleteGuestCode(codeId) {
    return firebase.firestore()
      .collection('guestCodes')
      .doc(codeId)
      .delete();
  },

  async validateGuestCode(code) {
    const snapshot = await firebase.firestore()
      .collection('guestCodes')
      .where('code', '==', code)
      .get();

    if (snapshot.empty) {
      throw new Error('Неверный код доступа');
    }

    const codeDoc = snapshot.docs[0];
    const codeData = codeDoc.data();
    
    if (codeData.used) {
      throw new Error('Этот код уже был использован');
    }

    // Check expiration
    if (codeData.expiresAt && codeData.expiresAt.toDate() < new Date()) {
      throw new Error('Срок действия кода истёк');
    }

    return true;
  },

  async useGuestCode(code, userId, userName) {
    const snapshot = await firebase.firestore()
      .collection('guestCodes')
      .where('code', '==', code)
      .get();

    if (snapshot.empty) {
      throw new Error('Неверный код доступа');
    }

    const codeDoc = snapshot.docs[0];
    if (codeDoc.data().used) {
      throw new Error('Этот код уже был использован');
    }

    await firebase.firestore()
      .collection('guestCodes')
      .doc(codeDoc.id)
      .update({
        used: true,
        usedBy: userName,
        usedAt: firebase.firestore.Timestamp.now()
      });

    return true;
  }
};

window.API = API;
