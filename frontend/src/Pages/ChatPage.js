import { useState, useEffect, useRef } from 'react'
import './ChatPage.css'
import './VoiceRecorder.css' // ✅ Import recorder CSS
import VoiceRecorder from './VoiceRecorder'

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)

  async function handleSendMessage(textOverride = null) {
    const messageText = textOverride ?? inputText
    if (!messageText.trim()) return

    const newMessage = {
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, newMessage])
    setInputText('')
    setIsTyping(true)

    try {
      // ✅ Call Grok API for AI response
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.REACT_APP_GROK_API_KEY}`, // ✅ Store API key in .env
        },
        body: JSON.stringify({
          model: 'grok-beta',
          messages: [
            {
              role: 'system',
              content: 'You are an emergency chatbot assistant.',
            },
            ...messages.map((m) => ({
              role: m.sender === 'user' ? 'user' : 'assistant',
              content: m.text,
            })),
            { role: 'user', content: messageText },
          ],
        }),
      })

      const data = await res.json()
      const aiResponse =
        data.choices?.[0]?.message?.content || '⚠️ No response from AI.'

      setMessages((prev) => [
        ...prev,
        { text: aiResponse, sender: 'ai', timestamp: new Date() },
      ])
    } catch (error) {
      console.error('Error fetching Grok response:', error)
      setMessages((prev) => [
        ...prev,
        {
          text: '⚠️ Unable to connect to Grok. Please try again.',
          sender: 'ai',
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsTyping(false)
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
        {quickResponses.map((response, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(response)}
            className="quick-btn"
          >
            {response}
          </button>
        ))}
      </div>

      {/* Input + Voice */}
      <div className="chat-input-container">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
          disabled={isTyping}
        />
        <button onClick={() => handleSendMessage()} disabled={isTyping}>
          Send
        </button>
        {/* 🎤 Voice Recorder */}
        <VoiceRecorder onSendAudio={handleSendMessage} />
      </div>
    </div>
  )
}
