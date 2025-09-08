import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './VoiceRecorder.css' // ✅ Import recorder CSS
import VoiceRecorder from './voiceRecorder'
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
  const messagesEndRef = useRef(null)
  const navigate = useNavigate()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // ---- Single handleSendMessage that calls backend ----

  async function handleSendMessage(textOverride = null) {
    const messageText = String(textOverride ?? inputText).trim() // ✅ always a string
    if (!messageText) return

    const newMessage = {
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, newMessage])
    setInputText('')
    setIsTyping(true)

    try {
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }), // ✅ safe
      })

      const data = await res.json()
      const aiResponse = data.reply || '⚠️ Sorry, I could not process that.'

      setMessages((prev) => [
        ...prev,
        { text: aiResponse, sender: 'ai', timestamp: new Date() },
      ])
    } catch (error) {
      console.error('Error fetching AI response:', error)
      setMessages((prev) => [
        ...prev,
        {
          text: '⚠️ Network error. Please try again.',
          sender: 'ai',
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const quickResponses = [
    'I need help',
    'Call police',
    'Nearest hospital',
    'Emergency number',
  ]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="chat-container">
      <div className="chat-header">🚨 Emergency Chat Assistant</div>

      <div className="chat-messages">
        {messages.map((message, idx) => (
          <div
            key={idx}
            className={`chat-message ${
              message.sender === 'user' ? 'user' : 'ai'
            }`}
          >
            <div className="message-text">{message.text}</div>
            <div className="message-time">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        ))}
        {isTyping && <div className="typing-indicator">AI is typing...</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick response buttons */}
      <div className="quick-responses">
        <div className="quick-responses-container">
          {quickResponses.map((text, idx) => (
            <button
              key={idx}
              className="quick-response-btn"
              onClick={() => handleSendMessage(text)} // ✅ directly sends
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
  )
}
