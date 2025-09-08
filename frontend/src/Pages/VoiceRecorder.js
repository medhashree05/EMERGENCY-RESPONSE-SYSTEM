import React, { useState, useRef } from 'react'

const VoiceRecorder = ({ onSendAudio }) => {
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/wav',
        })
        onSendAudio(audioBlob) // send to backend
      }

      mediaRecorderRef.current.start()
      setRecording(true)
    } catch (err) {
      console.error('Error accessing microphone:', err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }

  const handleClick = () => {
    recording ? stopRecording() : startRecording()
  }

  return (
    <div className="voice-recorder">
      <button
        onClick={handleClick}
        className={`voice-btn ${recording ? 'recording' : ''}`}
      >
        {recording ? '⏹️' : '🎤'}
      </button>
    </div>
  )
}

export default VoiceRecorder
