/* ═══════════════════════════════════════════════════
   VRS AI — OpenRouter API Integration + Safety Layer
   ═══════════════════════════════════════════════════ */

// ── OpenRouter Configuration ──
const OPENROUTER_API_KEY = 'your-openrouter-key'; // Replace with actual key
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

let aiConversation = [];

// AI Disclaimer text
const AI_DISCLAIMER_TEXT = '⚠️ AI suggestions are indicative only and do not replace professional diagnosis.';

/**
 * Switch between AI modes
 */
function switchAIMode(mode) {
  const modes = ['chat', 'diagnose', 'image'];
  const tabs = { chat: 'tabChat', diagnose: 'tabDiagnose', image: 'tabImage' };
  const sections = { chat: 'aiChatMode', diagnose: 'aiDiagnoseMode', image: 'aiImageMode' };

  modes.forEach(m => {
    const tab = document.getElementById(tabs[m]);
    const section = document.getElementById(sections[m]);

    if (m === mode) {
      tab.className = 'btn btn-sm btn-primary';
      if (section) section.style.display = 'block';
    } else {
      tab.className = 'btn btn-sm btn-outline';
      if (section) section.style.display = 'none';
    }
  });

  // Toggle input bar visibility
  const inputBar = document.getElementById('aiInputBar');
  if (inputBar) {
    inputBar.style.display = mode === 'chat' ? 'flex' : 'none';
  }
}

/**
 * Initialize AI disclaimer banner
 */
function initAIDisclaimer() {
  const chatContainer = document.getElementById('aiChatMode');
  if (!chatContainer) return;

  // Add disclaimer banner if not already present
  if (!document.getElementById('aiDisclaimer')) {
    const disclaimer = document.createElement('div');
    disclaimer.id = 'aiDisclaimer';
    disclaimer.className = 'ai-disclaimer';
    disclaimer.innerHTML = `
      <span class="ai-disclaimer-icon">🤖</span>
      <span class="ai-disclaimer-text">${AI_DISCLAIMER_TEXT}</span>
    `;
    chatContainer.insertBefore(disclaimer, chatContainer.firstChild);
  }
}

/**
 * Send message to AI chatbot
 */
function sendAIMessage() {
  const input = document.getElementById('aiInput');
  const message = input?.value?.trim();
  if (!message) return;

  askAI(message);
  input.value = '';
}

/**
 * Ask AI a question
 */
async function askAI(question) {
  const container = document.getElementById('aiChatMessages');
  if (!container) return;

  // Ensure disclaimer is visible
  initAIDisclaimer();

  // Hide suggestion chips after first use
  const chips = document.getElementById('suggestionChips');
  if (chips) chips.style.display = 'none';

  // Render user message
  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble sent';
  userBubble.innerHTML = `${escapeHtml(question)}<span class="time">${formatTime(new Date())}</span>`;
  container.appendChild(userBubble);

  // Show typing indicator
  const typing = document.createElement('div');
  typing.className = 'typing-indicator';
  typing.innerHTML = '<span></span><span></span><span></span>';
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;

  // Add to conversation context
  aiConversation.push({ role: 'user', content: question });

  try {
    const response = await callOpenRouter(question);

    // Remove typing indicator
    typing.remove();

    // Sanitize AI response before displaying
    const safeResponse = sanitizeAIResponse(response);

    // Render AI response with disclaimer
    const aiBubble = document.createElement('div');
    aiBubble.className = 'chat-bubble received';
    aiBubble.innerHTML = `${safeResponse}
      <div class="ai-response-disclaimer">
        <small>⚠️ Indicative only — consult a verified mechanic</small>
      </div>
      <span class="time">${formatTime(new Date())}</span>`;
    container.appendChild(aiBubble);
    container.scrollTop = container.scrollHeight;

    aiConversation.push({ role: 'assistant', content: safeResponse });
  } catch (err) {
    typing.remove();

    // Fallback to local responses
    const fallback = getLocalAIResponse(question);
    const safeFallback = sanitizeAIResponse(fallback);
    const aiBubble = document.createElement('div');
    aiBubble.className = 'chat-bubble received';
    aiBubble.innerHTML = `${safeFallback}
      <div class="ai-response-disclaimer">
        <small>⚠️ Indicative only — consult a verified mechanic</small>
      </div>
      <span class="time">${formatTime(new Date())}</span>`;
    container.appendChild(aiBubble);
    container.scrollTop = container.scrollHeight;
  }
}

/**
 * Escape HTML to prevent XSS in user messages
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Sanitize AI response — strip dangerous content but keep safe HTML
 */
