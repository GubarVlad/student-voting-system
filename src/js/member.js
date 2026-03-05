// Member Voting Module
const MemberModule = {
  activeVote: null,
  activeVoteUnsubscribe: null,
  responsesUnsubscribe: null,
  userResponse: null,

  async init() {
    // Wait for authentication to be ready before subscribing
    await this.waitForAuth();
    
    // Subscribe to active vote
    this.subscribeToActiveVote();

    // Setup event listeners
    document.getElementById('btnBackToMember').addEventListener('click', () => {
      this.resetVotingUI();
    });

    // Setup tab switching
    this.setupTabs();
  },

  setupTabs() {
    const tabButtons = document.querySelectorAll('#memberPage .tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const targetTab = button.dataset.tab;
        
        // Update active button
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Update active content
        const tabContents = document.querySelectorAll('#memberPage .tab-content');
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(targetTab).classList.add('active');
        
        // Load data when switching to certain tabs
        if (targetTab === 'member-history') {
          await this.loadVotingHistory();
        } else if (targetTab === 'member-participants') {
          await this.loadParticipants();
        }
      });
    });
  },

  // Wait for authentication to be fully ready
  async waitForAuth() {
    return new Promise((resolve) => {
      // If already authenticated, resolve immediately
      if (firebase.auth().currentUser) {
        resolve();
        return;
      }
      
      // Otherwise wait for auth state to change
      const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          unsubscribe();
          resolve();
        }
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        unsubscribe();
        resolve();
      }, 5000);
    });
  },

  subscribeToActiveVote() {
    // Unsubscribe from previous listener
    if (this.activeVoteUnsubscribe) {
      this.activeVoteUnsubscribe();
    }
    if (this.responsesUnsubscribe) {
      this.responsesUnsubscribe();
    }

    this.activeVoteUnsubscribe = API.subscribeToActiveVote(async (vote) => {
      try {
        this.activeVote = vote;
        
        if (vote) {
          console.log('✅ Active vote loaded:', vote);
          // Check if user already voted
          this.userResponse = await API.getUserResponse(vote.id, AuthModule.currentUser.uid);
          
          // Subscribe to responses to show live results
          if (this.responsesUnsubscribe) {
            this.responsesUnsubscribe();
          }
          this.responsesUnsubscribe = API.subscribeToResponses(vote.id, (responses) => {
            this.displayVote(vote, responses).catch(error => {
              console.error('❌ Error rendering member vote:', error);
            });
          });
        } else {
          console.log('ℹ️ No active vote');
          this.displayNoVote();
        }
      } catch (error) {
        console.error('❌ Error loading active vote:', error);
        this.displayNoVote();
      }
    });
  },

  async displayVote(vote, responses = []) {
    const section = document.getElementById('memberVotingSection');
    const confirmation = document.getElementById('voteConfirmation');

    // Defensive check for required vote data
    if (!vote || !vote.question || !Array.isArray(vote.options)) {
      console.error('Invalid vote data:', vote);
      section.innerHTML = '<div class="error-message">Ошибка: некорректные данные голосования</div>';
      return;
    }

    if (this.userResponse) {
      // Already voted - show results with winner
      section.style.display = 'none';
      confirmation.style.display = '';
      await this.displayResults(vote, responses);
      return;
    }

    confirmation.style.display = 'none';
    section.style.display = '';

    let html = `
      <div class="card-large voting-card">
        <h3>${this.escapeHtml(vote.question)}</h3>
        <p class="vote-type">
          ${vote.isSecret ? '🔒 Тайное голосование' : '👁️ Открытое голосование'}
        </p>

        <div class="voting-options">
    `;

    vote.options.forEach(option => {
      html += `
        <button 
          class="option-button" 
          onclick="MemberModule.handleVote('${vote.id}', '${this.escapeHtml(option)}')">
          ${this.escapeHtml(option)}
        </button>
      `;
    });

    html += `
        </div>
        <p class="voting-hint">Нажмите на вариант — проголосовать можно только один раз</p>
      </div>
    `;

    section.innerHTML = html;
  },

  async displayResults(vote, responses) {
    const results = API.calculateResults(responses, vote.options);
    const outcome = await API.getWinningOption(vote, responses, results);
    const confirmation = document.getElementById('voteConfirmation');

    let html = `
      <div class="success-message">
        <h3>✅ Ваш голос учтён</h3>
        <p>Спасибо за участие! Вы выбрали: <strong>${this.escapeHtml(this.userResponse.selectedOption)}</strong></p>
        ${outcome.tieResolvedByChairman ? '<p><strong>При равенстве голос председателя определил результат.</strong></p>' : ''}
        
        <div class="results-preview">
          <h4>Текущие результаты</h4>
    `;

    results.options.forEach(option => {
      const isWinner = option.option === outcome.winnerOption;
      const winnerBadge = isWinner && option.count > 0 ? ' 🏆' : '';
      html += `
        <div class="result-preview-item">
          <div class="result-header">
            <span>${this.escapeHtml(option.option)}${winnerBadge}</span>
            <span class="result-count">${option.count} голосов</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${option.percentage}%"></div>
          </div>
          <div class="result-percentage">${option.percentage.toFixed(1)}%</div>
        </div>
      `;
    });

    html += `
        </div>
        <button class="btn-primary" id="btnBackToMember">Назад к голосованиям</button>
      </div>
    `;

    confirmation.innerHTML = html;
    document.getElementById('btnBackToMember').addEventListener('click', () => {
      this.resetVotingUI();
    });
  },

  displayNoVote() {
    const section = document.getElementById('memberVotingSection');
    const confirmation = document.getElementById('voteConfirmation');

    section.style.display = '';
    confirmation.style.display = 'none';
    section.innerHTML = `
      <div class="empty-state">
        <p>Ожидание открытия голосования...</p>
        <p class="small">Администратор скоро откроет голосование</p>
      </div>
    `;
  },

  async handleVote(voteId, option) {
    const user = AuthModule.currentUser;
    const profile = AuthModule.userProfile;
    if (!user) {
      console.error('User not authenticated');
      alert('❌ Ошибка: пользователь не авторизован');
      return;
    }

    try {
      // Submit response with username
      const userName = profile?.fullName || user.email || 'Пользователь';
      await API.submitResponse(voteId, user.uid, option, userName);
      
      // Update user voted status
      this.userResponse = {
        voteId,
        userId: user.uid,
        selectedOption: option
      };

      console.log('✅ Vote submitted:', option);

      // Results will be displayed via the subscription callback
    } catch (error) {
      console.error('Error submitting vote:', error);
      const errorMsg = error.message || 'Ошибка при отправке голоса';
      alert('❌ ' + errorMsg);
    }
  },

  resetVotingUI() {
    document.getElementById('voteConfirmation').style.display = 'none';
    document.getElementById('memberVotingSection').style.display = '';
    this.userResponse = null;
    if (this.responsesUnsubscribe) {
      this.responsesUnsubscribe();
      this.responsesUnsubscribe = null;
    }
  },

  async loadVotingHistory() {
    const section = document.getElementById('memberHistorySection');
    section.innerHTML = '<div class="loading">Загрузка истории...</div>';

    try {
      const user = AuthModule.currentUser;
      if (!user) {
        section.innerHTML = '<div class="error-message">Необходима авторизация</div>';
        return;
      }

      // Get all votes
      const votes = await API.getAllVotes();
      
      // Get user's responses
      const responsesSnapshot = await firebase.firestore()
        .collection('responses')
        .where('userId', '==', user.uid)
        .get();

      const userResponses = [];
      responsesSnapshot.docs.forEach(doc => {
        const response = doc.data();
        const vote = votes.find(v => v.id === response.voteId);
        if (vote) {
          userResponses.push({
            voteId: response.voteId,
            question: vote.question,
            selectedOption: response.selectedOption,
            voteNumber: vote.voteNumber || null,
            isSecret: vote.isSecret,
            timestamp: response.timestamp,
            voteStatus: vote.isClosed ? 'Завершено' : (vote.isOpen ? 'Активно' : 'Закрыто')
          });
        }
      });

      const outcomeByVoteId = new Map();
      await Promise.all(userResponses.map(async (item) => {
        if (outcomeByVoteId.has(item.voteId)) return;
        const vote = votes.find(v => v.id === item.voteId);
        if (!vote) return;

        const voteResponses = await API.getVoteResponses(item.voteId);
        const results = API.calculateResults(voteResponses, vote.options || []);
        const outcome = await API.getWinningOption(vote, voteResponses, results);
        outcomeByVoteId.set(item.voteId, outcome);
      }));

      // Sort by timestamp (newest first)
      userResponses.sort((a, b) => {
        const aTime = a.timestamp?.toMillis?.() || 0;
        const bTime = b.timestamp?.toMillis?.() || 0;
        return bTime - aTime;
      });

      if (userResponses.length === 0) {
        section.innerHTML = `
          <div class="empty-state">
            <p>📋 У вас пока нет истории голосований</p>
            <p class="small">Проголосуйте, чтобы появилась история</p>
          </div>
        `;
        return;
      }

      let html = `
        <div class="card-large">
          <h3>📋 История ваших голосований</h3>
          <p class="subtitle">Всего голосований: ${userResponses.length}</p>
          <div class="history-list">
      `;

      userResponses.forEach((response, index) => {
        const dateStr = response.timestamp ? API.formatDate(response.timestamp) : 'Нет данных';
        const statusClass = response.voteStatus === 'Активно' ? 'status-active' : 'status-closed';
        const outcome = outcomeByVoteId.get(response.voteId);
        const winnerText = outcome?.winnerOption
          ? `${outcome.winnerOption}${outcome.tieResolvedByChairman ? ' (решающий голос председателя)' : ''}`
          : 'Победитель не определен';
        const voteNumberText = response.voteNumber ? `№${response.voteNumber}` : 'Без номера';
        
        html += `
          <div class="history-item">
            <div class="history-header">
              <div>
                <strong>${index + 1}. ${voteNumberText} - ${this.escapeHtml(response.question)}</strong>
                <span class="vote-status ${statusClass}">${response.voteStatus}</span>
              </div>
              <span class="history-date">${dateStr}</span>
            </div>
            <div class="history-details">
              <p><strong>Ваш выбор:</strong> ${this.escapeHtml(response.selectedOption)}</p>
              <p><strong>Победивший вариант:</strong> ${this.escapeHtml(winnerText)}</p>
              <p class="vote-type-label">${response.isSecret ? '🔒 Тайное' : '👁️ Открытое'}</p>
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;

      section.innerHTML = html;
    } catch (error) {
      console.error('Error loading voting history:', error);
      section.innerHTML = '<div class="error-message">Ошибка загрузки истории</div>';
    }
  },

  async loadParticipants() {
    const section = document.getElementById('memberParticipantsSection');
    section.innerHTML = '<div class="loading">Загрузка списка участников...</div>';

    try {
      const participants = await API.getParticipantsWithVoteHistory();

      if (participants.length === 0) {
        section.innerHTML = `
          <div class="empty-state">
            <p>Список участников пуст</p>
          </div>
        `;
        return;
      }

      // Sort participants: chairman first, then by role, then by name
      participants.sort((a, b) => {
        if (a.isChairman && !b.isChairman) return -1;
        if (!a.isChairman && b.isChairman) return 1;
        if (a.role !== b.role) {
          const roleOrder = { admin: 0, member: 1, guest: 2 };
          return (roleOrder[a.role] || 3) - (roleOrder[b.role] || 3);
        }
        return (a.fullName || '').localeCompare(b.fullName || '');
      });

      let html = `
        <div class="card-large">
          <h3>👥 Участники студенческого совета</h3>
          <p class="subtitle">Всего участников: ${participants.length}</p>
          
          <div class="participants-table-container">
            <table class="participants-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Имя</th>
                  <th>Роль</th>
                  <th>Участие в голосованиях</th>
                </tr>
              </thead>
              <tbody>
      `;

      participants.forEach((participant, index) => {
        const name = participant.fullName || participant.email || 'Без имени';
        let roleLabel = participant.roleLabel || participant.role || 'member';
        
        // Shorten long role names for better display
        const roleAbbreviations = {
          'Гражданско-патриотический сектор': 'Гражд.-патриот. сектор',
          'Культурно-массовый сектор': 'Культ.-массовый сектор',
          'Информационный сектор': 'Инф. сектор',
          'Спортивный сектор': 'Спорт. сектор',
          'Социальный сектор': 'Соц. сектор'
        };
        
        roleLabel = roleAbbreviations[roleLabel] || roleLabel;
        
        const chairmanIndicator = participant.isChairman ? ' <span style="color: var(--primary-color); font-size: 1.1rem;" title="Председатель">👤</span>' : '';
        const votesCount = participant.votesCount || 0;
        
        html += `
          <tr>
            <td>${index + 1}</td>
            <td>${this.escapeHtml(name)}${chairmanIndicator}</td>
            <td><span class="role-badge role-${participant.role}">${this.escapeHtml(roleLabel)}</span></td>
            <td>${votesCount} ${this.getPluralForm(votesCount, 'голосование', 'голосования', 'голосований')}</td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;

      section.innerHTML = html;
    } catch (error) {
      console.error('Error loading participants:', error);
      section.innerHTML = '<div class="error-message">Ошибка загрузки списка участников</div>';
    }
  },

  getPluralForm(number, one, few, many) {
    const mod10 = number % 10;
    const mod100 = number % 100;
    
    if (mod10 === 1 && mod100 !== 11) {
      return one;
    } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
      return few;
    } else {
      return many;
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

window.MemberModule = MemberModule;
