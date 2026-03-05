// Public Vote Module - Display voting results without authentication
const PublicVoteModule = {
  currentVoteId: null,
  unsubscribe: null,

  async init(voteId) {
    console.log('🔓 Initializing Public Vote Module for vote:', voteId);
    this.currentVoteId = voteId;

    const section = document.getElementById('publicVoteSection');
    section.innerHTML = '<div class="empty-state"><p>⏳ Загрузка голосования...</p></div>';

    try {
      // First, try to load vote by ID
      let vote = null;
      try {
        vote = await API.getPublicVote(voteId);
      } catch (error) {
        // If ID fails, try as voteNumber
        console.log('Vote ID not found, trying as voteNumber:', voteId);
        vote = await API.getPublicVoteByNumber(voteId);
      }

      // Subscribe to real-time updates
      this.unsubscribe = API.subscribeToPublicVoteResults(vote.id, (data) => {
        this.displayVoteResults(data);
      });
    } catch (error) {
      console.error('❌ Error loading public vote:', error);
      section.innerHTML = `
        <div class="card-large">
          <div class="error-message" style="display: block;">
            <h3>❌ Ошибка</h3>
            <p>${error.message}</p>
          </div>
        </div>
      `;
    }
  },

  displayVoteResults(data) {
    const { vote, results } = data;

    if (!vote) {
      const section = document.getElementById('publicVoteSection');
      section.innerHTML = `
        <div class="card-large">
          <div class="error-message" style="display: block;">
            <p>Голосование не найдено</p>
          </div>
        </div>
      `;
      return;
    }

    const section = document.getElementById('publicVoteSection');
    
    // Format vote number for display
    const voteNumberDisplay = vote.voteNumber ? `№${vote.voteNumber}` : '';
    
    // Build the results HTML
    let resultsHTML = `
      <div class="card-large">
        <div class="vote-header">
          <h2>${vote.question}</h2>
          ${vote.voteNumber ? `<p class="vote-number">Голосование ${voteNumberDisplay}</p>` : ''}
        </div>

        <div class="vote-status">
          <p>
            <strong>Статус:</strong>
            ${vote.isOpen ? '🔵 Открыто' : '🔴 Закрыто'}
            ${vote.isSecret ? ' | 🔒 Тайное голосование' : ''}
          </p>
          <p>
            <strong>Всего голосов:</strong> ${results.totalResponses}
          </p>
        </div>

        <div class="results-options">
    `;

    // Display each option with results
    results.options.forEach(option => {
      const percentage = option.percentage.toFixed(1);
      const barWidth = option.percentage;

      resultsHTML += `
        <div class="result-option">
          <div class="option-header">
            <p class="option-text">${option.option}</p>
            <p class="option-stats">${option.count} голос${this.getVoiceEnding(option.count)} (${percentage}%)</p>
          </div>
          <div class="option-bar">
            <div class="option-bar-fill" style="width: ${barWidth}%;"></div>
          </div>
        </div>
      `;
    });

    resultsHTML += `
        </div>
      </div>

      <div class="vote-info-footer">
        <p class="text-small">Это общедоступное голосование. Результаты обновляются в реальном времени.</p>
        <p class="text-small">Дата создания: ${this.formatDate(vote.createdAt)}</p>
      </div>
    `;

    section.innerHTML = resultsHTML;

    // Add button styling if needed
    this.setupBackButton();
  },

  setupBackButton() {
    const btnBack = document.getElementById('btnBackPublicVote');
    if (btnBack) {
      btnBack.addEventListener('click', (e) => {
        e.preventDefault();
        // Navigate back or close the page
        if (this.unsubscribe) {
          this.unsubscribe();
        }
        history.back();
      }, { once: true });
    }
  },

  formatDate(timestamp) {
    if (!timestamp) return '';
    
    const date = timestamp.toDate 
      ? timestamp.toDate() 
      : new Date(timestamp);
    
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return date.toLocaleDateString('ru-RU', options);
  },

  getVoiceEnding(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod100 >= 11 && mod100 <= 19) return 'ов';
    if (mod10 === 1) return '';
    if (mod10 >= 2 && mod10 <= 4) return 'а';
    return 'ов';
  },

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
};

window.PublicVoteModule = PublicVoteModule;
