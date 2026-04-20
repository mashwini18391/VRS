/* ═══════════════════════════════════════════════════
   VRS Chat — Supabase Realtime Messaging
   ═══════════════════════════════════════════════════ */

let chatSubscription = null;

/**
 * Initialize chat
 */
function initChat() {
  const messagesContainer = document.getElementById('chatMessages');

  // Auto-scroll to bottom
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Load mechanic info from active booking
  const booking = localStorage.getItem('vrs_active_booking');
  if (booking) {
    const data = JSON.parse(booking);
    const nameEl = document.getElementById('chatMechanicName');
    if (nameEl && data.mechanic) {
      nameEl.textContent = data.mechanic.name;
    }
  }

  // Subscribe to realtime messages (Supabase)
  subscribeToMessages();

  // Focus input
  const input = document.getElementById('chatInput');
  if (input) input.focus();
}

/**
 * Subscribe to realtime messages via Supabase
 */
function subscribeToMessages() {
  const client = initSupabase();
  if (!client || SUPABASE_URL === 'https://your-project.supabase.co') {
    console.log('Demo mode: Real-time chat subscription skipped');
    return;
  }

  try {
    chatSubscription = client
      .channel('chat-messages')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          renderNewMessage(payload.new);
        }
      )
      .subscribe();
  } catch (err) {
    console.log('Realtime subscription error:', err);
  }
}

/**
 * Send a chat message
 */
function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const message = input?.value?.trim();

  if (!message) return;

  // Render the sent message
  appendMessage(message, 'sent');
  input.value = '';

  // In demo mode, simulate a response
  simulateMechanicReply(message);
}

/**
 * Append a message to the chat
 */
function appendMessage(text, type) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  // Hide typing indicator
  const typingEl = document.getElementById('typingIndicator');
  if (typingEl) typingEl.style.display = 'none';

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${type}`;
  bubble.innerHTML = `${text}<span class="time">${formatTime(new Date())}</span>`;

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

/**
 * Show typing indicator
 */
function showTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) {
    indicator.style.display = 'flex';
    const container = document.getElementById('chatMessages');
    if (container) container.scrollTop = container.scrollHeight;
  }
}

/**
 * Render a new incoming message from realtime
 */
function renderNewMessage(msgData) {
  appendMessage(msgData.content, 'received');
}

/**
 * Simulate mechanic reply (Demo mode)
 */
function simulateMechanicReply(userMessage) {
  // Show typing indicator
  setTimeout(showTypingIndicator, 500);

  // Generate contextual reply
  const replies = {
    default: [
      "Got it! I'll check that when I arrive. 👍",
      "No worries, I can handle that. Be there soon!",
      "Thanks for the update. Stay safe, I'm on my way! 🏍️",
      "Understood. I have the right tools for this job.",
      "I'll be there in a few minutes. Stay near the vehicle please."
    ],
    location: [
      "I can see your location on the map. Almost there!",
      "Thanks for the directions! About 5 more minutes."
    ],
    thanks: [
      "You're welcome! Happy to help. 😊",
      "Anytime! That's what we're here for."
    ]
  };

  const lowerMsg = userMessage.toLowerCase();
  let replyPool = replies.default;
  if (lowerMsg.includes('location') || lowerMsg.includes('where') || lowerMsg.includes('near')) {
    replyPool = replies.location;
  } else if (lowerMsg.includes('thank') || lowerMsg.includes('thanks')) {
    replyPool = replies.thanks;
  }

  const reply = replyPool[Math.floor(Math.random() * replyPool.length)];

  setTimeout(() => {
    appendMessage(reply, 'received');
  }, 1500 + Math.random() * 1000);
}

/**
 * Cleanup on page leave
 */
window.addEventListener('beforeunload', () => {
  if (chatSubscription) {
    chatSubscription.unsubscribe();
  }
});
