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

  // ---- Single handleSendMessage that calls backend ----
  const handleSendMessage = async () => {
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

    try {
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inputText }),
      });

      const data = await res.json();
      console.log(data);
      const aiMessage = {
        id: Date.now() + 1,
        text: data.reply || "⚠️ Sorry, I couldn't process that.",
        sender: 'ai',
        timestamp: new Date(),
        isUrgent: false
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage = {
        id: Date.now() + 2,
        text: "⚠️ Network error. Please try again.",
        sender: 'ai',
        timestamp: new Date(),
        isUrgent: false
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
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
          <button className="back-button" onClick={() => navigate('/')}>
            ← Back
          </button>
          <div className="chat-title">
            <h1>🤖 Emergency AI Assistant</h1>
            <span className="chat-status">Online • Ready to help</span>
          </div>
          <button className="emergency-call-btn" onClick={handleEmergencyCall}>
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
            <button className="emergency-dismiss" onClick={() => setIsEmergency(false)}>
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
                    <span></span><span></span><span></span>
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
