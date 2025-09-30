import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './VoiceRecorder.css'
import VoiceRecorder from './VoiceRecorder.js'
import './ChatPage.css'

function ChatPage() {
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isEmergency, setIsEmergency] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [messageCount, setMessageCount] = useState(0)
  const [showLocationPrompt, setShowLocationPrompt] = useState(false)
  const [currentEmergencyType, setCurrentEmergencyType] = useState(null)
  
  // New state for emergency creation flow
  const [emergencyCreationFlow, setEmergencyCreationFlow] = useState({
    isActive: false,
    step: null, // 'type', 'location', 'description', 'confirm'
    data: {
      type: null,
      location: null,
      description: null
    }
  })

  const messagesEndRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Emergency type options
  const emergencyTypes = [
    'Police Emergency',
    'Medical Emergency', 
    'Fire Emergency',
    'Accident Emergency'
  ]

  const getAuthToken = () => {
    return localStorage.getItem('token')
  }

  // Function to get emergency-specific intro messages
  const getEmergencyIntroMessage = (emergencyType) => {
    const emergencyIntros = {
      'Police Emergency': {
        icon: '🛡️',
        title: 'POLICE EMERGENCY ASSISTANCE',
        message: "🚨 **POLICE EMERGENCY ACTIVE** - I'm here to help with your police emergency situation!"
      },
      'Medical Emergency': {
        icon: '❤️',
        title: 'MEDICAL EMERGENCY ASSISTANCE',
        message: "🚑 **MEDICAL EMERGENCY ACTIVE** - I'm here to provide immediate medical guidance!"
      },
      'Fire Emergency': {
        icon: '🔥',
        title: 'FIRE EMERGENCY ASSISTANCE',
        message: "🔥 **FIRE EMERGENCY ACTIVE** - I'm here to help with fire safety and evacuation!"
      },
      'Accident Emergency': {
        icon: '🚗',
        title: 'ACCIDENT EMERGENCY ASSISTANCE',
        message: "🚗 **ACCIDENT EMERGENCY ACTIVE** - I'm here to help with accident response and safety!"
      }
    }

    return emergencyIntros[emergencyType] || {
      icon: '🚨',
      title: 'EMERGENCY ASSISTANCE',
      message: "🚨 **EMERGENCY ACTIVE** - I'm here to help with your emergency situation!"
    }
  }

  const getDefaultIntroMessage = () => {
    return {
      icon: '🤖',
      title: 'Emergency Response AI Assistant',
      message: "Hello! I'm your Emergency Response AI Assistant. How can I help you today?"
    }
  }

  // Function to detect emergency creation intent
  const detectEmergencyCreationIntent = (message) => {
    const creationKeywords = [
      'report emergency',
      'create emergency',
      'log emergency',
      'report an emergency',
      'need to report',
      'file emergency',
      'register emergency',
      'submit emergency',
      'i have an emergency',
      'there is an emergency'
    ]
    
    return creationKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    )
  }

  // Function to start emergency creation flow
  const startEmergencyCreation = () => {
    setEmergencyCreationFlow({
      isActive: true,
      step: 'type',
      data: { type: null, location: null, description: null }
    })

    setMessages(prev => [...prev, {
      id: Date.now(),
      text: `🚨 **Emergency Report Creation**\n\nI'll help you create an emergency report. Let's start:\n\n**Step 1: Select Emergency Type**\n\nPlease choose the type of emergency:`,
      sender: 'ai',
      timestamp: new Date(),
      isUrgent: true
    }])
  }

  // Function to handle emergency creation steps
  const handleEmergencyCreationStep = async (userInput) => {
    const { step, data } = emergencyCreationFlow

    switch (step) {
      case 'type':
        const selectedType = emergencyTypes.find(type => 
          userInput.toLowerCase().includes(type.toLowerCase()) ||
          userInput === type
        )

        if (selectedType) {
          setEmergencyCreationFlow(prev => ({
            ...prev,
            step: 'location',
            data: { ...prev.data, type: selectedType }
          }))

          setMessages(prev => [...prev, {
            id: Date.now(),
            text: `✅ Emergency Type: **${selectedType}**\n\n**Step 2: Provide Location**\n\nPlease share your location by:\n• Using the location button below\n• Typing your address\n• Providing coordinates (latitude, longitude)`,
            sender: 'ai',
            timestamp: new Date(),
            isUrgent: true
          }])

          setShowLocationPrompt(true)
        } else {
          setMessages(prev => [...prev, {
            id: Date.now(),
            text: `⚠️ Please select a valid emergency type from the options above.`,
            sender: 'ai',
            timestamp: new Date()
          }])
        }
        break

      case 'location':
        setEmergencyCreationFlow(prev => ({
          ...prev,
          step: 'description',
          data: { ...prev.data, location: userInput }
        }))

        setMessages(prev => [...prev, {
          id: Date.now(),
          text: `✅ Location saved: ${userInput}\n\n**Step 3: Describe the Situation**\n\nPlease provide a brief description of the emergency situation:`,
          sender: 'ai',
          timestamp: new Date(),
          isUrgent: true
        }])
        break

      case 'description':
        setEmergencyCreationFlow(prev => ({
          ...prev,
          step: 'confirm',
          data: { ...prev.data, description: userInput }
        }))

        const confirmationText = `✅ Description saved.\n\n**Emergency Report Summary:**\n\n🚨 **Type:** ${data.type}\n📍 **Location:** ${data.location}\n📝 **Description:** ${userInput}\n\n**Is this information correct?**\nType "confirm" to submit or "cancel" to start over.`

        setMessages(prev => [...prev, {
          id: Date.now(),
          text: confirmationText,
          sender: 'ai',
          timestamp: new Date(),
          isUrgent: true
        }])
        break

      case 'confirm':
        if (userInput.toLowerCase().includes('confirm')) {
          await submitEmergencyReport()
        } else if (userInput.toLowerCase().includes('cancel')) {
          cancelEmergencyCreation()
        } else {
          setMessages(prev => [...prev, {
            id: Date.now(),
            text: `Please type "confirm" to submit the emergency report or "cancel" to start over.`,
            sender: 'ai',
            timestamp: new Date()
          }])
        }
        break
    }
  }

  // Function to submit emergency report to backend
  const submitEmergencyReport = async () => {
    const { type, location, description } = emergencyCreationFlow.data
    const token = getAuthToken()

    if (!token) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `❌ You must be logged in to create an emergency report. Please log in and try again.`,
        sender: 'ai',
        timestamp: new Date()
      }])
      setEmergencyCreationFlow({ isActive: false, step: null, data: {} })
      return
    }

    setIsTyping(true)

    try {
      const response = await fetch('http://localhost:8000/emergency/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type,
          location,
          description,
          priority: 'Critical'
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: `✅ **Emergency Report Created Successfully!**\n\n📋 **Report ID:** ${result.emergency.id}\n🚨 **Type:** ${result.emergency.type}\n📍 **Location:** ${result.emergency.location}\n⏰ **Status:** ${result.emergency.status}\n\nEmergency services have been notified. Help is on the way!`,
          sender: 'ai',
          timestamp: new Date(),
          isUrgent: true
        }])

        setEmergencyCreationFlow({ isActive: false, step: null, data: {} })
        setIsEmergency(true)
      } else {
        throw new Error(result.error || 'Failed to create emergency report')
      }
    } catch (error) {
      console.error('Emergency creation error:', error)
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `❌ Failed to create emergency report: ${error.message}\n\nPlease try again or contact emergency services directly.`,
        sender: 'ai',
        timestamp: new Date()
      }])
    } finally {
      setIsTyping(false)
    }
  }

  // Function to cancel emergency creation
  const cancelEmergencyCreation = () => {
    setEmergencyCreationFlow({ isActive: false, step: null, data: {} })
    setMessages(prev => [...prev, {
      id: Date.now(),
      text: `Emergency report creation cancelled. How else can I help you?`,
      sender: 'ai',
      timestamp: new Date()
    }])
  }

  // Handle location for emergency creation
  const handleEmergencyLocation = async (latitude, longitude) => {
    if (emergencyCreationFlow.isActive && emergencyCreationFlow.step === 'location') {
      const locationString = `${latitude}, ${longitude}`
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: locationString,
        sender: 'user',
        timestamp: new Date()
      }])

      await handleEmergencyCreationStep(locationString)
      setShowLocationPrompt(false)
    }
  }

  const getCurrentLocation = () => {
    setShowLocationPrompt(false)
    
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        
        if (emergencyCreationFlow.isActive && emergencyCreationFlow.step === 'location') {
          await handleEmergencyLocation(latitude, longitude)
        } else {
          await handleStoreLocation(latitude, longitude)
        }
      },
      (error) => {
        console.error('Location error:', error)
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: `📍 Unable to get location. Please enter manually.`,
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

    // Check if in emergency creation flow
    if (emergencyCreationFlow.isActive) {
      await handleEmergencyCreationStep(messageText)
      return
    }

    // Check if user wants to create emergency report
    if (detectEmergencyCreationIntent(messageText)) {
      startEmergencyCreation()
      return
    }

    // Normal chat flow continues...
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

      if (data.locationDetected) {
        const coordinatePattern = /(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/
        const coordinateMatch = messageText.match(coordinatePattern)
        
        if (!coordinateMatch && token) {
          setShowLocationPrompt(true)
        }
      }

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

  const handleClearChat = async () => {
    if (!sessionId) return

    try {
      await fetch(`http://localhost:8000/chat/session/${sessionId}`, {
        method: 'DELETE'
      })
    } catch (error) {
      console.error('Error clearing session:', error)
    }

    const defaultIntro = getDefaultIntroMessage()
    setMessages([{
      id: 1,
      text: defaultIntro.message,
      sender: 'ai',
      timestamp: new Date(),
      icon: defaultIntro.icon,
      title: defaultIntro.title
    }])
    setSessionId(null)
    setMessageCount(0)
    setIsEmergency(false)
    setCurrentEmergencyType(null)
    setShowLocationPrompt(false)
    setEmergencyCreationFlow({ isActive: false, step: null, data: {} })
    localStorage.removeItem('chatSessionId')
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleEmergencyCall = () => {
    window.location.href = 'tel:100'
  }

  const getQuickResponses = () => {
    if (emergencyCreationFlow.isActive) {
      switch (emergencyCreationFlow.step) {
        case 'type':
          return emergencyTypes
        case 'confirm':
          return ['Confirm', 'Cancel']
        default:
          return []
      }
    }
    
    return [
      'Report an emergency',
      'I need help with first aid',
      'Find nearest hospital',
      'Store my current location'
    ]
  }

  const quickResponses = getQuickResponses()

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div className="chat-header-content">
          <button className="back-button" onClick={() => navigate('/')}>
            ← Back
          </button>
          <div className="chat-title">
            <h1>
              {currentEmergencyType ? 
                getEmergencyIntroMessage(currentEmergencyType).icon : '🤖'} 
              Emergency AI Assistant
            </h1>
            <span className="chat-status">
              {emergencyCreationFlow.isActive ? 
                `📝 Creating Emergency Report (Step ${['type', 'location', 'description', 'confirm'].indexOf(emergencyCreationFlow.step) + 1}/4)` : 
                isEmergency ? `🚨 ${currentEmergencyType || 'Emergency Mode'}` : 'Online'
              } • {messageCount > 0 && `${messageCount} messages`}
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
              🚨 Call 100
            </button>
          </div>
        </div>
      </header>

      {isEmergency && (
        <div className={`emergency-alert ${currentEmergencyType ? currentEmergencyType.toLowerCase().replace(' ', '-') : ''}`}>
          <div className="emergency-alert-content">
            <span className="emergency-icon">
              {currentEmergencyType ? getEmergencyIntroMessage(currentEmergencyType).icon : '🚨'}
            </span>
            <div className="emergency-text">
              <strong>{currentEmergencyType || 'Emergency Mode Active'}</strong>
              <p>If this is a life-threatening emergency, call emergency services immediately</p>
            </div>
            <button
              className="emergency-dismiss"
              onClick={() => {
                setIsEmergency(false)
                setCurrentEmergencyType(null)
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {showLocationPrompt && (
        <div className="location-prompt">
          <div className="location-prompt-content">
            <span className="location-icon">📍</span>
            <div className="location-text">
              <strong>Enable Location Sharing</strong>
              <p>Allow location access {emergencyCreationFlow.isActive ? 'for emergency report' : 'to save your coordinates'}</p>
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

      <div className="chat-container">
        <div className="messages-container">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.sender} ${
                message.isUrgent ? 'urgent' : ''
              } ${message.emergencyType ? 'emergency-intro' : ''}`}
            >
              <div className="message-content">
                <div className="message-avatar">
                  {message.sender === 'ai' ? (message.icon || '🤖') : '👤'}
                </div>
                <div className="message-bubble">
                  {message.title && (
                    <div className="message-title">
                      {message.title}
                    </div>
                  )}
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

      <div className="chat-input-area">
        <div className="chat-input-container">
          <textarea
            className="chat-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              emergencyCreationFlow.isActive
                ? `Enter ${emergencyCreationFlow.step}...`
                : currentEmergencyType ? 
                  `Describe your ${currentEmergencyType.toLowerCase()} situation...` : 
                  "Type 'report an emergency' to create an emergency report..."
            }
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