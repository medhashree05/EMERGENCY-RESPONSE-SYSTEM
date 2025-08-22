import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ChatPage.css';

function ChatPage() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your Emergency Response AI Assistant. How can I help you today? I can assist with emergency information, safety tips, first aid guidance, and connecting you with appropriate services.",
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const emergencyKeywords = ['emergency', 'help', 'urgent', 'danger', 'fire', 'police', 'medical', 'accident', 'hurt', 'injured', 'bleeding', 'chest pain', 'unconscious', 'robbery', 'attack'];

  const getAIResponse = (userMessage) => {
    const message = userMessage.toLowerCase();
    
    // Check for emergency keywords
    const isEmergencyMessage = emergencyKeywords.some(keyword => message.includes(keyword));
    
    if (isEmergencyMessage) {
      setIsEmergency(true);
      return {
        text: "🚨 I detect this might be an emergency situation. If you're in immediate danger, please call emergency services right away!\n\n• Police: 911\n• Medical: 911\n• Fire: 911\n\nWould you like me to help you connect with emergency services or provide immediate guidance while help is on the way?",
        isUrgent: true
      };
    }

    // First aid responses
    if (message.includes('first aid') || message.includes('bleeding') || message.includes('wound')) {
      return {
        text: "🩹 For bleeding wounds:\n1. Apply direct pressure with a clean cloth\n2. Elevate the wound above heart level if possible\n3. Don't remove embedded objects\n4. Seek medical attention if bleeding is severe\n\nFor serious injuries, call 911 immediately. Would you like more specific first aid information?",
        isUrgent: false
      };
    }

    if (message.includes('chest pain') || message.includes('heart attack')) {
      return {
        text: "⚠️ Chest pain can be serious! Call 911 immediately if experiencing:\n• Severe chest pain or pressure\n• Pain radiating to arm, jaw, or back\n• Shortness of breath\n• Nausea or sweating\n\nWhile waiting for help:\n1. Stay calm and sit down\n2. Loosen tight clothing\n3. Take aspirin if not allergic\n\nThis is potentially life-threatening - don't delay calling 911!",
        isUrgent: true
      };
    }

    if (message.includes('fire') || message.includes('smoke')) {
      return {
        text: "🔥 Fire Safety Protocol:\n1. GET OUT immediately - don't gather belongings\n2. Feel doors before opening (hot = don't open)\n3. Stay low under smoke\n4. Call 911 once you're safely outside\n5. Go to your meeting point\n\nNever go back inside a burning building. Are you currently safe?",
        isUrgent: true
      };
    }

    if (message.includes('location') || message.includes('where am i')) {
      return {
        text: "📍 To help emergency services find you:\n1. Enable location services on your device\n2. Know your exact address if possible\n3. Look for landmarks or cross streets\n4. Stay on the line with 911\n\nI can help you identify your location. Are you able to see any street signs or landmarks?",
        isUrgent: false
      };
    }

    if (message.includes('poison') || message.includes('overdose')) {
      return {
        text: "☠️ Poison Control Emergency:\n• Call Poison Control: 1-800-222-1222\n• Call 911 if unconscious or difficulty breathing\n\nDO NOT induce vomiting unless told to do so.\nHave the poison container ready when calling.\n\nWhat type of substance was involved?",
        isUrgent: true
      };
    }

    if (message.includes('panic') || message.includes('anxiety') || message.includes('stress')) {
      return {
        text: "🫁 For panic or anxiety:\n1. Focus on slow, deep breathing\n2. Count: inhale for 4, hold for 4, exhale for 4\n3. Ground yourself: name 5 things you can see\n4. You're safe - this feeling will pass\n\nIf you're having thoughts of self-harm, please call:\n• National Suicide Prevention Lifeline: 988\n• Crisis Text Line: Text HOME to 741741\n\nAre you in a safe place right now?",
        isUrgent: false
      };
    }

    // General helpful responses
    if (message.includes('hello') || message.includes('hi')) {
      return {
        text: "Hello! I'm here to help with any emergency-related questions or situations. I can provide:\n• First aid guidance\n• Emergency contact information\n• Safety tips and protocols\n• Help connecting with services\n\nWhat can I assist you with today?",
        isUrgent: false
      };
    }

    // Default response
    return {
      text: "I understand you need assistance. I'm here to help with emergency situations, safety information, and connecting you with appropriate services.\n\nCould you please provide more details about your situation? For immediate emergencies, always call 911 first.\n\nSome ways I can help:\n• Emergency procedures and protocols\n• First aid guidance\n• Safety tips\n• Connecting with emergency services\n• Mental health resources",
      isUrgent: false
    };
  };

  const handleSendMessage = () => {
    if (inputText.trim() === '') return;

    const userMessage = {
      id: Date.now(),
      text: inputText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const aiResponse = getAIResponse(inputText);
      const aiMessage = {
        id: Date.now() + 1,
        text: aiResponse.text,
        sender: 'ai',
        timestamp: new Date(),
        isUrgent: aiResponse.isUrgent
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEmergencyCall = () => {
    window.location.href = 'tel:911';
  };

  const quickResponses = [
    "I need help with first aid",
    "How do I call emergency services?",
    "I'm having chest pain",
    "There's a fire",
    "I need mental health support",
    "I'm lost and need location help"
  ];

  return (
    <div className="chat-page">
      {/* Header */}
      <header className="chat-header">
        <div className="chat-header-content">
          <button 
            className="back-button"
            onClick={() => navigate('/')}
          >
            ← Back
          </button>
          <div className="chat-title">
            <h1>🤖 Emergency AI Assistant</h1>
            <span className="chat-status">Online • Ready to help</span>
          </div>
          <button 
            className="emergency-call-btn"
            onClick={handleEmergencyCall}
          >
            🚨 Call 911
          </button>
        </div>
      </header>

      {/* Emergency Alert */}
      {isEmergency && (
        <div className="emergency-alert">
          <div className="emergency-alert-content">
            <span className="emergency-icon">🚨</span>
            <div className="emergency-text">
              <strong>Emergency Detected</strong>
              <p>If this is a life-threatening emergency, call 911 immediately</p>
            </div>
            <button 
              className="emergency-dismiss"
              onClick={() => setIsEmergency(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="chat-container">
        <div className="messages-container">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`message ${message.sender} ${message.isUrgent ? 'urgent' : ''}`}
            >
              <div className="message-content">
                <div className="message-avatar">
                  {message.sender === 'ai' ? '🤖' : '👤'}
                </div>
                <div className="message-bubble">
                  <div className="message-text">
                    {message.text.split('\n').map((line, index) => (
                      <div key={index}>{line}</div>
                    ))}
                  </div>
                  <div className="message-time">
                    {message.timestamp.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {/* Typing Indicator */}
          {isTyping && (
            <div className="message ai">
              <div className="message-content">
                <div className="message-avatar">🤖</div>
                <div className="message-bubble typing">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Response Buttons */}
      <div className="quick-responses">
        <div className="quick-responses-container">
          {quickResponses.map((response, index) => (
            <button
              key={index}
              className="quick-response-btn"
              onClick={() => setInputText(response)}
            >
              {response}
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        <div className="chat-input-container">
          <textarea
            className="chat-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here... For emergencies, call 911 immediately."
            rows="1"
          />
          <button 
            className="send-button"
            onClick={handleSendMessage}
            disabled={inputText.trim() === ''}
          >
            <span className="send-icon">➤</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatPage;