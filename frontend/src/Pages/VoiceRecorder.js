import React, { useRef, useState } from 'react'

export default function VoiceRecorder({ onSendAudio }) {
  const mediaRecorderRef = useRef(null)
  const [isRecording, setIsRecording] = useState(false)
  const [audioChunks, setAudioChunks] = useState([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // ✅ Specify supported formats explicitly
      const options = {
        mimeType: 'audio/webm;codecs=opus',
      }

      // Fallback to other formats if webm isn't supported
      if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options.mimeType = 'audio/mp4'
        } else if (MediaRecorder.isTypeSupported('audio/wav')) {
          options.mimeType = 'audio/wav'
        }
      }

      mediaRecorderRef.current = new MediaRecorder(stream, options)
      setAudioChunks([])

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks((prev) => [...prev, event.data])
        }
      }

      mediaRecorderRef.current.onstop = async () => {
        // ✅ Create blob with the same MIME type used for recording
        const mimeType = mediaRecorderRef.current.mimeType
        const audioBlob = new Blob(audioChunks, { type: mimeType })

        // ✅ Determine file extension based on MIME type
        let fileExtension = 'webm'
        let fileName = 'voice.webm'

        if (mimeType.includes('mp4')) {
          fileExtension = 'mp4'
          fileName = 'voice.mp4'
        } else if (mimeType.includes('wav')) {
          fileExtension = 'wav'
          fileName = 'voice.wav'
        } else if (mimeType.includes('ogg')) {
          fileExtension = 'ogg'
          fileName = 'voice.ogg'
        }

        const audioFile = new File([audioBlob], fileName, { type: mimeType })

        try {
          const formData = new FormData()
          formData.append('file', audioFile)

          console.log(
            `Sending audio file: ${fileName} (${mimeType}), size: ${audioFile.size} bytes`
          )

          const res = await fetch('http://localhost:8000/transcribe', {
            method: 'POST',
            body: formData,
          })

          if (!res.ok) {
            const errorText = await res.text()
            throw new Error(`HTTP ${res.status}: ${errorText}`)
          }

          const data = await res.json()

          if (data.text && data.text.trim()) {
            onSendAudio(data.text.trim())
          } else {
            onSendAudio('⚠️ No speech detected in audio.')
          }
        } catch (err) {
          console.error('Transcription error:', err)
          onSendAudio('⚠️ Transcription failed. Please try again.')
        }

        // ✅ Clean up - stop all tracks
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Mic access denied:', err)
      onSendAudio(
        '⚠️ Microphone access denied. Please check your browser permissions.'
      )
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  return (
    <div className="voice-recorder">
      {!isRecording ? (
        <button
          className="voice-btn start-recording"
          onClick={startRecording}
          title="Start voice recording"
        >
          🎤 Start
        </button>
      ) : (
        <button
          className="voice-btn stop-recording"
          onClick={stopRecording}
          title="Stop recording and transcribe"
        >
          ⏹ Stop
        </button>
      )}
    </div>
  )
}