function sanitizeAIResponse(text) {
  if (typeof text !== 'string') return '';

  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript\s*:/gi, '')
    // Remove direct booking links from AI responses
    .replace(/<a\s+[^>]*href\s*=\s*["']booking\.html[^"']*["'][^>]*>.*?<\/a>/gi,
      '<em>(Navigate to the Booking page to request a mechanic)</em>')
    .trim();
}

/**
 * Call OpenRouter API
 */
async function callOpenRouter(message) {
  if (OPENROUTER_API_KEY === 'your-openrouter-key') {
    // Demo mode — use local responses
    return new Promise(resolve => {
      setTimeout(() => resolve(getLocalAIResponse(message)), 1200);
    });
  }

  const systemPrompt = `You are VRS AI Assistant, an expert vehicle mechanic chatbot.
RULES:
- Help users diagnose vehicle issues and provide emergency advice.
- NEVER create, confirm, or trigger bookings. Only suggest users navigate to the booking page manually.
- NEVER provide definitive diagnoses. Always say "this could be" or "possible cause".
- Keep responses concise, practical, and reassuring.
- Do NOT return any executable code or JavaScript.
- Do NOT provide pricing guarantees. Say "estimated" or "approximate" costs only.
- If the issue seems dangerous, advise the user to stop driving immediately.
- End responses with a note that this is an indicative suggestion only.`;

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'VRS Emergency Repair'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages: [
        { role: 'system', content: systemPrompt },
        ...aiConversation
      ],
      max_tokens: 500,
      temperature: 0.7
    })
  });

  if (!response.ok) throw new Error('API request failed');

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Sorry, I couldn\'t process that. Please try again.';
}

/**
 * Local AI responses (fallback / demo mode)
 * All responses include "indicative" language — no definitive diagnoses
 */
function getLocalAIResponse(question) {
  const lowerQ = question.toLowerCase();

  if (lowerQ.includes('won\'t start') || lowerQ.includes('not starting') || lowerQ.includes('dead')) {
    return `🔋 <strong>Possible Causes:</strong><br><br>
      1. <strong>Dead Battery</strong> — Most common cause. Try turning on headlights. If dim/off, battery could be dead.<br>
      2. <strong>Faulty Starter Motor</strong> — If you hear a clicking sound when turning the key.<br>
      3. <strong>Fuel Issue</strong> — Check fuel gauge.<br><br>
      💡 <strong>Suggestion:</strong> Try jump-starting with another vehicle. If that doesn't work, a verified mechanic can diagnose accurately.<br><br>
      <em>🔧 Navigate to the Booking page to find a verified mechanic near you.</em>`;
  }

  if (lowerQ.includes('noise') || lowerQ.includes('sound') || lowerQ.includes('knocking')) {
    return `🔊 <strong>Possible Engine Noise Causes:</strong><br><br>
      • <strong>Clicking/Ticking</strong> — Could indicate low oil level or worn lifters<br>
      • <strong>Knocking</strong> — Possible rod bearing issue (potentially serious)<br>
      • <strong>Squealing</strong> — May be a worn serpentine belt<br>
      • <strong>Grinding</strong> — Could be brake or transmission related<br><br>
      💡 <strong>Advice:</strong> If the noise is loud or worsening, stop driving and consult a verified mechanic. Can you describe the noise more specifically?`;
  }

  if (lowerQ.includes('brake') || lowerQ.includes('squeak')) {
    return `🛑 <strong>Possible Brake Issues:</strong><br><br>
      • <strong>Squeaking</strong> — Could indicate worn brake pads (may need replacement)<br>
      • <strong>Grinding</strong> — Pads may be completely worn, rotors could be damaged<br>
      • <strong>Soft pedal</strong> — Possible air in brake lines or low fluid<br>
      • <strong>Pulling to one side</strong> — Could be a sticking caliper<br><br>
      ⚠️ <strong>Safety Warning:</strong> Brake issues are serious. If brakes feel soft or unresponsive, stop driving immediately!<br><br>
      💡 Estimated repair cost: approximately ₹1,500 – ₹4,000 depending on the issue.`;
  }

  if (lowerQ.includes('ac') || lowerQ.includes('cooling') || lowerQ.includes('air condition')) {
    return `❄️ <strong>Possible AC Issues:</strong><br><br>
      • <strong>Not cooling</strong> — Could be low refrigerant (gas leak) or compressor issue<br>
      • <strong>Bad smell</strong> — May be moldy evaporator or dirty cabin filter<br>
      • <strong>Weak airflow</strong> — Possible clogged cabin filter or blower motor issue<br><br>
      💡 <strong>Quick Check:</strong> If AC blows warm air, it likely needs a gas refill (approximately ₹1,500–2,500).`;
  }

  if (lowerQ.includes('overheat') || lowerQ.includes('temperature') || lowerQ.includes('hot')) {
    return `🌡️ <strong>⚠️ POSSIBLE ENGINE OVERHEATING — STOP DRIVING!</strong><br><br>
      <strong>Immediate Steps:</strong><br>
      1. Pull over safely and turn off the engine<br>
      2. Do NOT open the radiator cap (hot steam risk!)<br>
      3. Wait 20-30 minutes for engine to cool<br>
      4. Check coolant level (green/orange fluid)<br><br>
      <strong>Possible causes:</strong> Low coolant, broken thermostat, water pump failure, fan issue<br><br>
      🚨 <em>This could be an emergency. Navigate to the Booking page to request a verified mechanic.</em>`;
  }

  if (lowerQ.includes('check engine') || lowerQ.includes('warning light')) {
    return `⚠️ <strong>Possible Check Engine Light Causes:</strong><br><br>
      A check engine light can indicate many issues. The most common:<br><br>
      1. <strong>Loose gas cap</strong> — Tighten it and see if light goes off<br>
      2. <strong>O2 sensor failure</strong> — Could affect fuel economy<br>
      3. <strong>Catalytic converter</strong> — If performance is reduced<br>
      4. <strong>Mass airflow sensor</strong> — If car stalls frequently<br><br>
      💡 A mechanic with an OBD-II scanner can read the exact error code. Estimated diagnosis cost: approximately ₹300–500.`;
  }

  // Default response — no automatic booking
  return `🤖 Thanks for describing the issue! Based on your description, I'd suggest:<br><br>
    1. <strong>Stay safe</strong> — If you're on the road, park in a safe location<br>
    2. <strong>Don't force it</strong> — If something sounds/looks wrong, don't drive further<br>
    3. <strong>Consult a verified mechanic</strong> — A nearby professional can diagnose this accurately<br><br>
    💡 Would you like to describe the symptoms in more detail?<br><br>
    <em>🔧 Navigate to the Booking page to find a verified mechanic near you.</em>`;
}

