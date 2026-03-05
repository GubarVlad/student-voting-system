// Admin Dashboard Module
const AdminModule = {
  activeVote: null,
  activeVoteUnsubscribe: null,
  responsesUnsubscribe: null,

  async init() {
    // Setup event listeners
    document.getElementById('createVoteForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleCreateVote();
    });

    // Tab navigation
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Load active vote
    this.subscribeToActiveVote();

    // Load vote history
    await this.loadVoteHistory();
  },

  async handleCreateVote() {
    const question = document.getElementById('voteQuestion').value;
    const optionsText = document.getElementById('voteOptions').value;
    const isSecret = document.getElementById('voteIsSecret').checked;
    const errorEl = document.getElementById('createVoteError');
    const submitBtn = document.querySelector('#createVoteForm button[type="submit"]');

    try {
      errorEl.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';

      // Parse options
      const options = optionsText
        .split('\n')
        .map(opt => opt.trim())
        .filter(opt => opt);

      if (options.length < 2) {
        throw new Error('Please provide at least 2 options');
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
      alert('✅ Vote created successfully!');
      
      // Switch to active votes tab
      this.switchTab('active-votes');
    } catch (error) {
      console.error('Error creating vote:', error);
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Vote';
    }
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
          this.displayActiveVote(vote, responses);
        });
      } else {
        this.displayNoActiveVote();
      }
    });
  },

  displayActiveVote(vote, responses) {
    const section = document.getElementById('activeVoteSection');
    const results = API.calculateResults(responses, vote.options);

    let html = `
      <div class="card-large active-vote-card">
        <div class="vote-header">
          <h3>${this.escapeHtml(vote.question)}</h3>
          <div class="vote-info">
            <span class="badge">Responses: ${results.totalResponses}</span>
            <span class="badge">${vote.isSecret ? '🔒 Secret' : '👁️ Open'}</span>
          </div>
        </div>

        <div class="results-container">
    `;

    // Results
    results.options.forEach(option => {
      html += `
        <div class="result-item">
          <div class="result-header">
            <span>${this.escapeHtml(option.option)}</span>
            <span class="result-count">${option.count} votes</span>
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

        <div class="action-buttons">
          <button class="btn-primary" onclick="AdminModule.handleCloseVote('${vote.id}')">
            Close Vote
          </button>
          <button class="btn-secondary" onclick="Router.navigate('results', '${vote.id}')">
            View Full Results
          </button>
          <button class="btn-secondary" onclick="AdminModule.handleExport('${vote.id}')">
            Export Results
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
        <p>No active vote</p>
        <p class="small">Create a vote and open it to start voting</p>
      </div>
    `;
  },

  async handleCloseVote(voteId) {
    if (!confirm('Close this vote? Members will no longer be able to vote.')) {
      return;
    }

    try {
      await API.closeVote(voteId);
      console.log('✅ Vote closed');
      alert('✅ Vote closed successfully');
    } catch (error) {
      console.error('Error closing vote:', error);
      alert('❌ Error closing vote');
    }
  },

  async loadVoteHistory() {
    try {
      const votes = await API.getAllVotes();
      const section = document.getElementById('historySection');

      if (votes.length === 0) {
        section.innerHTML = `
          <div class="empty-state">
            <p>No voting history yet</p>
          </div>
        `;
        return;
      }

      let html = '<div class="votes-list">';
      
      for (const vote of votes) {
        const responses = await API.getVoteResponses(vote.id);
        const status = vote.isClosed ? '✅ Closed' : (vote.isOpen ? '🔴 Active' : '⏳ Waiting');
        
        html += `
          <div class="vote-item">
            <div class="vote-summary">
              <h4>${this.escapeHtml(vote.question)}</h4>
              <p class="meta">
                Status: ${status} | Responses: ${responses.length} | 
                Created: ${API.formatDate(vote.createdAt)}
              </p>
            </div>
            <div class="vote-actions">
              <button class="btn-small" onclick="Router.navigate('results', '${vote.id}')">
                View Results
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
      alert('❌ Error exporting results');
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
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

window.AdminModule = AdminModule;
