/* ===================================================
   VRS API - AI Safety Layer Routes
   =================================================== */

const express = require('express');
const router = express.Router();
const { sanitizeInput } = require('../middleware/validation');
const { optionalAuth } = require('../middleware/auth');

const AI_DISCLAIMER = '⚠️ Disclaimer: AI suggestions are indicative only and should not replace professional mechanic advice. Always consult a verified mechanic for accurate diagnosis.';

/**
 * POST /api/ai/chat — Proxied AI chat with safety layer
 */
router.post('/chat', optionalAuth, async (req, res) => {
  try {
    const { message, conversation } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Sanitize input
    const sanitizedMessage = sanitizeInput(message.trim());

    if (sanitizedMessage.length > 1000) {
      return res.status(400).json({ error: 'Message too long. Maximum 1000 characters.' });
    }

    // Check for booking trigger attempts
    const bookingTriggerPatterns = [
      /book\s*(a\s*)?mechanic\s*automatically/i,
      /auto[\s-]*book/i,
      /create\s*booking\s*for\s*me/i,
      /schedule\s*repair\s*now/i,
    ];

    const isBookingAttempt = bookingTriggerPatterns.some(p => p.test(sanitizedMessage));

    // Build safe system prompt
    const systemPrompt = `You are VRS AI Assistant, an expert vehicle mechanic chatbot.
RULES:
- You help users diagnose vehicle issues and provide emergency advice.
- You MUST NOT create, confirm, or trigger any bookings. Only suggest users navigate to the booking page.
- You MUST NOT provide definitive diagnoses. Always say "this could be" or "possible cause".
- Keep responses concise and practical.
- Do NOT return any HTML, JavaScript, or executable code.
- Do NOT provide pricing guarantees. Say "estimated" or "approximate" costs only.
- If the issue seems dangerous, advise the user to stop driving immediately.`;

    // In demo mode, use local response
    const apiKey = process.env.OPENROUTER_API_KEY;
    let aiResponse;

    if (!apiKey || apiKey === 'your-openrouter-key') {
      // Demo mode — generate safe local response
      aiResponse = generateLocalResponse(sanitizedMessage, isBookingAttempt);
    } else {
      // Call OpenRouter with safety prompt
      try {
        const conversationHistory = Array.isArray(conversation) ? conversation.slice(-10) : [];

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-001',
            messages: [
              { role: 'system', content: systemPrompt },
              ...conversationHistory.map(m => ({
                role: sanitizeInput(m.role) === 'user' ? 'user' : 'assistant',
                content: sanitizeInput(m.content || '')
              })),
              { role: 'user', content: sanitizedMessage }
            ],
            max_tokens: 500,
            temperature: 0.7
          })
        });

        if (!response.ok) throw new Error('OpenRouter API failed');

        const data = await response.json();
        aiResponse = data.choices?.[0]?.message?.content || 'Sorry, I couldn\'t process that.';
      } catch (apiErr) {
        console.error('OpenRouter error:', apiErr.message);
        aiResponse = generateLocalResponse(sanitizedMessage, isBookingAttempt);
      }
    }

    // Sanitize AI output — strip any HTML/scripts that might have leaked
    aiResponse = sanitizeAIOutput(aiResponse);

    // Add disclaimer
    res.json({
      success: true,
      response: aiResponse,
      disclaimer: AI_DISCLAIMER,
      isBookingAttempt
    });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: 'AI service temporarily unavailable' });
  }
});

/**
 * Sanitize AI output — remove dangerous content
 */
function sanitizeAIOutput(text) {
  if (typeof text !== 'string') return '';

  return text
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove iframe
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: URLs
    .replace(/javascript\s*:/gi, '')
    // Keep safe HTML (bold, br, em, strong, p, ul, li)
    .replace(/<(?!\/?(?:b|br|em|strong|p|ul|ol|li)\b)[^>]+>/gi, '')
    .trim();
}

/**
 * Generate safe local response (demo/fallback)
 */
function generateLocalResponse(question, isBookingAttempt) {
  if (isBookingAttempt) {
    return '🤖 I can help you understand your vehicle issue, but I cannot create bookings automatically. For safety and accuracy, please navigate to the <strong>Booking page</strong> to request a verified mechanic. Would you like me to help diagnose your issue first?';
  }

  const lowerQ = question.toLowerCase();

  if (lowerQ.includes('won\'t start') || lowerQ.includes('not starting') || lowerQ.includes('dead')) {
    return '🔋 <strong>Possible Causes:</strong><br><br>1. <strong>Dead Battery</strong> — Most common cause. Try turning on headlights; if dim/off, battery is likely dead.<br>2. <strong>Faulty Starter Motor</strong> — Listen for clicking when turning the key.<br>3. <strong>Fuel Issue</strong> — Check fuel gauge.<br><br>💡 <strong>Suggestion:</strong> Try jump-starting with another vehicle. If that doesn\'t work, a verified mechanic can diagnose accurately.<br><br><em>Note: This is an approximate diagnosis. Please consult a verified mechanic for confirmation.</em>';
  }

  if (lowerQ.includes('brake') || lowerQ.includes('squeak')) {
    return '🛑 <strong>Possible Brake Issues:</strong><br><br>• <strong>Squeaking</strong> — Could indicate worn brake pads<br>• <strong>Grinding</strong> — Pads may be completely worn<br>• <strong>Soft pedal</strong> — Possible air in brake lines or low fluid<br><br>⚠️ <strong>Safety Warning:</strong> Brake issues are serious. If brakes feel unresponsive, stop driving immediately!<br><br>💡 Estimated repair cost: approximately ₹1,500 – ₹4,000 depending on the issue.<br><br><em>Note: This is an indicative diagnosis only.</em>';
  }

  if (lowerQ.includes('overheat') || lowerQ.includes('temperature') || lowerQ.includes('hot')) {
    return '🌡️ <strong>⚠️ POSSIBLE ENGINE OVERHEATING — STOP DRIVING!</strong><br><br><strong>Immediate Steps:</strong><br>1. Pull over safely and turn off the engine<br>2. Do NOT open the radiator cap<br>3. Wait 20-30 minutes for engine to cool<br><br><strong>Possible causes:</strong> Low coolant, broken thermostat, water pump failure<br><br>🚨 <em>This could be an emergency. Consider requesting a verified mechanic.</em>';
  }

  return '🤖 Thank you for describing the issue. Based on your description, here are some suggestions:<br><br>1. <strong>Stay safe</strong> — If on the road, park in a safe location<br>2. <strong>Don\'t force it</strong> — If something sounds/looks wrong, don\'t drive further<br>3. <strong>Consult a mechanic</strong> — A verified professional can diagnose this accurately<br><br>💡 Would you like to describe the symptoms in more detail?<br><br><em>Note: AI suggestions are indicative only and do not replace professional diagnosis.</em>';
}

module.exports = router;
