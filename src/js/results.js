// Results & Projector Module
const ResultsModule = {
  voteId: null,
  vote: null,
  responsesUnsubscribe: null,
  isFullscreen: false,

  async init(voteId) {
    this.voteId = voteId;
    
    // Load vote and subscribe to responses
    try {
      this.vote = await API.getVote(voteId);
      if (!this.vote) {
        document.getElementById('resultsSection').innerHTML = `
          <div class="error-message">Vote not found</div>
        `;
        return;
      }

      // Subscribe to responses for live updates
      this.responsesUnsubscribe = API.subscribeToResponses(voteId, (responses) => {
        this.displayResults(responses);
      });

      // Setup event listeners
      document.getElementById('btnFullscreen').addEventListener('click', () => {
        this.toggleFullscreen();
      });

      document.getElementById('btnBackResults').addEventListener('click', () => {
        this.cleanup();
        Router.navigate('admin');
      });
    } catch (error) {
      console.error('Error loading results:', error);
      document.getElementById('resultsSection').innerHTML = `
        <div class="error-message">Error loading results</div>
      `;
    }
  },

  displayResults(responses) {
    const results = API.calculateResults(responses, this.vote.options);
    const section = document.getElementById('resultsSection');

    let html = `
      <div class="card-large results-card">
        <div class="results-header">
          <h3>${this.escapeHtml(this.vote.question)}</h3>
          <div class="results-stats">
            <span class="stat">Total Responses: <strong>${results.totalResponses}</strong></span>
            <span class="stat">Type: <strong>${this.vote.isSecret ? 'Secret' : 'Open'}</strong></span>
          </div>
        </div>

        <div class="results-container">
    `;

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

        ${AuthModule.isAdmin() ? `
          <div class="action-buttons">
            <button class="btn-primary" onclick="ResultsModule.handleExport()">
              Export Results
            </button>
          </div>
        ` : ''}
      </div>
    `;

    section.innerHTML = html;

    // Also update projector mode if active
    this.updateProjectorMode(results);
  },

  updateProjectorMode(results) {
    const projectorResults = document.getElementById('projectorResults');
    const projectorQuestion = document.getElementById('projectorQuestion');

    projectorQuestion.textContent = this.vote.question;

    let html = '';
    const colors = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6'];

    results.options.forEach((option, index) => {
      const color = colors[index % colors.length];
      html += `
        <div class="projector-option">
          <div class="option-info">
            <h4>${this.escapeHtml(option.option)}</h4>
            <div class="votes-info">
              <span>${option.count} votes</span>
              <span className="percentage">${option.percentage.toFixed(1)}%</span>
            </div>
          </div>
          <div class="large-progress-bar">
            <div class="large-progress-fill" style="width: ${option.percentage}%; background-color: ${color};"></div>
          </div>
        </div>
      `;
    });

    projectorResults.innerHTML = html;
  },

  toggleFullscreen() {
    const projector = document.getElementById('projectorMode');
    
    if (!this.isFullscreen) {
      // Enter fullscreen
      projector.style.display = '';
      
      if (projector.requestFullscreen) {
        projector.requestFullscreen();
      } else if (projector.webkitRequestFullscreen) {
        projector.webkitRequestFullscreen();
      }
      
      this.isFullscreen = true;
      document.getElementById('btnFullscreen').textContent = '⛶ Exit Fullscreen';
    } else {
      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      
      projector.style.display = 'none';
      this.isFullscreen = false;
      document.getElementById('btnFullscreen').textContent = '□ Fullscreen';
    }
  },

  async handleExport() {
    try {
      const responses = await API.getVoteResponses(this.voteId);
      const results = API.calculateResults(responses, this.vote.options);

      const data = {
        vote: {
          id: this.vote.id,
          question: this.vote.question,
          isSecret: this.vote.isSecret,
          createdAt: API.formatDate(this.vote.createdAt)
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
      a.download = `vote-results-${this.voteId}.json`;
      a.click();
      URL.revokeObjectURL(url);

      console.log('✅ Results exported');
      alert('✅ Results exported successfully!');
    } catch (error) {
      console.error('Error exporting:', error);
      alert('❌ Error exporting results');
    }
  },

  cleanup() {
    if (this.responsesUnsubscribe) {
      this.responsesUnsubscribe();
    }
    
    // Exit fullscreen if active
    if (this.isFullscreen && document.fullscreenElement) {
      document.exitFullscreen();
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

window.ResultsModule = ResultsModule;
