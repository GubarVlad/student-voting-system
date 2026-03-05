// Admin Dashboard Module
const AdminModule = {
  activeVote: null,
  activeVoteUnsubscribe: null,
  responsesUnsubscribe: null,
  adminVoteResponse: null,
  adminVotingUnsubscribe: null,
  adminResponsesUnsubscribe: null,

  async init() {
    // Wait for authentication to be ready
    await this.waitForAuth();
    
    // Setup event listeners
    document.getElementById('createVoteForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleCreateVote();
    });

    const createVoteBtn = document.getElementById('btnCreateVote');
    if (createVoteBtn) {
      createVoteBtn.addEventListener('click', () => this.switchTab('create-vote'));
    }

    // Tab navigation
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Load active vote
    this.subscribeToActiveVote();
    
    // Setup admin voting
    this.subscribeToAdminVoting();

    // Load vote history
    await this.loadVoteHistory();
  },

  async handleCreateVote() {
    const question = document.getElementById('voteQuestion').value.trim();
    const optionsText = document.getElementById('voteOptions').value;
    const isSecret = document.getElementById('voteIsSecret').checked;
    const errorEl = document.getElementById('createVoteError');
    const submitBtn = document.querySelector('#createVoteForm button[type="submit"]');

    try {
      errorEl.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Создание...';

      // Validate question
      if (!question) {
        throw new Error('Укажите вопрос голосования');
      }
      if (question.length > 500) {
        throw new Error('Вопрос слишком длинный (максимум 500 символов)');
      }

      // Parse and validate options
      const options = optionsText
        .split('\n')
        .map(opt => opt.trim())
        .filter(opt => opt);

      if (options.length < 2) {
        throw new Error('Укажите минимум 2 варианта');
      }

      if (options.length > 10) {
        throw new Error('Максимум 10 вариантов ответа');
      }

      // Validate each option
      for (let i = 0; i < options.length; i++) {
        if (options[i].length > 200) {
          throw new Error(`Вариант ${i + 1} слишком длинный (максимум 200 символов)`);
        }
      }

      // Create vote
      const voteRef = await API.createVote({
        question,
        options,
        isSecret,
        createdBy: AuthModule.currentUser.uid,
        createdAt: new Date().toISOString()
      });

      console.log('✅ Vote created:', voteRef.id);

      // Clear form
      document.getElementById('createVoteForm').reset();
      
      // Show success message
      alert('✅ Голосование успешно создано!');
      
      // Switch to active votes tab
      this.switchTab('active-votes');
    } catch (error) {
      console.error('Error creating vote:', error);
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Создать голосование';
    }
  },

  // Wait for authentication to be fully ready before subscribing to Firestore
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
      
      // Timeout after 5 seconds to prevent hanging
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

    // Subscribe to active vote
    this.activeVoteUnsubscribe = API.subscribeToActiveVote(async (vote) => {
      this.activeVote = vote;
      
      if (vote) {
        // Subscribe to responses
        this.responsesUnsubscribe = API.subscribeToResponses(vote.id, (responses) => {
          this.displayActiveVote(vote, responses).catch(error => {
            console.error('❌ Error rendering active vote:', error);
          });
        });
      } else {
        this.displayNoActiveVote();
      }
    });
  },

  async displayActiveVote(vote, responses) {
    const section = document.getElementById('activeVoteSection');
    
    // Defensive check for required data
    if (!vote || !vote.question || !Array.isArray(vote.options)) {
      console.error('Invalid vote data:', vote);
      section.innerHTML = '<div class="error-message">Ошибка: некорректные данные голосования</div>';
      return;
    }

    const results = API.calculateResults(responses, vote.options);
    const outcome = await API.getWinningOption(vote, responses, results);

    let html = `
      <div class="card-large active-vote-card">
        <div class="vote-header">
          <h3>${this.escapeHtml(vote.question)}</h3>
          <div class="vote-info">
            <span class="badge">Ответов: ${results.totalResponses}</span>
            <span class="badge">${vote.isSecret ? '🔒 Тайное' : '👁️ Открытое'}</span>
          </div>
        </div>

        <div class="results-container">
    `;

    // Results
    results.options.forEach(option => {
      const isWinner = option.option === outcome.winnerOption;
      const winnerBadge = isWinner && option.count > 0 ? ' 🏆' : '';
      html += `
        <div class="result-item">
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

    // Show voters for open voting
    if (!vote.isSecret && responses.length > 0) {
      html += `
        <div class="voters-section">
          <h4>Кто голосовал</h4>
          <div class="voters-list">
      `;

      results.options.forEach(option => {
        const voters = responses.filter(r => r.selectedOption === option.option);
        if (voters.length > 0) {
          html += `<div class="voter-option"><strong>${this.escapeHtml(option.option)}:</strong>`;
          html += voters.map((voter, idx) => `<span class="voter-badge">${voter.userName || 'Пользователь ' + (idx + 1)}</span>`).join('');
          html += `</div>`;
        }
      });

      html += `
          </div>
        </div>
      `;
    }

    html += `
        </div>
        ${outcome.tieResolvedByChairman ? '<p class="small" style="margin: 0.75rem 0 0; color: var(--primary-color);"><strong>Равенство голосов решено голосом председателя.</strong></p>' : ''}

        <div class="action-buttons">
          <button class="btn-primary" onclick="AdminModule.handleCloseVote('${vote.id}')">
            Закрыть голосование
          </button>
          <button class="btn-secondary" onclick="Router.navigate('results', '${vote.id}')">
            Смотреть результаты
          </button>
          <button class="btn-secondary" onclick="AdminModule.handleExport('${vote.id}')">
            Экспорт результатов
          </button>
        </div>
      </div>
    `;

    section.innerHTML = html;
  },

  displayNoActiveVote() {
    const section = document.getElementById('activeVoteSection');
    section.innerHTML = `
      <div class="empty-state">
        <p>Нет активного голосования</p>
        <p class="small">Создайте голосование и откройте его для начала</p>
      </div>
    `;
  },

  async handleCloseVote(voteId) {
    if (!confirm('Закрыть это голосование? Участники больше не смогут голосовать.')) {
      return;
    }

    try {
      await API.closeVote(voteId);
      console.log('✅ Vote closed');
      alert('✅ Голосование успешно закрыто');
    } catch (error) {
      console.error('Error closing vote:', error);
      alert('❌ Ошибка при закрытии голосования');
    }
  },

  async loadVoteHistory() {
    try {
      const allVotes = await API.getAllVotes();
      const votes = allVotes.filter(vote => vote.isClosed);
      const section = document.getElementById('historySection');

      if (votes.length === 0) {
        section.innerHTML = `
          <div class="empty-state">
            <p>История голосований пока пуста</p>
          </div>
        `;
        return;
      }

      let html = '<div class="votes-list">';
      
      for (const vote of votes) {
        const responses = await API.getVoteResponses(vote.id);
        const results = API.calculateResults(responses, vote.options);
        const outcome = await API.getWinningOption(vote, responses, results);
        const status = vote.isClosed ? '✅ Закрыто' : (vote.isOpen ? '🔴 Активно' : '⏳ Ожидание');
        const voteNumberText = vote.voteNumber ? `№${vote.voteNumber}` : 'Без номера';
        const winnerText = outcome.winnerOption
          ? `Победил вариант: ${outcome.winnerOption}${outcome.tieResolvedByChairman ? ' (решающий голос председателя)' : ''}`
          : 'Победитель не определен';
        
        html += `
          <div class="vote-item">
            <div class="vote-summary">
              <h4>${voteNumberText} - ${this.escapeHtml(vote.question)}</h4>
              <p class="meta">
                Статус: ${status} | Ответов: ${responses.length} | 
                Создано: ${API.formatDate(vote.createdAt)}
              </p>
              <p class="small" style="margin: 0.5rem 0 0;">${this.escapeHtml(winnerText)}</p>
        `;

        // Show voters for open votes
        if (!vote.isSecret && responses.length > 0) {
          html += `<div class="history-voters">`;
          results.options.forEach(option => {
            const voters = responses.filter(r => r.selectedOption === option.option);
            if (voters.length > 0) {
              html += `<div class="voter-option-history">
                <strong>${this.escapeHtml(option.option)}:</strong>
                ${voters.map(v => `<span class="voter-badge">${v.userName || 'Пользователь'}</span>`).join('')}
              </div>`;
            }
          });
          html += `</div>`;
        }

        html += `
            </div>
            <div class="vote-actions">
              <button class="btn-small" onclick="Router.navigate('results', '${vote.id}')">
                Результаты
              </button>
            </div>
          </div>
        `;
      }

      html += '</div>';
      section.innerHTML = html;
    } catch (error) {
      console.error('Error loading vote history:', error);
    }
  },

  async handleExport(voteId) {
    try {
      const vote = await API.getVote(voteId);
      const responses = await API.getVoteResponses(voteId);
      const results = API.calculateResults(responses, vote.options);

      const data = {
        vote: {
          id: vote.id,
          question: vote.question,
          isSecret: vote.isSecret,
          createdAt: API.formatDate(vote.createdAt)
        },
        results: results,
        exportedAt: new Date().toISOString()
      };

      // Download JSON
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vote-results-${voteId}.json`;
      a.click();
      URL.revokeObjectURL(url);

      console.log('✅ Results exported');
    } catch (error) {
      console.error('Error exporting results:', error);
      alert('❌ Ошибка экспорта результатов');
    }
  },

  switchTab(tabName) {
    // Update active button
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      }
    });

    // Update active content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
      if (content.id === tabName) {
        content.classList.add('active');
      }
    });

    // Reload history if switching to history tab
    if (tabName === 'vote-history') {
      this.loadVoteHistory();
    }

    // Load participants if switching to participants tab
    if (tabName === 'participants') {
      this.loadParticipants();
      this.loadGuestCodes();
    }
  },

  subscribeToAdminVoting() {
    // Setup back button listener
    const backBtn = document.getElementById('btnBackToAdminDashboard');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.resetAdminVotingUI();
      });
    }

    // Subscribe to active vote for voting
    if (this.adminVotingUnsubscribe) {
      this.adminVotingUnsubscribe();
    }

    this.adminVotingUnsubscribe = API.subscribeToActiveVote(async (vote) => {
      if (vote) {
        // Check if admin already voted
        this.adminVoteResponse = await API.getUserResponse(vote.id, AuthModule.currentUser.uid);
        
        // Subscribe to responses to show live results
        if (this.adminResponsesUnsubscribe) {
          this.adminResponsesUnsubscribe();
        }
        this.adminResponsesUnsubscribe = API.subscribeToResponses(vote.id, (responses) => {
          this.displayAdminVoting(vote, responses).catch(error => {
            console.error('❌ Error rendering admin voting:', error);
          });
        });
      } else {
        this.displayAdminNoVote();
      }
    });
  },

  async displayAdminVoting(vote, responses = []) {
    const section = document.getElementById('adminVotingSection');
    const confirmation = document.getElementById('adminVoteConfirmation');

    if (this.adminVoteResponse) {
      // Already voted - show results with winner
      section.style.display = 'none';
      confirmation.style.display = '';
      await this.displayAdminResults(vote, responses);
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
          onclick="AdminModule.handleAdminVote('${vote.id}', '${this.escapeHtml(option)}')">
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

  displayAdminNoVote() {
    const section = document.getElementById('adminVotingSection');
    const confirmation = document.getElementById('adminVoteConfirmation');

    section.style.display = '';
    confirmation.style.display = 'none';
    section.innerHTML = `
      <div class="empty-state">
        <p>Ожидание открытия голосования...</p>
        <p class="small">Голосуйте вместе с участниками</p>
      </div>
    `;
  },

  async displayAdminResults(vote, responses) {
    const results = API.calculateResults(responses, vote.options);
    const outcome = await API.getWinningOption(vote, responses, results);
    const confirmation = document.getElementById('adminVoteConfirmation');

    let html = `
      <div class="success-message">
        <h3>✅ Ваш голос учтён</h3>
        <p>Вы выбрали: <strong>${this.escapeHtml(this.adminVoteResponse.selectedOption)}</strong></p>
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
        <button class="btn-primary" id="btnBackToAdminDashboard">Назад к голосованиям</button>
      </div>
    `;

    confirmation.innerHTML = html;
    document.getElementById('btnBackToAdminDashboard').addEventListener('click', () => {
      this.resetAdminVotingUI();
    });
  },

  async handleAdminVote(voteId, option) {
    const user = AuthModule.currentUser;
    const profile = AuthModule.userProfile;
    if (!user) {
      console.error('Admin user not authenticated');
      alert('❌ Ошибка: администратор не авторизован');
      return;
    }

    try {
      // Submit response with username
      const userName = profile?.fullName || user.email || 'Администратор';
      await API.submitResponse(voteId, user.uid, option, userName);
      
      // Update admin voted status
      this.adminVoteResponse = {
        voteId,
        userId: user.uid,
        selectedOption: option
      };

      console.log('✅ Admin vote submitted:', option);

      // Results will be displayed via the subscription callback
    } catch (error) {
      console.error('Error submitting admin vote:', error);
      const errorMsg = error.message || 'Ошибка при отправке голоса';
      alert('❌ ' + errorMsg);
    }
  },

  resetAdminVotingUI() {
    document.getElementById('adminVoteConfirmation').style.display = 'none';
    document.getElementById('adminVotingSection').style.display = '';
    this.adminVoteResponse = null;
    if (this.adminResponsesUnsubscribe) {
      this.adminResponsesUnsubscribe();
      this.adminResponsesUnsubscribe = null;
    }
  },

  // ===== PARTICIPANTS MANAGEMENT =====

  /**
   * Load all participants/users and display in management table
   */
  async loadParticipants() {
    try {
      const participants = await API.getParticipantsWithVoteHistory();
      const section = document.getElementById('participantsSection');

      if (participants.length === 0) {
        section.innerHTML = `
          <div class="empty-state">
            <p>Нет участников</p>
          </div>
        `;
        return;
      }

      const roles = [
        'Председатель',
        'Зам председателя',
        'Секретарь',
        'Медиа сектор',
        'Гражданско-патриотический сектор',
        'Спортивный сектор',
        'Волонтёрский сектор',
        'Научный сектор',
        'Культурно-массовый сектор'
      ];

      const sortedParticipants = [...participants].sort((a, b) => {
        if (a.isChairman && !b.isChairman) return -1;
        if (!a.isChairman && b.isChairman) return 1;
        return (a.fullName || '').localeCompare(b.fullName || '', 'ru');
      });

      let html = '<div class="participants-table">';
      html += `
        <div class="table-header">
          <div class="col-name">ФИО</div>
          <div class="col-email">Email</div>
          <div class="col-role">Роль</div>
          <div class="col-history">История голосований</div>
          <div class="col-actions">Действия</div>
        </div>
      `;

      for (const participant of sortedParticipants) {
        const userRole = participant.role || 'member';
        const isGuest = participant.guestCode || userRole === 'guest';

        let nameHtml = `<div class="col-name">`;
        if (isGuest) {
          nameHtml += `
            <span id="name-${participant.uid}">${this.escapeHtml(participant.fullName || 'Гость')}</span>
            <button class="btn-edit-name" onclick="AdminModule.editGuestName('${participant.uid}', '${this.escapeHtml(participant.fullName || 'Гость')}')" title="Переименовать">✏️</button>
          `;
        } else {
          nameHtml += this.escapeHtml(participant.fullName || 'N/A');
        }
        if (participant.isChairman) {
          nameHtml += `<span class="badge" style="margin-left: 0.5rem;">Председатель</span>`;
        }
        nameHtml += '</div>';

      html += `
        <div class="table-row">
          <div class="col-name">
            <span id="name-${participant.uid}" class="participant-name">${this.escapeHtml(participant.fullName || 'Гость')}</span>`;
        
        if (isGuest) {
          html += `<button class="btn-edit-name" data-action="edit-guest-name" data-user-id="${participant.uid}" title="Переименовать">✏️</button>`;
        }
        
        if (participant.isChairman) {
          html += `<span class="badge" style="margin-left: 0.5rem;">Председатель</span>`;
        }
        html += `</div>
            <div class="col-email">${isGuest ? '<em>гостевой доступ</em>' : this.escapeHtml(participant.email || 'N/A')}</div>
            <div class="col-role">
              <select class="role-select" data-user-id="${participant.uid}" onchange="AdminModule.updateUserRole('${participant.uid}', this.value)" ${isGuest ? 'disabled' : ''}>
                <option value="member" ${userRole === 'member' ? 'selected' : ''}>Участник</option>
                <option value="admin" ${userRole === 'admin' ? 'selected' : ''}>Администратор</option>
                <option value="guest" ${userRole === 'guest' ? 'selected' : ''}>Гость</option>
        `;

        roles.forEach(role => {
          const isSelected = participant.sector === role || participant.position === role ? 'selected' : '';
          html += `<option value="sector:${role}" ${isSelected}>${role}</option>`;
        });

        html += `
              </select>
              <div class="small" style="margin-top: 0.35rem;">Текущая роль: ${this.escapeHtml(participant.roleLabel)}</div>
              ${isGuest ? '<div class="small">Гость - роль не меняется</div>' : ''}
            </div>
            <div class="col-history">${this.renderVoteHistory(participant.voteHistory)}</div>
            <div class="col-actions">
              <button class="btn-small btn-danger" data-action="remove-participant" data-user-id="${participant.uid}" data-is-guest="${isGuest}">Удалить</button>
            </div>
          </div>
        `;
      }

      html += '</div>';
      section.innerHTML = html;
      
      // **FIX:** Use event delegation instead of inline onclick to prevent XSS
      section.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-action="edit-guest-name"]');
        if (editBtn) {
          const userId = editBtn.dataset.userId;
          const nameEl = editBtn.closest('.col-name').querySelector('.participant-name');
          const currentName = nameEl.textContent;
          this.editGuestName(userId, currentName);
          return;
        }

        const removeBtn = e.target.closest('[data-action="remove-participant"]');
        if (removeBtn) {
          const userId = removeBtn.dataset.userId;
          const isGuest = removeBtn.dataset.isGuest === 'true';
          this.removeParticipant(userId, isGuest);
          return;
        }
      });
    } catch (error) {
      console.error('Error loading participants:', error);
      document.getElementById('participantsSection').innerHTML = `
        <div class="error-message">Ошибка загрузки участников</div>
      `;
    }
  },

  renderVoteHistory(voteHistory = []) {
    if (voteHistory.length === 0) {
      return '<span class="small">Еще не голосовал</span>';
    }

    let html = `<details class="participant-history"><summary>Голосований: ${voteHistory.length}</summary><div class="participant-history-list">`;

    voteHistory.slice(0, 10).forEach(historyItem => {
      const winnerText = historyItem.winnerOption
        ? `Победил: ${this.escapeHtml(historyItem.winnerOption)}${historyItem.tieResolvedByChairman ? ' (решающий голос председателя)' : ''}`
        : 'Победитель не определен';
      const voteNumberText = historyItem.voteNumber ? `№${historyItem.voteNumber}` : 'Без номера';

      html += `
        <div class="participant-history-item">
          <div class="participant-history-question">${voteNumberText} - ${this.escapeHtml(historyItem.question)}</div>
          <div class="participant-history-meta">
            Выбор: <strong>${this.escapeHtml(historyItem.selectedOption)}</strong> | ${API.formatDate(historyItem.timestamp)}
          </div>
          <div class="participant-history-meta">
            ${winnerText}
          </div>
        </div>
      `;
    });

    if (voteHistory.length > 10) {
      html += `<div class="small">Показаны последние 10 из ${voteHistory.length}</div>`;
    }

    html += '</div></details>';
    return html;
  },

  /**
   * Update user role or sector
   * @param {string} userId - User ID to update
   * @param {string} roleValue - New role value (can be 'member', 'admin', 'guest', or 'sector:SectorName')
   */
  async updateUserRole(userId, roleValue) {
    try {
      if (roleValue.startsWith('sector:')) {
        const sector = roleValue.substring(7);
        await API.updateUserProfile(userId, { sector, role: 'member' });
        console.log('✅ User sector updated:', sector);
      } else {
        await API.updateUserProfile(userId, { role: roleValue });
        console.log('✅ User role updated:', roleValue);
      }
      this.loadParticipants();
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('❌ Ошибка обновления роли');
    }
  },

  /**
   * Remove a participant (soft delete for regular users, hard delete for guests)
   * @param {string} userId - User ID to remove
   * @param {boolean} isGuest - Whether user is a guest
   */
  async removeParticipant(userId, isGuest) {
    const confirmMessage = isGuest 
      ? 'Удалить этого гостя? Это действие нельзя отменить.'
      : 'Деактивировать этого участника?';

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      if (isGuest) {
        // Hard delete guest user
        await API.deleteGuestUser(userId);
        console.log('✅ Guest deleted');
      } else {
        // Soft delete regular user
        await API.deactivateUser(userId);
        console.log('✅ User deactivated');
      }
      this.loadParticipants();
    } catch (error) {
      console.error('Error removing participant:', error);
      alert('❌ Ошибка удаления: ' + error.message);
    }
  },

  /**
   * Edit guest name (rename)
   * @param {string} userId - User ID to rename
   * @param {string} currentName - Current name
   */
  editGuestName(userId, currentName) {
    const newName = prompt('Введите новое имя гостя:', currentName);
    
    if (newName === null) {
      // User cancelled
      return;
    }

    const trimmedName = newName.trim();
    if (trimmedName === '') {
      alert('❌ Имя не может быть пустым');
      return;
    }

    this.renameGuest(userId, trimmedName);
  },

  /**
   * Rename guest user
   * @param {string} userId - User ID to rename
   * @param {string} newName - New name
   */
  async renameGuest(userId, newName) {
    try {
      if (!newName || newName.trim().length === 0) {
        throw new Error('Имя не может быть пустым');
      }

      await API.renameGuestUser(userId, newName);
      console.log('✅ Guest renamed');
      this.loadParticipants();
    } catch (error) {
      console.error('Error renaming guest:', error);
      const errorMsg = error.message || 'Ошибка переименования';
      alert('❌ ' + errorMsg);
    }
  },

  // ===== GUEST ACCESS MANAGEMENT =====

  async generateGuestCode() {
    try {
      const guestCode = await API.createGuestCode();
      console.log('✅ Guest code generated:', guestCode.code);
      this.loadGuestCodes();
      alert('✅ Код доступа создан:\n\n' + guestCode.code + '\n\nПередайте этот код гостю');
    } catch (error) {
      console.error('Error generating guest code:', error);
      alert('❌ Ошибка создания кода доступа');
    }
  },

  async loadGuestCodes() {
    try {
      const guestCodes = await API.getGuestCodes();
      const section = document.getElementById('guestCodesList');

      if (guestCodes.length === 0) {
        section.innerHTML = `
          <p style="color: var(--text-light); font-size: 0.9rem;">Коды еще не созданы</p>
        `;
        return;
      }

      let html = '<div class="guest-codes-list">';
      for (const codeRecord of guestCodes) {
        const used = codeRecord.used ? '✅ Использован' : '⏳ Ожидает';
        const usedBy = codeRecord.usedBy ? ` (${this.escapeHtml(codeRecord.usedBy)})` : '';
        html += `
          <div class="guest-code-item">
            <div class="code-info">
              <strong style="font-family: monospace; font-size: 1.1rem;">${codeRecord.code}</strong>
              <span class="code-status">${used}${usedBy}</span>
            </div>
            <div class="code-date">Создан: ${API.formatDate(codeRecord.createdAt)}</div>
            <button class="btn-small" onclick="AdminModule.deleteGuestCode('${codeRecord.id}')">Удалить</button>
          </div>
        `;
      }
      html += '</div>';
      section.innerHTML = html;
    } catch (error) {
      console.error('Error loading guest codes:', error);
    }
  },

  async deleteGuestCode(codeId) {
    if (!confirm('Удалить этот код доступа?')) {
      return;
    }

    try {
      await API.deleteGuestCode(codeId);
      console.log('✅ Guest code deleted');
      this.loadGuestCodes();
    } catch (error) {
      console.error('Error deleting guest code:', error);
      alert('❌ Ошибка удаления кода');
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

window.AdminModule = AdminModule;
