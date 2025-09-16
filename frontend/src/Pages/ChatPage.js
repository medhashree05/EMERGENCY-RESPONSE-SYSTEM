import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './VoiceRecorder.css'
import VoiceRecorder from './VoiceRecorder.js'
import './ChatPage.css'

function ChatPage() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your Emergency Response AI Assistant. How can I help you today? I can assist with emergency information, safety tips, first aid guidance, and connecting you with appropriate services.",
      sender: 'ai',
      timestamp: new Date(),
    },
  ])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isEmergency, setIsEmergency] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [messageCount, setMessageCount] = useState(0)
  const [showLocationPrompt, setShowLocationPrompt] = useState(false)
  const messagesEndRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation() // 🆕 Get location state for emergency data

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 🆕 Enhanced initialization for emergency sessions
  useEffect(() => {
    const initializeSession = () => {
      // Check if navigated from emergency (via location state)
      const emergencyState = location.state
      
      // Check for stored emergency response
      const storedEmergencyResponse = localStorage.getItem('emergencyResponse')
      const emergencySessionId = localStorage.getItem('emergencySessionId')
      
      if (emergencyState || (storedEmergencyResponse && emergencySessionId)) {
        // Handle emergency session
        const emergencyData = emergencyState || JSON.parse(storedEmergencyResponse)
        
        setSessionId(emergencySessionId)
        setIsEmergency(true)
        
        // Add emergency messages to chat
        const emergencyMessages = [
          {
            id: 1,
            text: "🚨 EMERGENCY SESSION ACTIVATED - I'm here to help you with your emergency situation!",
            sender: 'ai',
            timestamp: new Date(),
            isUrgent: true
          }
        ]
        
        if (storedEmergencyResponse) {
          const data = JSON.parse(storedEmergencyResponse)
          emergencyMessages.push(
            {
              id: 2,
              text: data.userMessage,
              sender: 'user',
              timestamp: new Date(data.timestamp),
              isUrgent: true
            },
            {
              id: 3,
              text: data.aiResponse,
              sender: 'ai',
              timestamp: new Date(),
              isUrgent: true
            }
          )
          
          // Clear stored emergency data
          localStorage.removeItem('emergencyResponse')
          localStorage.removeItem('emergencySessionId')
        }
        
        setMessages(emergencyMessages)
        setMessageCount(emergencyMessages.length - 1)
        
      } else {
        // Normal session initialization
        const savedSessionId = localStorage.getItem('chatSessionId')
        if (savedSessionId) {
          setSessionId(savedSessionId)
        }
      }
    }
    
    initializeSession()
  }, [location.state])

  // Save session ID when it changes (existing functionality)
  useEffect(() => {
    if (sessionId && !localStorage.getItem('emergencySessionId')) {
      localStorage.setItem('chatSessionId', sessionId)
    }
  }, [sessionId])

  // 🆕 Get authentication token
  const getAuthToken = () => {
    return localStorage.getItem('token')
  }

  // 🆕 Store location coordinates (existing functionality)
  const handleStoreLocation = async (latitude, longitude, address = null) => {
    const token = getAuthToken()
    
    if (!token) {
      alert('Please log in to save your location')
      return false
    }

    try {
      const response = await fetch('http://localhost:8000/chat/store-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ latitude, longitude, address })
      })

      const data = await response.json()
      
      if (data.success) {
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: `✅ Location saved successfully! Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          sender: 'ai',
          timestamp: new Date()
        }])
        return true
      } else {
        throw new Error(data.error || 'Failed to save location')
      }
    } catch (error) {
      console.error('Error storing location:', error)
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `❌ Failed to save location: ${error.message}`,
        sender: 'ai', 
        timestamp: new Date()
      }])
      return false
    }
  }

  // 🆕 Get current location using browser GPS (existing functionality)
  const getCurrentLocation = () => {
    setShowLocationPrompt(false)
    
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        await handleStoreLocation(latitude, longitude)
      },
      (error) => {
        console.error('Location error:', error)
        let errorMessage = 'Unable to get your location. '
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Location access denied by user.'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Location information is unavailable.'
            break
          case error.TIMEOUT:
            errorMessage += 'Location request timed out.'
            break
          default:
            errorMessage += 'An unknown error occurred.'
            break
        }
        
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: `📍 ${errorMessage} You can manually enter coordinates or address instead.`,
          sender: 'ai',
          timestamp: new Date()
        }])
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    )
  }

  async function handleSendMessage(textOverride = null) {
    const messageText = String(textOverride ?? inputText).trim()
    if (!messageText) return

    const newMessage = {
      id: Date.now(),
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, newMessage])
    setInputText('')
    setIsTyping(true)

    try {
      const token = getAuthToken()
      const headers = { 'Content-Type': 'application/json' }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          message: messageText,
          sessionId: sessionId
        }),
      })

      const data = await res.json()
      const aiResponse = data.reply || '⚠️ Sorry, I could not process that.'

      // Update session info from response
      if (data.sessionId) {
        setSessionId(data.sessionId)
      }
      if (data.messageCount) {
        setMessageCount(data.messageCount)
      }

      setMessages((prev) => [
        ...prev,
        { 
          id: Date.now(),
          text: aiResponse, 
          sender: 'ai', 
          timestamp: new Date() 
        },
      ])

      // Handle location detection (existing functionality)
      if (data.locationDetected) {
        const coordinatePattern = /(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/
        const coordinateMatch = messageText.match(coordinatePattern)
        
        if (!coordinateMatch && token) {
          setShowLocationPrompt(true)
        }
      }

      // Check for emergency keywords and set alert
      const emergencyKeywords = ['emergency', 'help', 'urgent', 'pain', 'fire', 'accident', 'bleeding', 'police', 'ambulance', 'medical']
      const hasEmergencyKeyword = emergencyKeywords.some(keyword => 
        messageText.toLowerCase().includes(keyword) || 
        aiResponse.toLowerCase().includes(keyword)
      )
      
      if (hasEmergencyKeyword && !isEmergency) {
        setIsEmergency(true)
      }

    } catch (error) {
      console.error('Error fetching AI response:', error)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: '⚠️ Network error. Please try again.',
          sender: 'ai',
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  // Clear chat session
  const handleClearChat = async () => {
    if (!sessionId) return

    try {
      await fetch(`http://localhost:8000/chat/session/${sessionId}`, {
        method: 'DELETE'
      })
    } catch (error) {
      console.error('Error clearing session:', error)
    }

    // Reset local state
    setMessages([{
      id: 1,
      text: "Hello! I'm your Emergency Response AI Assistant. How can I help you today?",
      sender: 'ai',
      timestamp: new Date(),
    }])
    setSessionId(null)
    setMessageCount(0)
    setIsEmergency(false) // 🆕 Reset emergency state
    setShowLocationPrompt(false)
    localStorage.removeItem('chatSessionId')
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleEmergencyCall = () => {
    window.location.href = 'tel:911'
  }

  // 🆕 Enhanced quick responses for emergency scenarios
  const quickResponses = [
    'I need help with first aid',
    'How do I call emergency services?',
    "I'm having chest pain",
    "There's a fire",
    'I need mental health support',
    "I'm lost and need location help",
    'Store my current location',
    'What should I do while waiting for help?', // 🆕 Emergency-specific
    'Find nearest hospital', // 🆕 Emergency-specific
    'Contact emergency services' // 🆕 Emergency-specific
  ]

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
            <span className="chat-status">
              {isEmergency ? '🚨 Emergency Mode' : 'Online'} • {messageCount > 0 && `${messageCount} messages`}
            </span>
          </div>
          <div className="header-actions">
            {messageCount > 1 && (
              <button 
                className="clear-chat-btn" 
                onClick={handleClearChat}
                title="Clear conversation"
              >
                🗑️
              </button>
            )}
            <button className="emergency-call-btn" onClick={handleEmergencyCall}>
              🚨 Call 911
            </button>
          </div>
        </div>
      </header>

      {/* Emergency Alert */}
      {isEmergency && (
        <div className="emergency-alert">
          <div className="emergency-alert-content">
            <span className="emergency-icon">🚨</span>
            <div className="emergency-text">
              <strong>Emergency Mode Active</strong>
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

      {/* Location Prompt (existing functionality) */}
      {showLocationPrompt && (
        <div className="location-prompt">
          <div className="location-prompt-content">
            <span className="location-icon">📍</span>
            <div className="location-text">
              <strong>Enable Location Sharing</strong>
              <p>Allow location access to save your coordinates for emergency services</p>
            </div>
            <div className="location-actions">
              <button 
                className="location-allow-btn"
                onClick={getCurrentLocation}
              >
                Allow Location
              </button>
              <button
                className="location-deny-btn"
                onClick={() => setShowLocationPrompt(false)}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="chat-container">
        <div className="messages-container">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.sender} ${
                message.isUrgent ? 'urgent' : ''
              }`}
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
                      minute: '2-digit',
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
          {quickResponses.map((text, idx) => (
            <button
              key={idx}
              className="quick-response-btn"
              onClick={() => handleSendMessage(text)}
            >
              {text}
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
            disabled={isTyping}
          />
          <button
            className="send-button"
            onClick={() => handleSendMessage()}
            disabled={inputText.trim() === '' || isTyping}
          >
            <span className="send-icon">➤</span>
          </button>
          <VoiceRecorder onSendAudio={handleSendMessage} />
        </div>
      </div>
    </div>
  )
}

export default ChatPage