/**
 * Toggle symptom selection
 */
function toggleSymptom(element) {
  element.classList.toggle('selected');
}

/**
 * Run AI diagnosis based on selected symptoms
 */
async function runDiagnosis() {
  const vehicle = document.getElementById('diagVehicle')?.value || 'car';
  const selectedSymptoms = Array.from(document.querySelectorAll('.issue-option.selected'))
    .map(el => el.dataset.symptom)
    .filter(Boolean);

  if (selectedSymptoms.length === 0) {
    showToast('Please select at least one symptom', 'warning');
    return;
  }

  const resultContainer = document.getElementById('predictionResult');
  if (!resultContainer) return;

  // Show loading
  resultContainer.style.display = 'block';
  resultContainer.innerHTML = `
    <div class="card" style="text-align:center;padding:var(--space-2xl);">
      <div class="spinner spinner-lg" style="margin:0 auto var(--space-md);"></div>
      <p class="text-muted">Analyzing symptoms...</p>
    </div>
  `;

  // Simulate AI analysis
  await new Promise(r => setTimeout(r, 2000));

  // Generate prediction based on symptoms
  const predictions = generatePredictions(vehicle, selectedSymptoms);

  resultContainer.innerHTML = `
    <div class="ai-disclaimer" style="margin-bottom:var(--space-md);">
      <span class="ai-disclaimer-icon">⚠️</span>
      <span class="ai-disclaimer-text">These are indicative predictions only. Consult a verified mechanic for accurate diagnosis.</span>
    </div>
    <h3 style="font-size:var(--fs-md);margin-bottom:var(--space-md);">🤖 AI Predictions (Indicative)</h3>
    ${predictions.map((p, i) => `
      <div class="ai-prediction-card mb-md animate-slideUp" style="animation-delay:${i * 100}ms;">
        <div class="flex justify-between items-center mb-sm">
          <strong>${p.issue}</strong>
          <span class="badge badge-active">${p.confidence}% match</span>
        </div>
        <p style="font-size:var(--fs-sm);color:var(--text-secondary);margin-bottom:var(--space-sm);">${p.description}</p>
        <div class="confidence-bar">
          <div class="confidence-fill" style="width:${p.confidence}%;"></div>
        </div>
        <div class="flex justify-between mt-sm" style="font-size:var(--fs-xs);color:var(--text-tertiary);">
          <span>Est. Cost: ~${formatCurrency(p.cost)}</span>
          <span>Est. Time: ~${p.time}</span>
        </div>
      </div>
    `).join('')}
    <p style="font-size:var(--fs-xs);color:var(--text-tertiary);text-align:center;margin:var(--space-md) 0;">
      🔧 Navigate to the Booking page to request a verified mechanic
    </p>
    <a href="booking.html" class="btn btn-emergency btn-block mt-md">🔧 Find Verified Mechanic</a>
  `;
}

