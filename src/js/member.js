// Member Voting Module
const MemberModule = {
  activeVote: null,
  activeVoteUnsubscribe: null,
  userResponse: null,

  async init() {
    // Subscribe to active vote
    this.subscribeToActiveVote();

    // Setup event listeners
    document.getElementById('btnBackToMember').addEventListener('click', () => {
      this.resetVotingUI();
    });
  },

  subscribeToActiveVote() {
    // Unsubscribe from previous listener
    if (this.activeVoteUnsubscribe) {
      this.activeVoteUnsubscribe();
    }

    this.activeVoteUnsubscribe = API.subscribeToActiveVote(async (vote) => {
      this.activeVote = vote;
      
      if (vote) {
        // Check if user already voted
        this.userResponse = await API.getUserResponse(vote.id, AuthModule.currentUser.uid);
        this.displayVote(vote);
      } else {
        this.displayNoVote();
      }
    });
  },

  displayVote(vote) {
    const section = document.getElementById('memberVotingSection');
    const confirmation = document.getElementById('voteConfirmation');

    if (this.userResponse) {
      // Already voted
      section.style.display = 'none';
      confirmation.style.display = '';
      return;
    }

    confirmation.style.display = 'none';
    section.style.display = '';

    let html = `
      <div class="card-large voting-card">
        <h3>${this.escapeHtml(vote.question)}</h3>
        <p class="vote-type">
          ${vote.isSecret ? '🔒 Secret Voting' : '👁️ Open Voting'}
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
        <p class="voting-hint">Tap to vote - you can vote only once</p>
      </div>
    `;

    section.innerHTML = html;
  },

  displayNoVote() {
    const section = document.getElementById('memberVotingSection');
    const confirmation = document.getElementById('voteConfirmation');

    section.style.display = '';
    confirmation.style.display = 'none';
    section.innerHTML = `
      <div class="empty-state">
        <p>Waiting for vote to open...</p>
        <p class="small">The admin will open a vote soon</p>
      </div>
    `;
  },

  async handleVote(voteId, option) {
    const user = AuthModule.currentUser;
    if (!user) return;

    try {
      // Submit response
      await API.submitResponse(voteId, user.uid, option);
      
      // Update user voted status
      this.userResponse = {
        voteId,
        userId: user.uid,
        selectedOption: option
      };

      console.log('✅ Vote submitted:', option);

      // Show confirmation
      this.displayVote(this.activeVote);
      document.getElementById('voteConfirmation').style.display = '';
      document.getElementById('memberVotingSection').style.display = 'none';
    } catch (error) {
      console.error('Error submitting vote:', error);
      alert('❌ ' + error.message);
    }
  },

  resetVotingUI() {
    document.getElementById('voteConfirmation').style.display = 'none';
    document.getElementById('memberVotingSection').style.display = '';
    this.userResponse = null;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

window.MemberModule = MemberModule;