/**
 * Generate predictions based on symptoms
 */
function generatePredictions(vehicle, symptoms) {
  const predictionMap = {
    'no-start': { issue: 'Dead Battery / Starter Failure', description: 'The vehicle may be unable to start, commonly caused by a drained battery or faulty starter motor.', confidence: 87, cost: 3000, time: '30-60 min' },
    'noise': { issue: 'Engine Belt or Bearing Wear', description: 'Unusual noises could indicate worn belts, loose components, or bearing issues.', confidence: 72, cost: 2500, time: '45-90 min' },
    'smoke': { issue: 'Coolant Leak or Oil Burning', description: 'Smoke from the engine area may indicate overheating, coolant leaks, or oil burning.', confidence: 81, cost: 4000, time: '60-120 min' },
    'leak': { issue: 'Fluid System Leak', description: 'Leaking fluid could be engine oil, coolant, brake fluid, or transmission fluid.', confidence: 78, cost: 2000, time: '30-90 min' },
    'vibration': { issue: 'Wheel Alignment or Suspension Issue', description: 'Vehicle vibrations could be caused by wheel imbalance, worn suspension, or tire issues.', confidence: 84, cost: 1500, time: '30-60 min' },
    'warning-light': { issue: 'Sensor or Emission System Fault', description: 'Dashboard warning lights may indicate sensor failures, emission issues, or engine management problems.', confidence: 68, cost: 1800, time: '30-45 min' },
  };

  return symptoms
    .map(s => predictionMap[s])
    .filter(Boolean)
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Handle image upload for visual diagnosis
 */
function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('imagePreview');
    const img = document.getElementById('previewImg');
    if (preview && img) {
      img.src = e.target.result;
      preview.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
}

/**
 * Analyze uploaded image
 */
async function analyzeImage() {
  const resultContainer = document.getElementById('imageResult');
  if (!resultContainer) return;

  resultContainer.style.display = 'block';
  resultContainer.innerHTML = `
    <div class="card" style="text-align:center;padding:var(--space-2xl);">
      <div class="spinner spinner-lg" style="margin:0 auto var(--space-md);"></div>
      <p class="text-muted">Analyzing image with AI...</p>
    </div>
  `;

  // Simulate AI analysis
  await new Promise(r => setTimeout(r, 2500));

  resultContainer.innerHTML = `
    <div class="ai-disclaimer" style="margin-bottom:var(--space-md);">
      <span class="ai-disclaimer-icon">⚠️</span>
      <span class="ai-disclaimer-text">Visual analysis is indicative only. A verified mechanic must confirm the diagnosis.</span>
    </div>
    <div class="ai-prediction-card animate-scaleIn">
      <div class="flex items-center gap-sm mb-md">
        <span style="font-size:1.5rem;">🔍</span>
        <strong style="font-size:var(--fs-md);">Visual Analysis Result (Indicative)</strong>
      </div>
      <div class="mb-md">
        <span class="badge badge-active mb-sm">~82% Confidence</span>
        <p style="font-size:var(--fs-base);color:var(--text-primary);font-weight:600;margin-top:var(--space-sm);">Possible Worn Brake Pads</p>
        <p style="font-size:var(--fs-sm);color:var(--text-secondary);">The image suggests significant wear on brake components. The brake pads appear to be below the minimum safe thickness. A verified mechanic should confirm and perform replacement if needed.</p>
      </div>
      <div class="price-breakdown">
        <div class="price-row">
          <span class="price-label">Possible Repair</span>
          <span class="price-value">Brake Pad Replacement</span>
        </div>
        <div class="price-row">
          <span class="price-label">Estimated Cost</span>
          <span class="price-value highlight">~${formatCurrency(2500)}</span>
        </div>
        <div class="price-row">
          <span class="price-label">Urgency</span>
          <span class="price-value" style="color:var(--emergency-red);">High — Consult Mechanic ASAP</span>
        </div>
      </div>
      <p style="font-size:var(--fs-xs);color:var(--text-tertiary);text-align:center;margin-top:var(--space-md);">
        🔧 Navigate to the Booking page to request a verified mechanic
      </p>
      <a href="booking.html" class="btn btn-emergency btn-block mt-md">🔧 Find Verified Mechanic</a>
    </div>
  `;
}
