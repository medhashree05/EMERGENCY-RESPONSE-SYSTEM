// backend/index.js
const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const bcrypt = require('bcryptjs')
const twilio = require('twilio')
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')
const jwt = require('jsonwebtoken')
const Groq = require('groq-sdk')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { Console } = require('console')
dotenv.config()
const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 8000

// Enhanced multer configuration with better error handling
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadsDir = path.join(__dirname, 'uploads')
      try {
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true })
        }
        cb(null, uploadsDir)
      } catch (err) {
        console.error('Failed to create upload directory:', err)
        cb(new Error('Server upload directory error'), false)
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
      const ext = path.extname(file.originalname) || '.webm'
      cb(null, `audio-${uniqueSuffix}${ext}`)
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/mp4',
      'audio/ogg',
      'audio/opus',
    ]

    console.log('Received file mimetype:', file.mimetype)

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(
        new Error(
          `Unsupported format: ${file.mimetype}. Please record in a supported format.`
        ),
        false
      )
    }
  },
})

// Optimized transcription endpoint with retry logic
app.post('/transcribe', upload.single('file'), async (req, res) => {
  let filePath = null
  const startTime = Date.now()

  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file received. Please try recording again.',
      })
    }

    filePath = req.file.path
    console.log(`\n📁 [TRANSCRIBE] New request:`)
    console.log(`   File: ${req.file.filename}`)
    console.log(`   Size: ${(req.file.size / 1024).toFixed(2)} KB`)
    console.log(`   Type: ${req.file.mimetype}`)

    // Verify file exists and isn't empty
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found after upload')
    }

    const stats = fs.statSync(filePath)
    if (stats.size === 0) {
      throw new Error('Uploaded file is empty')
    }

    if (stats.size < 1000) {
      // Less than 1KB is suspicious
      throw new Error('Audio file too small, may be corrupted')
    }

    // Transcription with timeout and retry
    let transcription
    let lastError
    const maxRetries = 2

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`   Attempt ${attempt}/${maxRetries}...`)

        const transcriptionPromise = groq.audio.transcriptions.create({
          file: fs.createReadStream(filePath),
          model: 'whisper-large-v3',
          language: 'en',
          response_format: 'json',
          temperature: 0.0,
        })

        // 45 second timeout per attempt
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Transcription timeout')),
            45000
          )
        )

        transcription = await Promise.race([
          transcriptionPromise,
          timeoutPromise,
        ])

        // Success - break retry loop
        break
      } catch (err) {
        lastError = err
        console.error(`   Attempt ${attempt} failed:`, err.message)

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * attempt)
          )
        }
      }
    }

    // If all retries failed
    if (!transcription) {
      throw lastError || new Error('Transcription failed after retries')
    }

    // Clean up file after successful transcription
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    const processingTime = Date.now() - startTime
    const transcribedText = transcription.text?.trim() || ''

    console.log(`✅ [TRANSCRIBE] Success in ${processingTime}ms`)
    console.log(`   Text length: ${transcribedText.length} chars`)
    console.log(`   Preview: "${transcribedText.substring(0, 100)}..."`)

    // Return empty text as valid response if no speech detected
    if (!transcribedText) {
      return res.json({
        success: true,
        text: '',
        message: 'No speech detected in audio',
        processingTime: `${processingTime}ms`,
      })
    }

    res.json({
      success: true,
      text: transcribedText,
      processingTime: `${processingTime}ms`,
      audioSize: `${(req.file.size / 1024).toFixed(2)} KB`,
    })
  } catch (err) {
    console.error('❌ [TRANSCRIBE] Error:', err.message)

    // Always clean up file on error
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
        console.log('   Cleaned up file after error')
      } catch (cleanupErr) {
        console.error('   Cleanup failed:', cleanupErr.message)
      }
    }

    // Detailed error responses
    let errorMessage = 'Failed to transcribe audio'
    let statusCode = 500

    if (err.message.includes('timeout')) {
      errorMessage =
        'Transcription took too long. Please try a shorter recording.'
      statusCode = 408
    } else if (
      err.message.includes('format') ||
      err.message.includes('mimetype')
    ) {
      errorMessage =
        'Audio format not supported. Please check your microphone settings.'
      statusCode = 400
    } else if (err.message.includes('too large')) {
      errorMessage = 'Audio file too large. Please record shorter messages.'
      statusCode = 413
    } else if (err.message.includes('rate limit')) {
      errorMessage = 'Too many requests. Please wait and try again.'
      statusCode = 429
    } else if (
      err.message.includes('empty') ||
      err.message.includes('too small')
    ) {
      errorMessage = 'No audio detected. Please speak clearly into microphone.'
      statusCode = 400
    } else if (err.message.includes('not found')) {
      errorMessage = 'Upload failed. Please try again.'
      statusCode = 400
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      technicalError:
        process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
})

// Cleanup job for orphaned files (runs every 15 minutes)
setInterval(
  () => {
    const uploadsDir = path.join(__dirname, 'uploads')
    if (!fs.existsSync(uploadsDir)) return

    try {
      const files = fs.readdirSync(uploadsDir)
      const now = Date.now()
      const maxAge = 30 * 60 * 1000 // 30 minutes

      let cleaned = 0
      files.forEach((file) => {
        try {
          const filePath = path.join(uploadsDir, file)
          const stats = fs.statSync(filePath)
          if (now - stats.mtimeMs > maxAge) {
            fs.unlinkSync(filePath)
            cleaned++
          }
        } catch (err) {
          // Skip files that can't be processed
        }
      })

      if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} old audio files`)
      }
    } catch (err) {
      console.error('Cleanup job error:', err.message)
    }
  },
  15 * 60 * 1000
)
// Twilio setup
// --------------------
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

// --------------------
// Supabase setup
// --------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

// --------------------
// Groq setup
// --------------------
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// --------------------
// Temporary OTP store
// --------------------
const otpStore = {}

// --------------------
// Encryption setup
// --------------------
const algorithm = 'aes-256-cbc'
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(process.env.SECRET_KEY || 'supersecretkey')
  .digest() // 32 bytes
const IV = Buffer.alloc(16, 0) // fixed IV, can randomize

function encrypt(text) {
  if (!text) return null
  const cipher = crypto.createCipheriv(algorithm, ENCRYPTION_KEY, IV)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return encrypted
}

function decrypt(encryptedText) {
  if (!encryptedText) return null
  const decipher = crypto.createDecipheriv(algorithm, ENCRYPTION_KEY, IV)
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// --------------------
// Authentication middleware
// --------------------
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) return res.sendStatus(401)

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403)
    req.user = user
    next()
  })
}
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Admin access required' })

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid admin token' })
    if (user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin privileges required' })
    }
    req.user = user
    next()
  })
}

// --------------------
// Routes
// --------------------

// existing OTP, verify, login routes ...

// 6️⃣ Chat route with Groq
// In-memory storage for chat sessions
const chatSessions = new Map()

// Generate unique session ID
function generateSessionId() {
  return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

// Get or create chat session
function getChatSession(sessionId) {
  if (!chatSessions.has(sessionId)) {
    chatSessions.set(sessionId, {
      messages: [
        {
          role: 'system',
          content: `You are an Emergency Response AI Assistant. You help with:
- Emergency information and safety tips
- First aid guidance
- Connecting users with appropriate services
- Mental health support
- General emergency preparedness

Always prioritize user safety. For life-threatening emergencies, remind users to call 911 immediately.
Be empathetic, clear, and concise in your responses.`,
        },
      ],
      createdAt: new Date(),
      lastActivity: new Date(),
    })
  }
  return chatSessions.get(sessionId)
}

// Clean old sessions (run periodically)
function cleanOldSessions() {
  const now = new Date()
  const HOUR_IN_MS = 60 * 60 * 1000

  for (const [sessionId, session] of chatSessions.entries()) {
    if (now - session.lastActivity > HOUR_IN_MS) {
      chatSessions.delete(sessionId)
    }
  }
}

// Clean sessions every 30 minutes
setInterval(cleanOldSessions, 30 * 60 * 1000)

// Enhanced chat endpoint with nearby services integration
app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    // Get or create session
    let currentSessionId = sessionId
    if (!currentSessionId) {
      currentSessionId = generateSessionId()
    }

    const session = getChatSession(currentSessionId)

    // Add user message to session
    session.messages.push({ role: 'user', content: message })
    session.lastActivity = new Date()

    // Keep only last 20 messages (10 back-and-forth) to manage token limits
    if (session.messages.length > 21) {
      session.messages = [
        session.messages[0], // Keep system message
        ...session.messages.slice(-20), // Keep last 20 user/assistant messages
      ]
    }

    // 🆕 Enhanced keyword detection for nearby services
    const nearbyServiceKeywords = [
      'nearby',
      'near me',
      'closest',
      'nearest',
      'find hospital',
      'find police',
      'find fire station',
      'emergency services',
      'where is',
      'locate',
      'around me',
      'services near',
      'emergency contacts',
      'help center',
      'rescue services',
      'ambulance service',
      'medical center',
      'police station',
      'fire department',
    ]

    const locationKeywords = [
      'location',
      'coordinates',
      'where am i',
      'my location',
      'track me',
      'store my location',
      'update location',
      'save location',
      'gps',
      'latitude',
      'longitude',
      'position',
      'address',
    ]

    const isNearbyServiceRequest = nearbyServiceKeywords.some((keyword) =>
      message.toLowerCase().includes(keyword.toLowerCase())
    )

    const isLocationRequest = locationKeywords.some((keyword) =>
      message.toLowerCase().includes(keyword.toLowerCase())
    )

    let nearbyServicesData = null
    let userLocation = null

    // 🆕 Handle nearby services requests
    if (isNearbyServiceRequest && token) {
      try {
        // Get user's location from database
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const userId = decoded.user_id

        const { data: user, error } = await supabase
          .from('users')
          .select('latitude, longitude, first_name')
          .eq('id', userId)
          .single()

        if (user && user.latitude && user.longitude) {
          userLocation = {
            latitude: user.latitude,
            longitude: user.longitude,
          }

          // Determine emergency type from message context
          let emergencyType = 'General Emergency'
          const messageText = message.toLowerCase()

          if (
            messageText.includes('police') ||
            messageText.includes('crime') ||
            messageText.includes('theft')
          ) {
            emergencyType = 'Police Emergency'
          } else if (
            messageText.includes('medical') ||
            messageText.includes('hospital') ||
            messageText.includes('ambulance')
          ) {
            emergencyType = 'Medical Emergency'
          } else if (
            messageText.includes('fire') ||
            messageText.includes('burn')
          ) {
            emergencyType = 'Fire Emergency'
          } else if (
            messageText.includes('accident') ||
            messageText.includes('crash')
          ) {
            emergencyType = 'Accident Emergency'
          }

          console.log(
            `🔍 Fetching nearby services for: ${emergencyType} at ${user.latitude}, ${user.longitude}`
          )

          // Call nearby services endpoint internally
          const nearbyServicesResponse = await fetch(
            'http://localhost:8000/admin/nearby-services',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                latitude: user.latitude,
                longitude: user.longitude,
                emergencyType: emergencyType,
                location: `${user.latitude}, ${user.longitude}`,
              }),
            }
          )

          if (nearbyServicesResponse.ok) {
            nearbyServicesData = await nearbyServicesResponse.json()
            console.log(
              `✅ Found ${
                nearbyServicesData.services?.length || 0
              } nearby services`
            )
          } else {
            console.error(
              '❌ Failed to fetch nearby services:',
              nearbyServicesResponse.statusText
            )
          }
        }
      } catch (error) {
        console.error('Error fetching nearby services:', error)
      }
    }

    // 🆕 Enhanced system message based on request type
    let systemMessage = session.messages[0].content

    if (isNearbyServiceRequest) {
      systemMessage += `\n\nThe user is asking about nearby emergency services. You have access to real-time nearby service data${
        nearbyServicesData
          ? ' which has been provided'
          : ', but user location may not be available'
      }. Help them find appropriate emergency services, provide contact information, and guide them on next steps. Always prioritize their safety and remind them to call emergency numbers (100, 101, 108) for immediate life-threatening situations.`
    } else if (isLocationRequest) {
      systemMessage += `\n\nThe user is asking about location services. You can:
1. Help them enable location tracking
2. Guide them on sharing location with emergency contacts  
3. Explain how to save important locations
4. Assist with location-based emergency features
If they want to update their location, ask them to either:
- Enable browser location to get current coordinates automatically
- Provide specific coordinates (latitude, longitude)
- Give you their current address for geocoding`
    }

    // Update system message temporarily for this request
    const messagesForAPI = [
      { role: 'system', content: systemMessage },
      ...session.messages.slice(1),
    ]

    // 🆕 Add nearby services data to the conversation context if available
    if (
      nearbyServicesData &&
      nearbyServicesData.services &&
      nearbyServicesData.services.length > 0
    ) {
      const servicesContext = formatNearbyServicesForAI(nearbyServicesData)
      messagesForAPI.push({
        role: 'system',
        content: `NEARBY EMERGENCY SERVICES DATA:\n${servicesContext}\n\nUse this information to help the user with specific service recommendations, contact details, and distances.`,
      })
    }

    // Send conversation to Groq
    const completion = await groq.chat.completions.create({
      messages: messagesForAPI,
      model: 'llama-3.1-8b-instant',
      max_tokens: 800, // Increased for service listings
      temperature: 0.7,
    })

    let reply =
      completion.choices[0]?.message?.content ||
      'Sorry, I could not generate a response.'

    // 🆕 Enhanced reply formatting for nearby services
    if (
      nearbyServicesData &&
      nearbyServicesData.services &&
      nearbyServicesData.services.length > 0
    ) {
      reply +=
        '\n\n📍 **NEARBY EMERGENCY SERVICES:**\n' +
        formatNearbyServicesDisplay(nearbyServicesData)
    } else if (isNearbyServiceRequest && !userLocation) {
      reply +=
        '\n\n⚠️ **Location Required**: To show nearby services, please:\n1. Enable location sharing in your browser\n2. Use the "Store my current location" button\n3. Or provide your coordinates/address in the chat'
    }

    // Handle location coordinate detection and storage (existing functionality)
    if (isLocationRequest && token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const userId = decoded.id

        const coordinatePattern = /(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/
        const coordinateMatch = message.match(coordinatePattern)

        if (coordinateMatch) {
          const [, latitude, longitude] = coordinateMatch

          await supabase
            .from('users')
            .update({
              latitude,
              longitude,
              location_updated_at: new Date().toISOString(),
            })
            .eq('id', userId)

          reply +=
            '\n\n✅ Your location coordinates have been saved to your profile for emergency services.'
        } else {
          reply += `\n\n📍 To store your location:
1. Go to the Location page to enable GPS tracking
2. Share coordinates in format: "latitude, longitude" (e.g., "40.7128, -74.0060")
3. Or provide your address for automatic geocoding`
        }
      } catch (authError) {
        reply += '\n\n⚠️ Please log in to save location data to your profile.'
      }
    }

    // Add AI response to session
    session.messages.push({ role: 'assistant', content: reply })

    // 🆕 Enhanced response data
    const responseData = {
      reply,
      sessionId: currentSessionId,
      messageCount: session.messages.length - 1,
      locationDetected: isLocationRequest,
      nearbyServicesDetected: isNearbyServiceRequest,
      userLocation: userLocation,
    }

    // Add nearby services data to response if available
    if (nearbyServicesData) {
      responseData.nearbyServices = nearbyServicesData.services
      responseData.servicesByType = nearbyServicesData.servicesByType
    }

    res.json(responseData)
  } catch (err) {
    console.error('Chat error:', err)
    res.status(500).json({ error: 'Failed to get response' })
  }
})

// 🆕 Helper function to format nearby services data for AI context
function formatNearbyServicesForAI(servicesData) {
  if (!servicesData.services || servicesData.services.length === 0) {
    return 'No nearby services found.'
  }

  let formattedText = `Emergency Type: ${servicesData.emergencyType}\n`
  formattedText += `Search Location: ${servicesData.searchLocation.latitude}, ${servicesData.searchLocation.longitude}\n\n`

  // Group by service type
  const servicesByType = {}
  servicesData.services.forEach((service) => {
    if (!servicesByType[service.serviceType]) {
      servicesByType[service.serviceType] = []
    }
    servicesByType[service.serviceType].push(service)
  })

  Object.entries(servicesByType).forEach(([type, services]) => {
    formattedText += `${type.toUpperCase().replace('_', ' ')} SERVICES:\n`
    services.slice(0, 3).forEach((service, index) => {
      // Limit to top 3 per type
      formattedText += `${index + 1}. ${service.name}\n`
      formattedText += `   Phone: ${service.phone}\n`
      formattedText += `   Address: ${service.address}\n`
      formattedText += `   Distance: ${service.distance}km\n`
      if (service.isOpen !== null) {
        formattedText += `   Status: ${
          service.isOpen ? 'Open' : 'Closed/Unknown'
        }\n`
      }
      formattedText += '\n'
    })
  })

  return formattedText
}

// 🆕 Helper function to format nearby services for user display
function formatNearbyServicesDisplay(servicesData) {
  if (!servicesData.services || servicesData.services.length === 0) {
    return '❌ No nearby services found. Please check your location settings.'
  }

  let displayText = ''

  // Group by service type for better organization
  const servicesByType = {}
  servicesData.services.forEach((service) => {
    if (!servicesByType[service.serviceType]) {
      servicesByType[service.serviceType] = []
    }
    servicesByType[service.serviceType].push(service)
  })

  // Service type icons
  const typeIcons = {
    hospital: '🏥',
    police: '👮',
    fire_station: '🚒',
  }

  Object.entries(servicesByType).forEach(([type, services]) => {
    const icon = typeIcons[type] || '📍'
    const typeName = type.replace('_', ' ').toUpperCase()

    displayText += `\n${icon} **${typeName}:**\n`

    services.slice(0, 3).forEach((service, index) => {
      displayText += `${index + 1}. **${service.name}**\n`
      displayText += `   📞 ${service.phone}\n`
      displayText += `   📍 ${service.address}\n`
      displayText += `   📏 ${service.distance}km away\n`
      if (service.emergency) {
        displayText += `   🚨 Emergency Service\n`
      }
      displayText += '\n'
    })
  })

  displayText += '\n⚠️ **For immediate life-threatening emergencies, call:**\n'
  displayText += '• Police: 100\n'
  displayText += '• Fire: 101\n'
  displayText += '• Medical: 108\n'

  return displayText
}

// New endpoint to store location from chat
app.post('/chat/store-location', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    const { latitude, longitude, address } = req.body

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const userId = decoded.id

    let lat = latitude
    let lng = longitude

    // If address provided but no coordinates, geocode it
    if (address && (!lat || !lng)) {
      try {
        const geocodeResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            address
          )}&countrycodes=IN&limit=1`
        )
        const geocodeData = await geocodeResponse.json()

        if (geocodeData && geocodeData.length > 0) {
          lat = parseFloat(geocodeData[0].lat)
          lng = parseFloat(geocodeData[0].lon)
        } else {
          return res
            .status(400)
            .json({ error: 'Could not find coordinates for this address' })
        }
      } catch (geocodeError) {
        return res.status(400).json({ error: 'Geocoding failed' })
      }
    }

    if (!lat || !lng) {
      return res
        .status(400)
        .json({ error: 'Latitude and longitude are required' })
    }

    // Update user location
    await supabase
      .from('users')
      .update({
        latitude,
        longitude,
        location_updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    res.json({
      success: true,
      message: 'Location stored successfully',
      coordinates: { latitude: lat, longitude: lng },
    })
  } catch (error) {
    console.error('Store location error:', error)
    res.status(500).json({ error: 'Failed to store location' })
  }
})

// Enhanced geocoding function for chat integration
async function geocodeAddressForChat(address) {
  const pincodeMatch = address.match(/(\d{6})/)

  if (pincodeMatch) {
    const pincode = pincodeMatch[1]
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${pincode}&countrycodes=IN&limit=1`
      )
      const data = await response.json()

      if (data && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        }
      }
    } catch (error) {
      console.log('Pincode geocoding failed, trying full address')
    }
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        address
      )}&countrycodes=IN&limit=1`
    )
    const data = await response.json()

    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      }
    }
  } catch (error) {
    console.error('Full address geocoding failed:', error)
  }

  throw new Error('Address not found')
}

// Optional: Get session info endpoint
app.get('/chat/session/:sessionId', (req, res) => {
  const { sessionId } = req.params
  const session = chatSessions.get(sessionId)

  if (!session) {
    return res.status(404).json({ error: 'Session not found' })
  }

  res.json({
    sessionId,
    messageCount: session.messages.length - 1,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
  })
})

// Optional: Clear session endpoint
app.delete('/chat/session/:sessionId', (req, res) => {
  const { sessionId } = req.params
  const deleted = chatSessions.delete(sessionId)

  res.json({
    success: deleted,
    message: deleted ? 'Session cleared' : 'Session not found',
  })
})

// --------------------
// Routes
// --------------------

// 1️⃣ Send OTP
app.post('/send_otp', async (req, res) => {
  try {
    const { phone, password, medical_conditions, ...userData } = req.body

    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    otpStore[phone] = {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      userData: { ...userData, phone, password, medical_conditions },
    }
    console.log(otpStore)

    await client.messages.create({
      body: `Your OTP is ${otp}`,
      from: process.env.TWILIO_PHONE,
      to: phone,
    })

    res.json({ message: 'OTP sent successfully' })
  } catch (err) {
    console.error('Twilio error:', err)
    res.status(500).json({ detail: 'Failed to send OTP' })
  }
})

// 2️⃣ Verify OTP & Register
app.post('/verify_otp', async (req, res) => {
  try {
    const { phone, otp } = req.body
    console.log(req.phone, req.otp)
    const record = otpStore[phone]

    if (!record)
      return res.status(400).json({ error: 'OTP not requested or expired' })
    if (record.otp !== otp || Date.now() > record.expiresAt)
      return res.status(400).json({ error: 'Invalid or expired OTP' })

    const hashedPassword = await bcrypt.hash(record.userData.password, 10)
    const encryptedMedical = encrypt(record.userData.medical_conditions)

    const { error, data } = await supabase
      .from('users')
      .insert([
        {
          first_name: record.userData.first_name,
          last_name: record.userData.last_name,
          email: record.userData.email,
          phone: record.userData.phone,
          password_hash: hashedPassword,
          primary_emergency_contact: record.userData.primary_emergency_contact,
          primary_emergency_phone: record.userData.primary_emergency_phone,
          primary_emergency_relation:
            record.userData.primary_emergency_relation,
          secondary_emergency_contact:
            record.userData.secondary_emergency_contact,
          secondary_emergency_phone: record.userData.secondary_emergency_phone,
          secondary_emergency_relation:
            record.userData.secondary_emergency_relation,
          street_address: record.userData.street_address,
          city: record.userData.city,
          state: record.userData.state,
          zip_code: record.userData.zip_code,
          medical_conditions: encryptedMedical,
          agree_to_terms: record.userData.agree_to_terms,
          agree_to_emergency_sharing:
            record.userData.agree_to_emergency_sharing,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return res.status(500).json({ error: 'Failed to save user' })
    }

    delete otpStore[phone]

    const token = jwt.sign(
      { user_id: data.id, email: data.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      message: 'User registered successfully',
      user: { id: data.id, email: data.email, first_name: data.first_name },
      token,
    })
  } catch (err) {
    console.error('Verification error:', err)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

// 3️⃣ Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' })

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (error || !user)
      return res.status(401).json({ error: 'Invalid email or password' })

    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid)
      return res.status(401).json({ error: 'Invalid email or password' })

    const token = jwt.sign(
      { user_id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    )

    res.json({
      message: 'Login successful',
      user: { id: user.id, email: user.email, first_name: user.first_name },
      token,
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

// Add this route to your existing backend/index.js file after the regular user login route

// Admin Login Route with Detailed Logs
// Admin Login Route without is_active check
app.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body
    console.log('🟡 Incoming admin login request:', { email })

    // Validate input
    if (!email || !password) {
      console.warn('⚠️ Missing email or password')
      return res.status(400).json({ error: 'Email and password are required' })
    }

    console.log('🔍 Fetching admin user from database...')
    const { data: admin, error } = await supabase
      .from('admin')
      .select(
        'id, first_name, last_name, email_address, password, last_login, calls_attended'
      )
      .eq('email_address', email.toLowerCase().trim())
      .single()

    console.log('📄 Supabase response:', { admin, error })

    if (error || !admin) {
      console.error('❌ Admin not found or Supabase error:', error)
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    console.log('🔑 Verifying password...')
    const isValidPassword = await bcrypt.compare(password, admin.password)
    console.log('Password check result:', isValidPassword)

    if (!isValidPassword) {
      console.warn('🚫 Invalid password for admin:', admin.email_address)
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    console.log('⏱ Updating last login timestamp...')
    const { error: updateError } = await supabase
      .from('admin')
      .update({ last_login: new Date().toISOString() })
      .eq('id', admin.id)

    if (updateError) {
      console.error('⚠️ Failed to update last_login:', updateError)
    } else {
      console.log('✅ Last login updated successfully')
    }

    console.log('🔐 Generating JWT token...')
    const token = jwt.sign(
      {
        user_id: admin.id,
        email: admin.email_address,
        userType: 'admin',
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    )

    console.log(`✅ Admin login successful: ${admin.email_address}`)

    res.json({
      message: 'Admin login successful',
      admin: {
        id: admin.id,
        email: admin.email_address,
        first_name: admin.first_name,
        last_name: admin.last_name,
        last_login: admin.last_login,
      },
      token,
    })
  } catch (err) {
    console.error('🔥 Admin login error:', err)
    res.status(500).json({ error: 'Something went wrong during admin login' })
  }
})

// 5️⃣ Resend OTP
app.post('/resend_otp', async (req, res) => {
  try {
    const { phone } = req.body
    const record = otpStore[phone]

    const now = Date.now()
    if (record.lastSentAt && now - record.lastSentAt < 60 * 1000) {
      const waitTime = Math.ceil((60 * 1000 - (now - record.lastSentAt)) / 1000)
      return res
        .status(429)
        .json({ error: `Please wait ${waitTime}s before requesting a new OTP` })
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString()
    otpStore[phone].otp = newOtp
    otpStore[phone].expiresAt = now + 5 * 60 * 1000
    otpStore[phone].lastSentAt = now

    await client.messages.create({
      body: `Your new OTP is ${newOtp}`,
      from: process.env.TWILIO_PHONE,
      to: phone,
    })

    res.json({ message: 'New OTP sent successfully' })
  } catch (err) {
    console.error('Resend OTP error:', err)
    res.status(500).json({ error: 'Failed to resend OTP' })
  }
})

app.put('/admin/change-password', authenticateAdmin, async (req, res) => {
  try {
    const { current_password, new_password } = req.body

    if (!current_password || !new_password) {
      return res.status(400).json({
        error: 'Current password and new password are required',
      })
    }

    // Get current admin data
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('password_hash')
      .eq('id', req.user.user_id)
      .single()

    if (error || !admin) {
      return res.status(404).json({ error: 'Admin user not found' })
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      current_password,
      admin.password_hash
    )
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(new_password, 12)

    // Update password
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({ password_hash: hashedNewPassword })
      .eq('id', req.user.user_id)

    if (updateError) {
      console.error('Password update error:', updateError)
      return res.status(500).json({ error: 'Failed to update password' })
    }

    res.json({ message: 'Password updated successfully' })
  } catch (err) {
    console.error('Change password error:', err)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

app.put('/admin/users/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { is_active } = req.body

    // Check if requesting user has super admin privileges
    const { data: requestingAdmin } = await supabase
      .from('admin_users')
      .select('role')
      .eq('id', req.user.user_id)
      .single()

    if (requestingAdmin?.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Only super administrators can modify admin user status',
      })
    }

    // Don't allow deactivating yourself
    if (id === req.user.user_id && !is_active) {
      return res.status(400).json({
        error: 'You cannot deactivate your own account',
      })
    }

    const { error } = await supabase
      .from('admin_users')
      .update({ is_active })
      .eq('id', id)

    if (error) {
      console.error('Update admin status error:', error)
      return res.status(500).json({ error: 'Failed to update admin status' })
    }

    res.json({
      message: `Admin user ${
        is_active ? 'activated' : 'deactivated'
      } successfully`,
    })
  } catch (err) {
    console.error('Update admin status error:', err)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

app.get('/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const { data: admins, error } = await supabase
      .from('admin_users')
      .select(
        'id, first_name, last_name, email, role, is_active, created_at, last_login'
      )
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Fetch admins error:', error)
      return res.status(500).json({ error: 'Failed to fetch admin users' })
    }

    res.json({ admins })
  } catch (err) {
    console.error('Get admin users error:', err)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

app.post('/admin/create', authenticateAdmin, async (req, res) => {
  try {
    const { first_name, last_name, email, password, role = 'admin' } = req.body

    // Check if requesting user has super admin privileges
    const { data: requestingAdmin } = await supabase
      .from('admin_users')
      .select('role')
      .eq('id', req.user.user_id)
      .single()

    if (requestingAdmin?.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Only super administrators can create new admin users',
      })
    }

    // Validate input
    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({
        error: 'All fields are required',
      })
    }

    // Check if admin already exists
    const { data: existingAdmin } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingAdmin) {
      return res.status(400).json({
        error: 'Admin user with this email already exists',
      })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create admin user
    const { data: newAdmin, error } = await supabase
      .from('admin_users')
      .insert([
        {
          first_name,
          last_name,
          email,
          password_hash: hashedPassword,
          role,
          is_active: true,
          created_by: req.user.user_id,
        },
      ])
      .select('id, first_name, last_name, email, role, is_active, created_at')
      .single()

    if (error) {
      console.error('Create admin error:', error)
      return res.status(500).json({ error: 'Failed to create admin user' })
    }

    res.status(201).json({
      message: 'Admin user created successfully',
      admin: newAdmin,
    })
  } catch (err) {
    console.error('Create admin error:', err)
    res.status(500).json({ error: 'Something went wrong' })
  }
})
app.put('/user/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body
    const { data: user } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', req.user.user_id)
      .single()

    if (!user) return res.status(404).json({ error: 'User not found' })
    const isValid = await bcrypt.compare(current_password, user.password_hash)
    if (!isValid)
      return res.status(401).json({ error: 'Incorrect current password' })

    const hashedNewPassword = await bcrypt.hash(new_password, 12)
    await supabase
      .from('users')
      .update({ password_hash: hashedNewPassword })
      .eq('id', req.user.user_id)

    res.json({ message: 'Password updated successfully' })
  } catch (err) {
    console.error('Change password error:', err)
    res.status(500).json({ error: 'Something went wrong' })
  }
})
// --------------------
// Profile routes
// --------------------
app.get('/profile/me', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.user

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user_id)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Decrypt medical conditions before sending to frontend
    const decryptedMedical = decrypt(data.medical_conditions)

    res.json({
      ...data,
      medical_conditions: decryptedMedical,
    })
  } catch (err) {
    console.error('Profile fetch error:', err)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

app.put('/profile/me', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.user
    const updatedData = { ...req.body }

    // Encrypt medical_conditions before saving
    if (updatedData.medical_conditions) {
      updatedData.medical_conditions = encrypt(updatedData.medical_conditions)
    }

    const { error } = await supabase
      .from('users')
      .update(updatedData)
      .eq('id', user_id)

    if (error) {
      return res.status(400).json({ error: 'Failed to update profile' })
    }

    res.json({ message: 'Profile updated successfully' })
  } catch (err) {
    console.error('Profile update error:', err)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// Increment emergency calls for current user

// Update user location
app.post('/update_location', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.user // comes from JWT payload
    const { latitude, longitude } = req.body

    if (!latitude || !longitude) {
      return res
        .status(400)
        .json({ error: 'Latitude and longitude are required' })
    }

    const { data, error } = await supabase
      .from('users')
      .update({ latitude, longitude })
      .eq('id', user_id)
      .select('id, latitude, longitude')
      .single()

    if (error) throw error

    res.json({ success: true, user: data })
  } catch (err) {
    console.error('Update location error:', err)
    res.status(500).json({ error: 'Failed to update location' })
  }
})

// Add these routes to your existing backend/index.js file

// --------------------
// Location Management Routes
// --------------------

// GET /locations - Fetch all saved locations for the authenticated user
app.get('/locations', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.user

    const { data: user, error } = await supabase
      .from('users')
      .select('other_addresses, street_address, city, state, zip_code')
      .eq('id', user_id)
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return res.status(500).json({ error: 'Failed to fetch locations' })
    }

    const locations = []

    // Add home address as first location if it exists
    if (user.street_address && user.city) {
      locations.push({
        id: 'home',
        name: 'Home',
        address: `${user.street_address}, ${user.city}${
          user.state ? ', ' + user.state : ''
        }${user.zip_code ? ' ' + user.zip_code : ''}`,
        latitude: null, // You might want to geocode this later
        longitude: null,
        is_primary: true,
      })
    }

    // Add other addresses
    if (user.other_addresses && user.other_addresses.length > 0) {
      user.other_addresses.forEach((address, index) => {
        if (address && address !== 'NULL' && address.trim() !== '') {
          try {
            const parsedAddress = JSON.parse(address)
            locations.push({
              id: `other_${index}`,
              name: parsedAddress.name || `Location ${index + 1}`,
              address: parsedAddress.address,
              latitude: parsedAddress.latitude || null,
              longitude: parsedAddress.longitude || null,
              is_primary: false,
            })
          } catch (e) {
            // If it's not JSON, treat as simple address string
            locations.push({
              id: `other_${index}`,
              name: `Location ${index + 1}`,
              address: address,
              latitude: null,
              longitude: null,
              is_primary: false,
            })
          }
        }
      })
    }

    res.json({ locations })
  } catch (err) {
    console.error('Server error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})
const emergencyTypes = [
  'Police Emergency',
  'Medical Emergency', 
  'Fire Emergency',
  'Accident Emergency'
]
// Enhanced emergency creation endpoint with description
app.post('/emergency/create', authenticateToken, async (req, res) => {
  try {
    const { type, location, priority = 'Critical', description, latitude, longitude } = req.body
    const userId = req.user?.id || req.user?.user_id

    console.log('Emergency creation request:', { userId, type, location, description, latitude, longitude })

    // Validate required fields
    const validationErrors = []
    
    if (!type || !type.trim()) {
      validationErrors.push({ field: 'type', message: 'Emergency type is required' })
    }
    
    if (!location || !location.trim()) {
      validationErrors.push({ field: 'location', message: 'Location is required' })
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: validationErrors
      })
    }

    // Validate user ID
    if (!userId) {
      console.error('No user ID found in JWT token')
      return res.status(401).json({
        error: 'User ID not found in token'
      })
    }

    // Get user details for emergency record
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('first_name, last_name, phone, email')
      .eq('id', userId)
      .single()

    if (userError) {
      console.error('Error fetching user:', userError)
      return res.status(500).json({ error: 'Failed to fetch user details' })
    }

    // Extract location details using Groq if coordinates are provided
    let city = null
    let state = null
    let pincode = null
     const coordMatch = location.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/)
    
  

    if (latitude && longitude) {
      try {
        console.log(`🗺️ Extracting location details from coordinates: ${latitude}, ${longitude}`)
        
        // Use Groq to extract city, state, and pincode from coordinates
        const locationPrompt = `Given the coordinates: latitude ${latitude}, longitude ${longitude}
        
Please identify the city, state, and pincode (postal code) for these coordinates in India. 
Respond ONLY in this exact JSON format with no additional text:
{
  "city": "city name",
  "state": "state name",
  "pincode": "6-digit pincode"
}

If you cannot determine any value, use null for that field.`

        const groqResponse = await groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'You are a geocoding assistant. Extract location information from coordinates and respond only with valid JSON.'
            },
            {
              role: 'user',
              content: locationPrompt
            }
          ],
          model: 'llama-3.1-8b-instant',
          temperature: 0.1,
          max_tokens: 150,
        })

        const responseText = groqResponse.choices[0]?.message?.content?.trim()
        console.log('Groq response:', responseText)

        // Parse the JSON response
        const locationData = JSON.parse(responseText)
        city = locationData.city || null
        state = locationData.state || null
        pincode = locationData.pincode || null

        console.log(`✅ Location extracted: ${city}, ${state}, ${pincode}`)

        // Update user's location information in users table
        if (city || state || pincode) {
          const userUpdateData = {}
          if (city) userUpdateData.city = city
          if (state) userUpdateData.state = state
          if (pincode) userUpdateData.zip_code = pincode

          const { error: userUpdateError } = await supabase
            .from('users')
            .update(userUpdateData)
            .eq('id', userId)

          if (userUpdateError) {
            console.error('Failed to update user location:', userUpdateError)
          } else {
            console.log(`✅ Updated user location: ${city}, ${state}, ${pincode}`)
          }
        }

      } catch (groqError) {
        console.error('Groq geocoding error:', groqError)
        // Fallback to OpenStreetMap Nominatim if Groq fails
        try {
          const nominatimResponse = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
          )
          const nominatimData = await nominatimResponse.json()
          
          if (nominatimData && nominatimData.address) {
            const address = nominatimData.address
            city = address.city || address.town || address.village || null
            state = address.state || null
            pincode = address.postcode || null
            
            console.log(`✅ Fallback location from Nominatim: ${city}, ${state}, ${pincode}`)

            // Update user's location information
            if (city || state || pincode) {
              const userUpdateData = {}
              if (city) userUpdateData.city = city
              if (state) userUpdateData.state = state
              if (pincode) userUpdateData.zip_code = pincode

              await supabase
                .from('users')
                .update(userUpdateData)
                .eq('id', userId)
            }
          }
        } catch (nominatimError) {
          console.error('Nominatim fallback error:', nominatimError)
        }
      }
    }

    // Insert emergency into database (original fields only)
    const { data: emergency, error } = await supabase
      .from('emergencies')
      .insert([
        {
          user_id: userId,
          type: type.trim(),
          location: location.trim(),
          description: description?.trim() || "none",
          priority: priority,
          status: 'Reported',
          reported_time: new Date().toISOString(),
          requester_name: `${user.first_name} ${user.last_name}`,
          requester_phone: user.phone
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return res.status(500).json({
        error: 'Failed to create emergency report',
        details: error.message,
      })
    }

    console.log(`✅ Emergency created: ID ${emergency.id}, Type: ${emergency.type}`)

    res.json({
      success: true,
      message: 'Emergency reported successfully',
      emergency: {
        id: emergency.id,
        type: emergency.type,
        location: emergency.location,
        description: emergency.description,
        priority: emergency.priority,
        status: emergency.status,
        reported_time: emergency.reported_time,
      },
      userLocationUpdated: city || state || pincode ? true : false
    })
  } catch (error) {
    console.error('Error creating emergency:', error)
    res.status(500).json({
      error: 'Failed to create emergency report',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// POST /locations - Add a new saved location
app.post('/locations', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.user
    const { name, address, latitude, longitude } = req.body

    // Validation
    if (!name || !address) {
      return res.status(400).json({
        error: 'Name and address are required',
      })
    }

    // Validate coordinates if provided
    if (latitude !== undefined && longitude !== undefined) {
      if (
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return res.status(400).json({
          error: 'Invalid coordinates',
        })
      }
    }

    // Get current other_addresses
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('other_addresses')
      .eq('id', user_id)
      .single()

    if (fetchError) {
      console.error('Fetch error:', fetchError)
      return res.status(500).json({ error: 'Failed to fetch user data' })
    }

    // Prepare new location object
    const newLocation = {
      name: name.trim(),
      address: address.trim(),
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      created_at: new Date().toISOString(),
    }

    // Get existing addresses or initialize empty array
    let otherAddresses = user.other_addresses || []

    // Filter out NULL values
    otherAddresses = otherAddresses.filter(
      (addr) => addr && addr !== 'NULL' && addr.trim() !== ''
    )

    // Add new location as JSON string
    otherAddresses.push(JSON.stringify(newLocation))

    // Update the database
    const { error: updateError } = await supabase
      .from('users')
      .update({ other_addresses: otherAddresses })
      .eq('id', user_id)

    if (updateError) {
      console.error('Update error:', updateError)
      return res.status(500).json({ error: 'Failed to add location' })
    }

    res.status(201).json({
      message: 'Location added successfully',
      location: {
        id: `other_${otherAddresses.length - 1}`,
        ...newLocation,
        is_primary: false,
      },
    })
  } catch (err) {
    console.error('Server error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /locations/:id - Delete a saved location
app.delete('/locations/:id', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.user
    const { id } = req.params

    // Can't delete home address
    if (id === 'home') {
      return res.status(400).json({ error: 'Cannot delete home address' })
    }

    // Extract index from id (format: "other_0", "other_1", etc.)
    if (!id.startsWith('other_')) {
      return res.status(400).json({ error: 'Invalid location ID' })
    }

    const index = parseInt(id.split('_')[1])
    if (isNaN(index)) {
      return res.status(400).json({ error: 'Invalid location ID' })
    }

    // Get current other_addresses
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('other_addresses')
      .eq('id', user_id)
      .single()

    if (fetchError) {
      console.error('Fetch error:', fetchError)
      return res.status(500).json({ error: 'Failed to fetch user data' })
    }

    let otherAddresses = user.other_addresses || []

    // Filter out NULL values
    otherAddresses = otherAddresses.filter(
      (addr) => addr && addr !== 'NULL' && addr.trim() !== ''
    )

    // Check if index is valid
    if (index < 0 || index >= otherAddresses.length) {
      return res.status(404).json({ error: 'Location not found' })
    }

    // Remove the location at the specified index
    otherAddresses.splice(index, 1)

    // Update the database
    const { error: updateError } = await supabase
      .from('users')
      .update({ other_addresses: otherAddresses })
      .eq('id', user_id)

    if (updateError) {
      console.error('Update error:', updateError)
      return res.status(500).json({ error: 'Failed to delete location' })
    }

    res.json({ message: 'Location deleted successfully' })
  } catch (err) {
    console.error('Server error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Replace the existing /admin/nearby-services route with this enhanced version
app.post('/admin/nearby-services', authenticateAdmin, async (req, res) => {
  try {
    let { latitude, longitude, emergencyType, location } = req.body

    console.log('Received request body:', req.body)

    // Parse coordinates from location string if needed
    if (!latitude && !longitude && location && typeof location === 'string') {
      console.log('Parsing coordinates from location string:', location)

      const locationParts = location.split(',')
      if (locationParts.length === 2) {
        const lat = parseFloat(locationParts[0].trim())
        const lng = parseFloat(locationParts[1].trim())

        if (
          !isNaN(lat) &&
          !isNaN(lng) &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180
        ) {
          latitude = lat
          longitude = lng
          console.log('Successfully parsed coordinates:', {
            latitude,
            longitude,
          })
        }
      }
    }

    // Validation
    if (!latitude || !longitude || !emergencyType) {
      return res.status(400).json({
        error:
          'Missing required parameters: latitude, longitude, emergencyType',
      })
    }

    // Enhanced service type mapping for multi-dispatch
    const getRequiredServiceTypes = (emergencyType) => {
      const type = emergencyType.toLowerCase()

      if (type.includes('fire')) {
        return ['fire', 'hospital', 'police'] // Fire emergencies need all services
      }

      if (type.includes('accident')) {
        return ['police', 'medical'] // Accidents need police and medical
      }

      if (
        type.includes('police') ||
        type.includes('crime') ||
        type.includes('theft') ||
        type.includes('violence') ||
        type.includes('assault') ||
        type.includes('robbery')
      ) {
        return ['police']
      }

      if (
        type.includes('medical') ||
        type.includes('health') ||
        type.includes('injury') ||
        type.includes('heart')
      ) {
        return ['medical']
      }

      // For general emergencies, return all service types
      return ['medical', 'police', 'fire']
    }

    const requiredServiceTypes = getRequiredServiceTypes(emergencyType)
    console.log(
      `Emergency type: "${emergencyType}" requires services: ${requiredServiceTypes.join(
        ', '
      )}`
    )

    // Search radius in meters (10km)
    const searchRadius = 10000

    // Collect all services for all required types
    const allServices = []

    for (const serviceType of requiredServiceTypes) {
      console.log(`Searching for ${serviceType} services...`)

      // Build Overpass API query for this service type
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["amenity"="${serviceType}"](around:${searchRadius},${latitude},${longitude});
          way["amenity"="${serviceType}"](around:${searchRadius},${latitude},${longitude});
          relation["amenity"="${serviceType}"](around:${searchRadius},${latitude},${longitude});
        );
        out center meta;
      `

      try {
        const overpassUrl = 'https://overpass-api.de/api/interpreter'
        const response = await fetch(overpassUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `data=${encodeURIComponent(overpassQuery)}`,
        })

        if (response.ok) {
          const data = await response.json()
          console.log(
            `Found ${data.elements?.length || 0} ${serviceType} results`
          )

          // Process and format results for this service type
          const services = (data.elements || [])
            .filter((element) => element.tags && element.tags.name)
            .map((element) => {
              let lat, lon
              if (element.lat && element.lon) {
                lat = element.lat
                lon = element.lon
              } else if (element.center) {
                lat = element.center.lat
                lon = element.center.lon
              } else {
                return null
              }

              const distance = calculateDistance(latitude, longitude, lat, lon)

              return {
                id: `${serviceType}_${element.id}`,
                name: element.tags.name,
                address: buildAddress(element.tags),
                phone:
                  element.tags.phone ||
                  element.tags['contact:phone'] ||
                  'Contact information not available',
                distance: distance,
                location: { lat, lng: lon },
                rating: 'N/A',
                isOpen: parseOpeningHours(element.tags.opening_hours),
                serviceType: serviceType, // Add service type for categorization
                types: [serviceType],
                website:
                  element.tags.website ||
                  element.tags['contact:website'] ||
                  null,
                emergency: element.tags.emergency === 'yes',
              }
            })
            .filter((service) => service !== null)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5) // Top 5 for each service type

          allServices.push(...services)
        }
      } catch (error) {
        console.error(`Error fetching ${serviceType} services:`, error)
      }
    }

    // Add fallback services if no services found
    if (allServices.length === 0) {
      const fallbackServices = getFallbackEmergencyServices(
        latitude,
        longitude,
        requiredServiceTypes
      )
      allServices.push(...fallbackServices)
    }

    // Group services by type for better frontend handling
    const servicesByType = {}
    allServices.forEach((service) => {
      if (!servicesByType[service.serviceType]) {
        servicesByType[service.serviceType] = []
      }
      servicesByType[service.serviceType].push(service)
    })

    console.log(`Total processed services: ${allServices.length}`)
    console.log(
      `Service types found: ${Object.keys(servicesByType).join(', ')}`
    )

    res.json({
      success: true,
      services: allServices,
      servicesByType: servicesByType,
      requiredServiceTypes: requiredServiceTypes,
      emergencyType,
      searchLocation: { latitude, longitude },
      count: allServices.length,
      source: 'OpenStreetMap',
    })
  } catch (error) {
    console.error('Error fetching nearby services:', error)

    // Enhanced fallback for multi-service
    const requiredServiceTypes = ['hospital', 'police', 'fire_station']
    const fallbackServices = getFallbackEmergencyServices(
      latitude,
      longitude,
      requiredServiceTypes
    )

    res.json({
      success: true,
      services: fallbackServices,
      servicesByType: {
        hospital: fallbackServices.filter((s) => s.serviceType === 'hospital'),
        police: fallbackServices.filter((s) => s.serviceType === 'police'),
        fire_station: fallbackServices.filter(
          (s) => s.serviceType === 'fire_station'
        ),
      },
      requiredServiceTypes: requiredServiceTypes,
      emergencyType,
      searchLocation: { latitude, longitude },
      count: fallbackServices.length,
      source: 'Fallback',
      note: 'Using fallback emergency contacts due to service unavailability',
    })
  }
})

// Enhanced fallback function for multiple service types
function getFallbackEmergencyServices(
  lat,
  lon,
  requiredServiceTypes = ['hospital', 'police', 'fire_station']
) {
  const fallbackServices = []

  if (requiredServiceTypes.includes('police')) {
    fallbackServices.push({
      id: 'emergency_police',
      name: 'Police Emergency',
      address: 'India Emergency Services',
      phone: '100',
      distance: 0,
      location: { lat, lng: lon },
      rating: 'N/A',
      isOpen: true,
      serviceType: 'police',
      types: ['emergency', 'police'],
      emergency: true,
    })
  }

  if (requiredServiceTypes.includes('fire_station')) {
    fallbackServices.push({
      id: 'emergency_fire',
      name: 'Fire Emergency',
      address: 'India Emergency Services',
      phone: '101',
      distance: 0,
      location: { lat, lng: lon },
      rating: 'N/A',
      isOpen: true,
      serviceType: 'fire_station',
      types: ['emergency', 'fire_station'],
      emergency: true,
    })
  }

  if (requiredServiceTypes.includes('hospital')) {
    fallbackServices.push({
      id: 'emergency_medical',
      name: 'Medical Emergency',
      address: 'India Emergency Services',
      phone: '108',
      distance: 0,
      location: { lat, lng: lon },
      rating: 'N/A',
      isOpen: true,
      serviceType: 'hospital',
      types: ['emergency', 'hospital'],
      emergency: true,
    })
  }

  return fallbackServices
}

// New route for multi-service dispatch
app.post('/admin/dispatch-services', authenticateAdmin, async (req, res) => {
  try {
    const { emergencyId, services } = req.body // services is array of service objects

    console.log('Multi-dispatch request:', {
      emergencyId,
      serviceCount: services?.length,
    })

    if (
      !emergencyId ||
      !services ||
      !Array.isArray(services) ||
      services.length === 0
    ) {
      return res.status(400).json({
        error: 'Emergency ID and services array are required',
      })
    }

    // Get current emergency
    const { data: currentEmergency, error: fetchError } = await supabase
      .from('emergencies')
      .select('*')
      .eq('id', emergencyId)
      .single()

    if (fetchError || !currentEmergency) {
      return res.status(404).json({ error: 'Emergency not found' })
    }

    // Get admin info
    const adminId = req.user.user_id
    const { data: adminData } = await supabase
      .from('admin')
      .select('first_name, last_name')
      .eq('id', adminId)
      .single()

    const adminName = adminData
      ? `${adminData.first_name} ${adminData.last_name}`
      : 'Unknown Admin'

    // Prepare dispatch records
    const currentTime = new Date().toISOString()
    const dispatchedServices = []
    const dispatchHistory = currentEmergency.dispatch_history || []

    services.forEach((service) => {
      const dispatchRecord = {
        service_name: service.name,
        service_type: service.serviceType,
        service_id: service.id,
        dispatched_at: currentTime,
        dispatched_by: adminName,
        admin_id: adminId,
        phone: service.phone,
        address: service.address,
        distance: service.distance,
      }

      dispatchedServices.push(dispatchRecord)
      dispatchHistory.push(dispatchRecord)
    })

    // Update emergency with dispatch information
    const updatePayload = {
      status: 'responding',
      dispatched_services: dispatchedServices,
      dispatch_history: dispatchHistory,
      updated_at: currentTime,
    }

    const { data: updatedData, error: updateError } = await supabase
      .from('emergencies')
      .update(updatePayload)
      .eq('id', emergencyId)
      .select()

    if (updateError) {
      console.error('Failed to update emergency:', updateError)
      return res.status(500).json({ error: 'Failed to dispatch services' })
    }

    console.log(
      `Successfully dispatched ${services.length} services to emergency ${emergencyId}`
    )

    res.json({
      success: true,
      message: `Successfully dispatched ${services.length} service(s)`,
      dispatchedServices: dispatchedServices,
      emergencyId: emergencyId,
      updatedEmergency: updatedData[0],
    })
  } catch (error) {
    console.error('Multi-dispatch error:', error)
    res.status(500).json({ error: 'Failed to dispatch services' })
  }
})

// Helper functions
function buildAddress(tags) {
  const addressParts = []

  if (tags['addr:housenumber']) addressParts.push(tags['addr:housenumber'])
  if (tags['addr:street']) addressParts.push(tags['addr:street'])
  if (tags['addr:city']) addressParts.push(tags['addr:city'])
  if (tags['addr:state']) addressParts.push(tags['addr:state'])
  if (tags['addr:postcode']) addressParts.push(tags['addr:postcode'])

  return addressParts.length > 0
    ? addressParts.join(', ')
    : 'Address not available'
}

function parseOpeningHours(openingHours) {
  if (!openingHours) return null

  // Simple check for 24/7
  if (openingHours.includes('24/7')) return true

  // For more complex parsing, you'd need a library like opening_hours.js
  // For now, return null (unknown)
  return null
}

function getFallbackEmergencyServices(lat, lon) {
  // Return basic emergency contacts as fallback
  return [
    {
      id: 'emergency_police',
      name: 'Police Emergency',
      address: 'India Emergency Services',
      phone: '100',
      distance: 0,
      location: { lat, lng: lon },
      rating: 'N/A',
      isOpen: true,
      types: ['emergency', 'police'],
      emergency: true,
    },
    {
      id: 'emergency_fire',
      name: 'Fire Emergency',
      address: 'India Emergency Services',
      phone: '101',
      distance: 0,
      location: { lat, lng: lon },
      rating: 'N/A',
      isOpen: true,
      types: ['emergency', 'fire_station'],
      emergency: true,
    },
    {
      id: 'emergency_medical',
      name: 'Medical Emergency',
      address: 'India Emergency Services',
      phone: '108',
      distance: 0,
      location: { lat, lng: lon },
      rating: 'N/A',
      isOpen: true,
      types: ['emergency', 'hospital'],
      emergency: true,
    },
  ]
}
// Helper function for distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // Earth's radius in km
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c
  return Math.round(distance * 100) / 100 // Round to 2 decimal places
}

function deg2rad(deg) {
  return deg * (Math.PI / 180)
}
// PUT /locations/:id - Update a saved location
app.put('/locations/:id', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.user
    const { id } = req.params
    const { name, address, latitude, longitude } = req.body

    // Validation
    if (!name || !address) {
      return res.status(400).json({
        error: 'Name and address are required',
      })
    }

    // Validate coordinates if provided
    if (latitude !== undefined && longitude !== undefined) {
      if (
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return res.status(400).json({
          error: 'Invalid coordinates',
        })
      }
    }

    // Can't update home address through this endpoint
    if (id === 'home') {
      return res
        .status(400)
        .json({ error: 'Use profile endpoint to update home address' })
    }

    // Extract index from id
    if (!id.startsWith('other_')) {
      return res.status(400).json({ error: 'Invalid location ID' })
    }

    const index = parseInt(id.split('_')[1])
    if (isNaN(index)) {
      return res.status(400).json({ error: 'Invalid location ID' })
    }

    // Get current other_addresses
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('other_addresses')
      .eq('id', user_id)
      .single()

    if (fetchError) {
      console.error('Fetch error:', fetchError)
      return res.status(500).json({ error: 'Failed to fetch user data' })
    }

    let otherAddresses = user.other_addresses || []

    // Filter out NULL values
    otherAddresses = otherAddresses.filter(
      (addr) => addr && addr !== 'NULL' && addr.trim() !== ''
    )

    // Check if index is valid
    if (index < 0 || index >= otherAddresses.length) {
      return res.status(404).json({ error: 'Location not found' })
    }

    // Prepare updated location object
    const updatedLocation = {
      name: name.trim(),
      address: address.trim(),
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      updated_at: new Date().toISOString(),
    }

    // Update the location at the specified index
    otherAddresses[index] = JSON.stringify(updatedLocation)

    // Update the database
    const { error: updateError } = await supabase
      .from('users')
      .update({ other_addresses: otherAddresses })
      .eq('id', user_id)

    if (updateError) {
      console.error('Update error:', updateError)
      return res.status(500).json({ error: 'Failed to update location' })
    }

    res.json({
      message: 'Location updated successfully',
      location: {
        id,
        ...updatedLocation,
        is_primary: false,
      },
    })
  } catch (err) {
    console.error('Server error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update emergency location continuously
app.put('/emergency/:emergencyId/update-location', authenticateToken, async (req, res) => {
  try {
    const { emergencyId } = req.params
    const { latitude, longitude } = req.body
    const userId = req.user?.id || req.user?.user_id

    // Validate coordinates
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude required' })
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' })
    }

    // Get emergency and verify ownership
    const { data: emergency, error: fetchError } = await supabase
      .from('emergencies')
      .select('user_id, status')
      .eq('id', emergencyId)
      .single()

    if (fetchError || !emergency) {
      return res.status(404).json({ error: 'Emergency not found' })
    }

    if (emergency.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    // Don't update if resolved
    const inactiveStatuses = ['Resolved', 'Completed', 'Cancelled', 'Closed', 'resolved']
    if (inactiveStatuses.includes(emergency.status)) {
      return res.status(400).json({ 
        error: 'Emergency already resolved',
        status: emergency.status,
        stopTracking: true
      })
    }

    // Update location as comma-separated string
    const locationString = `${latitude},${longitude}`
    
    const { error: updateError } = await supabase
      .from('emergencies')
      .update({ 
        location: locationString,
        location_updated_at: new Date().toISOString()
      })
      .eq('id', emergencyId)

    if (updateError) {
      console.error('Location update error:', updateError)
      return res.status(500).json({ error: 'Failed to update location' })
    }

    console.log(`Location updated for emergency ${emergencyId}: ${locationString}`)

    res.json({
      success: true,
      location: locationString,
      updated_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Update emergency location error:', error)
    res.status(500).json({ error: 'Failed to update location' })
  }
})
// POST /call
// Replace the existing /emergency/call route in your backend index.js

app.post('/emergency/call', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.user
    const { contactId } = req.body // Accept contactId from frontend

    // Get user's profile from Supabase to get emergency contacts
    const { data: user, error } = await supabase
      .from('users')
      .select(
        'primary_emergency_phone, primary_emergency_contact, secondary_emergency_phone, secondary_emergency_contact, emergency_calls'
      )
      .eq('id', user_id)
      .single()

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Select contact based on contactId
    let contactPhone, contactName

    if (contactId === 2 || contactId === '2') {
      // Secondary contact
      contactPhone = user.secondary_emergency_phone
      contactName = user.secondary_emergency_contact

      if (!contactPhone || !contactName) {
        return res
          .status(400)
          .json({ error: 'No secondary emergency contact found' })
      }
    } else {
      // Primary contact (default)
      contactPhone = user.primary_emergency_phone
      contactName = user.primary_emergency_contact

      if (!contactPhone || !contactName) {
        return res
          .status(400)
          .json({ error: 'No primary emergency contact found' })
      }
    }

    // Format phone number
    let formattedPhone = contactPhone.replace(/\D/g, '')
    if (formattedPhone.startsWith('91') && formattedPhone.length === 12) {
      formattedPhone = '+' + formattedPhone
    } else if (formattedPhone.length === 10) {
      formattedPhone = '+91' + formattedPhone
    } else {
      return res
        .status(400)
        .json({ error: 'Invalid emergency contact phone format' })
    }

    // Call the selected emergency contact
    const call = await client.calls.create({
      from: process.env.TWILIO_PHONE,
      to: formattedPhone,
      twiml: `<Response><Say>This is an emergency call triggered by ${contactName}. Please respond immediately.</Say></Response>`,
    })

    // Increment emergency calls count
    const newCount = (user.emergency_calls || 0) + 1
    await supabase
      .from('users')
      .update({ emergency_calls: newCount })
      .eq('id', user_id)

    console.log(
      `Emergency call made to ${contactName} (${contactPhone}): ${call.sid}`
    )

    res.json({
      success: true,
      sid: call.sid,
      emergency_calls: newCount,
      contact: contactName,
      contactType:
        contactId === 2 || contactId === '2' ? 'Secondary' : 'Primary',
    })
  } catch (err) {
    console.error('Error making emergency call:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// Add these routes to your index.js backend file

// Route to search for route to a pincode
app.post('/route/search', authenticateToken, async (req, res) => {
  try {
    const { fromLat, fromLng, toPincode } = req.body

    if (!fromLat || !fromLng || !toPincode) {
      return res.status(400).json({ error: 'Missing required parameters' })
    }

    // Validate pincode format
    if (!/^\d{6}$/.test(toPincode)) {
      return res.status(400).json({ error: 'Invalid pincode format' })
    }

    // Geocode the pincode to get destination coordinates
    const geocodeResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${toPincode}&countrycodes=IN&limit=1`
    )
    const geocodeData = await geocodeResponse.json()

    if (!geocodeData || geocodeData.length === 0) {
      return res.status(404).json({ error: 'Pincode not found' })
    }

    const destination = {
      lat: parseFloat(geocodeData[0].lat),
      lng: parseFloat(geocodeData[0].lon),
      address: geocodeData[0].display_name,
    }

    // You can also calculate distance here if needed
    const distance = calculateDistance(
      fromLat,
      fromLng,
      destination.lat,
      destination.lng
    )

    res.json({
      success: true,
      origin: { lat: fromLat, lng: fromLng },
      destination: destination,
      distance: distance,
      pincode: toPincode,
    })
  } catch (error) {
    console.error('Route search error:', error)
    res.status(500).json({ error: 'Failed to search route' })
  }
})

// Route to send location via SMS using Twilio
app.post('/location/send-sms', authenticateToken, async (req, res) => {
  try {
    const { contactId, latitude, longitude } = req.body

    if (!contactId || !latitude || !longitude) {
      return res.status(400).json({ error: 'Missing required parameters' })
    }

    // Get user's profile from Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.user_id)
      .single()

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    let contactName, contactPhone

    // Determine which contact to send to
    if (contactId === '1' || contactId === 1) {
      contactName = user.primary_emergency_contact
      contactPhone = user.primary_emergency_phone
    } else if (contactId === '2' || contactId === 2) {
      contactName = user.secondary_emergency_contact
      contactPhone = user.secondary_emergency_phone
    } else {
      return res.status(400).json({ error: 'Invalid contact ID' })
    }

    if (!contactName || !contactPhone) {
      return res.status(400).json({ error: 'Contact not found or incomplete' })
    }

    // Format phone number for Twilio (ensure it has country code)
    let formattedPhone = contactPhone.replace(/\D/g, '') // Remove non-digits
    if (formattedPhone.startsWith('91') && formattedPhone.length === 12) {
      formattedPhone = '+' + formattedPhone
    } else if (formattedPhone.length === 10) {
      formattedPhone = '+91' + formattedPhone
    } else {
      return res.status(400).json({ error: 'Invalid phone number format' })
    }

    // Reverse geocode to get pincode/area info
    let locationInfo = `${latitude}, ${longitude}`
    try {
      const geocodeResponse = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
      )
      const geocodeData = await geocodeResponse.json()

      if (geocodeData && geocodeData.address) {
        const address = geocodeData.address
        const pincode = address.postcode
        const city = address.city || address.town || address.village
        const state = address.state

        if (pincode) {
          locationInfo = `${city || 'Unknown Area'}, ${
            state || 'India'
          } - ${pincode}`
        } else if (city) {
          locationInfo = `${city}, ${state || 'India'}`
        }
      }
    } catch (geocodeError) {
      console.log('Geocoding failed, using coordinates:', geocodeError.message)
      // Will use coordinates as fallback
    }

    // Create simple location message without URL
    const locationMessage = `EMERGENCY ALERT from ${user.first_name} ${user.last_name}. Location: ${locationInfo}. Coordinates: ${latitude}, ${longitude}. Please respond immediately.`

    console.log('Sending SMS to formatted phone:', formattedPhone)
    console.log('Original phone from database:', contactPhone)
    console.log('Message content:', locationMessage)

    // Send SMS using Twilio
    const message = await client.messages.create({
      body: locationMessage,
      from: process.env.TWILIO_PHONE,
      to: formattedPhone,
    })

    console.log(`Location SMS sent to ${contactName}: ${message.sid}`)

    res.json({
      success: true,
      contactName: contactName,
      phone: contactPhone,
      messageSid: message.sid,
      locationInfo: locationInfo,
      message: 'Location sent successfully via SMS',
    })
  } catch (error) {
    console.error('SMS sending error:', error)
    res.status(500).json({ error: 'Failed to send location SMS' })
  }
})

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // Earth's radius in kilometers
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c // Distance in kilometers
  return Math.round(distance * 100) / 100 // Round to 2 decimal places
}

function deg2rad(deg) {
  return deg * (Math.PI / 180)
}

// Additional route to get route details (optional - for more detailed routing)
app.post('/route/details', authenticateToken, async (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.body

    if (!fromLat || !fromLng || !toLat || !toLng) {
      return res.status(400).json({ error: 'Missing coordinates' })
    }

    // You can integrate with routing services like OpenRouteService or MapBox here
    // For now, we'll return basic details
    const distance = calculateDistance(fromLat, fromLng, toLat, toLng)
    const estimatedTime = Math.round((distance / 50) * 60) // Rough estimate: 50 km/h average speed

    res.json({
      success: true,
      distance: distance,
      estimatedTime: estimatedTime,
      googleMapsUrl: `https://www.google.com/maps/dir/${fromLat},${fromLng}/${toLat},${toLng}`,
    })
  } catch (error) {
    console.error('Route details error:', error)
    res.status(500).json({ error: 'Failed to get route details' })
  }
})

// Route to send bulk location alerts to all emergency contacts
app.post(
  '/location/send-emergency-alert',
  authenticateToken,
  async (req, res) => {
    try {
      const { latitude, longitude, emergencyType = 'GENERAL' } = req.body

      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Location coordinates required' })
      }

      // Get user's profile from Supabase
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', req.user.user_id)
        .single()

      if (error || !user) {
        return res.status(404).json({ error: 'User not found' })
      }

      const contacts = []
      const results = []

      // Add primary contact
      if (user.primary_emergency_contact && user.primary_emergency_phone) {
        contacts.push({
          name: user.primary_emergency_contact,
          phone: user.primary_emergency_phone,
          relation: user.primary_emergency_relation || 'Primary',
        })
      }

      // Add secondary contact
      if (user.secondary_emergency_contact && user.secondary_emergency_phone) {
        contacts.push({
          name: user.secondary_emergency_contact,
          phone: user.secondary_emergency_phone,
          relation: user.secondary_emergency_relation || 'Secondary',
        })
      }

      if (contacts.length === 0) {
        return res
          .status(400)
          .json({ error: 'No emergency contacts configured' })
      }

      // Send SMS to all contacts
      for (const contact of contacts) {
        try {
          let formattedPhone = contact.phone.replace(/\D/g, '')
          if (formattedPhone.startsWith('91') && formattedPhone.length === 12) {
            formattedPhone = '+' + formattedPhone
          } else if (formattedPhone.length === 10) {
            formattedPhone = '+91' + formattedPhone
          } else {
            results.push({
              contact: contact.name,
              status: 'failed',
              error: 'Invalid phone format',
            })
            continue
          }

          const googleMapsLink = `https://maps.google.com/?q=${latitude},${longitude}`
          const alertMessage = `🚨 ${emergencyType} EMERGENCY ALERT 🚨\n\nFrom: ${
            user.first_name
          } ${
            user.last_name
          }\nTime: ${new Date().toLocaleString()}\nLocation: ${latitude}, ${longitude}\n\nView location: ${googleMapsLink}\n\nPlease respond immediately. This is an automated emergency alert.`

          const message = await client.messages.create({
            body: alertMessage,
            from: process.env.TWILIO_PHONE,
            to: formattedPhone,
          })

          results.push({
            contact: contact.name,
            phone: contact.phone,
            status: 'sent',
            messageSid: message.sid,
          })
        } catch (error) {
          console.error(`Failed to send SMS to ${contact.name}:`, error)
          results.push({
            contact: contact.name,
            status: 'failed',
            error: error.message,
          })
        }
      }

      res.json({
        success: true,
        alertType: emergencyType,
        contactsNotified: results.filter((r) => r.status === 'sent').length,
        totalContacts: contacts.length,
        results: results,
      })
    } catch (error) {
      console.error('Emergency alert error:', error)
      res.status(500).json({ error: 'Failed to send emergency alerts' })
    }
  }
)

app.post('/admin/decrypt-medical', authenticateAdmin, async (req, res) => {
  try {
    const { encryptedData } = req.body

    if (!encryptedData || encryptedData.trim() === '') {
      return res.json({ decryptedData: 'N/A' })
    }

    // Use your existing decrypt function from the backend
    const decryptedData = decrypt(encryptedData)

    res.json({
      success: true,
      decryptedData: decryptedData || 'Unable to decrypt',
    })
  } catch (error) {
    console.error('Decryption error:', error)
    res.json({
      success: false,
      decryptedData: 'Unable to decrypt medical information',
    })
  }
})

app.post('/get-nearby-services', async (req, res) => {
  try {
    const { lat, lng } = req.body // front-end sends current location

    const types = ['police', 'hospital', 'fire_station']
    const results = {}

    for (const type of types) {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=${type}&key=${process.env.GOOGLE_PLACES_API_KEY}`
      const response = await fetch(url)
      const data = await response.json()

      results[type] = data.results.map((place) => ({
        name: place.name,
        address: place.vicinity,
        location: place.geometry.location,
        rating: place.rating || 'N/A',
        phone: place.formatted_phone_number || 'Not Available',
      }))
    }

    res.json({
      success: true,
      nearby: results,
    })
  } catch (err) {
    console.error('Error fetching services:', err.message)
    res.status(500).json({ success: false, error: 'Failed to fetch services' })
  }
})


// ===========================================
// DISPATCH UNIT AUTHENTICATION & MANAGEMENT
// ===========================================

// Temporary OTP store for dispatch units (Consider using Redis in production)
const dispatchOtpStore = new Map()

// Clean expired OTPs periodically
setInterval(() => {
  const now = Date.now()
  for (const [phone, data] of dispatchOtpStore.entries()) {
    if (now > data.expiresAt) {
      dispatchOtpStore.delete(phone)
    }
  }
}, 5 * 60 * 1000) // Clean every 5 minutes

// ===========================================
// VALIDATION UTILITIES
// ===========================================

// ===========================================
// CORRECTED VALIDATION UTILITIES
// ===========================================

const dispatchValidation = {
  // Fixed: Added max length check to match database constraint (50 chars)
  validateUsername: (username) => {
    const regex = /^(?=.*[a-zA-Z])[a-zA-Z0-9_-]{8,50}$/
    return {
      isValid: regex.test(username) && username.length <= 50,
      message:
        username?.length < 8
          ? 'Username must be at least 8 characters long'
          : username?.length > 50
          ? 'Username must not exceed 50 characters'
          : !regex.test(username)
          ? 'Username must contain at least one letter and only use letters, numbers, underscores, or hyphens'
          : null,
    }
  },

  // Validate contact number
  validateContactNumber: (contactNumber) => {
    const cleaned = contactNumber?.toString().replace(/\D/g, '')
    return {
      isValid: cleaned?.length === 10,
      cleaned: cleaned,
      formatted: cleaned?.length === 10 ? `+91${cleaned}` : null,
      message:
        cleaned?.length !== 10
          ? 'Contact number must be exactly 10 digits'
          : null,
    }
  },

  // Validate pincode
  validatePincode: (pincode) => {
    const regex = /^\d{6}$/
    return {
      isValid: regex.test(pincode),
      message: !regex.test(pincode) ? 'Pincode must be exactly 6 digits' : null,
    }
  },

  // Validate email
  validateEmail: (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return {
      isValid: regex.test(email),
      message: !regex.test(email) ? 'Invalid email format' : null,
    }
  },

  // Validate dispatch category
  validateCategory: (category) => {
    const validCategories = ['police', 'fire', 'medical']
    const normalized = category?.toString().toLowerCase().trim()
    return {
      isValid: validCategories.includes(normalized),
      normalized,
      validCategories,
      message: !validCategories.includes(normalized)
        ? `Category must be one of: ${validCategories.join(', ')}`
        : null,
    }
  },
}

// ===========================================
// DISPATCH UNIT ROUTES
// ===========================================

// 1. Check username uniqueness
app.post('/dispatch/check-username', async (req, res) => {
  try {
    const { username } = req.body

    if (!username) {
      return res.status(400).json({
        detail: 'Username is required',
        isUnique: false,
      })
    }

    const validation = dispatchValidation.validateUsername(username)
    if (!validation.isValid) {
      return res.status(400).json({
        detail: validation.message,
        isUnique: false,
      })
    }

    const cleanUsername = username.toLowerCase().trim()

    // Check if username exists
    const { data: existingUnit, error } = await supabase
      .from('dispatch_units')
      .select('id, username')
      .eq('username', cleanUsername)
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Username check error:', error)
      return res.status(500).json({
        detail: 'Failed to check username availability',
        isUnique: false,
      })
    }

    const isUnique = !existingUnit

    res.json({ isUnique })
  } catch (err) {
    console.error('Username check error:', err)
    res.status(500).json({
      detail: 'Failed to check username availability',
      isUnique: false,
    })
  }
})

// 2. Send OTP for registration
app.post('/dispatch/send_otp', async (req, res) => {
  try {
    const {
      department_name,
      unit_type,
      place,
      district,
      state,
      pincode,
      username,
      contact_number,
      alternate_contact_number,
      email,
      password,
      officer_in_charge,
      officer_contact,
      vehicle_count,
    } = req.body

    // Validate required fields
    const requiredFields = {
      department_name,
      unit_type,
      place,
      district,
      state,
      pincode,
      username,
      contact_number,
      email,
      password,
      officer_in_charge,
      officer_contact,
    }

    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value || value.toString().trim() === '')
      .map(([key]) => key.replace('_', ' '))

    if (missingFields.length > 0) {
      return res.status(400).json({
        detail: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields,
      })
    }

    // Validate individual fields
    const validations = {
      username: dispatchValidation.validateUsername(username),
      contact: dispatchValidation.validateContactNumber(contact_number),
      pincode: dispatchValidation.validatePincode(pincode),
      email: dispatchValidation.validateEmail(email),
    }

    // Check for validation errors
    const validationErrors = Object.entries(validations)
      .filter(([key, validation]) => !validation.isValid)
      .map(([key, validation]) => ({ field: key, message: validation.message }))

    if (validationErrors.length > 0) {
      return res.status(400).json({
        detail: 'Validation failed',
        errors: validationErrors,
      })
    }

    const cleanUsername = username.toLowerCase().trim()
    const formattedContact = validations.contact.formatted

    // Check for existing dispatch units
    const { data: existingUnit, error: checkError } = await supabase
      .from('dispatch_units')
      .select('id, email, contact_number, username')
      .or(
        `email.eq.${email},contact_number.eq.${formattedContact},username.eq.${cleanUsername}`
      )
      .single()

    if (existingUnit) {
      let conflictField = 'information'
      if (existingUnit.email === email) conflictField = 'email'
      else if (existingUnit.contact_number === formattedContact)
        conflictField = 'contact number'
      else if (existingUnit.username === cleanUsername)
        conflictField = 'username'

      return res.status(400).json({
        detail: `Dispatch unit with this ${conflictField} already exists`,
      })
    }

    // Generate and store OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes

    dispatchOtpStore.set(formattedContact, {
      otp,
      expiresAt,
      attempts: 0,
      lastSentAt: Date.now(),
      dispatchData: {
        department_name: department_name.trim(),
        unit_type,
        city: place.trim(),
        district: district.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        username: cleanUsername,
        contact_number: formattedContact,
        alternate_contact_number: alternate_contact_number?.trim() || null,
        email: email.toLowerCase().trim(),
        password,
        officer_in_charge: officer_in_charge.trim(),
        officer_contact: officer_contact.trim(),
        vehicle_count: vehicle_count ? parseInt(vehicle_count) : 0,
      },
    })

    // Send OTP via Twilio
    await client.messages.create({
      body: `Your Emergency Dispatch Unit registration OTP is ${otp}. Valid for 5 minutes. Do not share this code.`,
      from: process.env.TWILIO_PHONE,
      to: formattedContact,
    })

    console.log(`Dispatch OTP sent to ${formattedContact}`)

    res.json({
      message: 'OTP sent successfully to dispatch unit contact number',
      expiresIn: 300, // 5 minutes in seconds
    })
  } catch (err) {
    console.error('Dispatch OTP error:', err)
    res.status(500).json({
      detail: 'Failed to send OTP. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
})

// 3. Verify OTP and register dispatch unit
app.post('/dispatch/verify_otp', async (req, res) => {
  try {
    const { contact_number, otp } = req.body

    if (!contact_number || !otp) {
      return res.status(400).json({
        error: 'Contact number and OTP are required',
      })
    }

    const record = dispatchOtpStore.get(contact_number)

    if (!record) {
      return res.status(400).json({
        error: 'OTP not found or expired. Please request a new OTP.',
      })
    }

    // Check if OTP has expired
    if (Date.now() > record.expiresAt) {
      dispatchOtpStore.delete(contact_number)
      return res.status(400).json({
        error: 'OTP has expired. Please request a new OTP.',
      })
    }

    // Check OTP attempts (prevent brute force)
    if (record.attempts >= 3) {
      dispatchOtpStore.delete(contact_number)
      return res.status(429).json({
        error: 'Too many incorrect attempts. Please request a new OTP.',
      })
    }

    // Verify OTP
    if (record.otp !== otp.toString().trim()) {
      record.attempts += 1
      dispatchOtpStore.set(contact_number, record)

      return res.status(400).json({
        error: 'Invalid OTP',
        attemptsRemaining: 3 - record.attempts,
      })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(record.dispatchData.password, 12)

    // Insert dispatch unit into database
    const { error: insertError, data: newUnit } = await supabase
      .from('dispatch_units')
      .insert([
        {
          ...record.dispatchData,
          password: hashedPassword,
          is_active: true,
          is_verified: true,
          registered_at: new Date().toISOString(),
        },
      ])
      .select(
        'id, email, username, department_name, unit_type, city, district, state, contact_number'
      )
      .single()

    if (insertError) {
      console.error('Dispatch unit insert error:', insertError)

      // Handle specific database errors
      if (insertError.code === '23505') {
        // Unique constraint violation
        return res.status(400).json({
          error: 'A dispatch unit with this information already exists',
        })
      }

      return res.status(500).json({
        error: 'Failed to register dispatch unit. Please try again.',
      })
    }

    // Clean up OTP store
    dispatchOtpStore.delete(contact_number)

    // Generate JWT token
    const tokenPayload = {
      unit_id: newUnit.id,
      email: newUnit.email,
      username: newUnit.username,
      userType: 'dispatch_unit',
      department_name: newUnit.department_name,
      unit_type: newUnit.unit_type,
      place: newUnit.place,
      district: newUnit.district,
      state: newUnit.state,
    }

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: '7d',
      issuer: 'emergency-dispatch-system',
      audience: 'dispatch-units',
    })

    console.log(
      `New dispatch unit registered: ${newUnit.username} (${newUnit.department_name})`
    )

    res.status(201).json({
      message: 'Dispatch unit registered successfully',
      unit: newUnit,
      token,
    })
  } catch (err) {
    console.error('Dispatch unit verification error:', err)
    res.status(500).json({
      error: 'Registration failed. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
})

// 4. Resend OTP
app.post('/dispatch/resend_otp', async (req, res) => {
  try {
    const { contact_number } = req.body

    if (!contact_number) {
      return res.status(400).json({
        error: 'Contact number is required',
      })
    }

    const record = dispatchOtpStore.get(contact_number)

    if (!record) {
      return res.status(400).json({
        error: 'No OTP request found. Please start registration again.',
      })
    }

    // Check cooldown (prevent spam)
    const now = Date.now()
    const cooldownPeriod = 60 * 1000 // 1 minute

    if (record.lastSentAt && now - record.lastSentAt < cooldownPeriod) {
      const waitTime = Math.ceil(
        (cooldownPeriod - (now - record.lastSentAt)) / 1000
      )
      return res.status(429).json({
        error: `Please wait ${waitTime} seconds before requesting a new OTP`,
      })
    }

    // Generate new OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString()

    // Update record
    record.otp = newOtp
    record.expiresAt = now + 5 * 60 * 1000 // 5 minutes
    record.lastSentAt = now
    record.attempts = 0 // Reset attempts

    dispatchOtpStore.set(contact_number, record)

    // Send new OTP
    await client.messages.create({
      body: `Your new Emergency Dispatch Unit registration OTP is ${newOtp}. Valid for 5 minutes. Do not share this code.`,
      from: process.env.TWILIO_PHONE,
      to: contact_number,
    })

    console.log(`New dispatch OTP sent to ${contact_number}`)

    res.json({
      message: 'New OTP sent successfully',
      expiresIn: 300,
    })
  } catch (err) {
    console.error('Dispatch resend OTP error:', err)
    res.status(500).json({
      error: 'Failed to resend OTP. Please try again later.',
    })
  }
})

// ===========================================
// AUTHENTICATION MIDDLEWARE
// ===========================================

function authenticateDispatchUnit(req, res, next) {
  
const authHeader = req.headers['authorization']
console.log("Authorization header:", authHeader)

const token = authHeader && authHeader.split(' ')[1]
console.log("Extracted token:", token)

  if (!token) {
    return res.status(401).json({
      error: 'Access token required',
      code: 'MISSING_TOKEN',
    })
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      console.error('JWT verification error:', err.message)

      let errorMessage = 'Invalid token'
      let errorCode = 'INVALID_TOKEN'

      if (err.name === 'TokenExpiredError') {
        errorMessage = 'Token has expired. Please login again.'
        errorCode = 'TOKEN_EXPIRED'
      } else if (err.name === 'JsonWebTokenError') {
        errorMessage = 'Invalid token format'
        errorCode = 'MALFORMED_TOKEN'
      }

      return res.status(403).json({
        error: errorMessage,
        code: errorCode,
        expired: err.name === 'TokenExpiredError',
      })
    }

    if (decoded.userType !== 'dispatch_unit') {
      return res.status(403).json({
        error: 'Dispatch unit access required',
        code: 'INVALID_USER_TYPE',
        requiredType: 'dispatch_unit',
        actualType: decoded.userType,
      })
    }

    // Additional validation for required fields
    if (!decoded.unit_id) {
      return res.status(403).json({
        error: 'Invalid token payload',
        code: 'INCOMPLETE_TOKEN',
      })
    }

    // Verify dispatch unit is still active (optional security check)
    try {
      const { data: unit } = await supabase
        .from('dispatch_units')
        .select('is_active, is_verified')
        .eq('id', decoded.unit_id)
        .single()

      if (!unit?.is_active || !unit?.is_verified) {
        return res.status(403).json({
          error: 'Dispatch unit account is deactivated or unverified',
          code: 'ACCOUNT_DEACTIVATED',
        })
      }
    } catch (dbError) {
      console.error('Database check error:', dbError)
      // Continue without database check if there's an error
    }

    req.user = decoded
    next()
  })
}

// ===========================================
// DISPATCH UNIT LOGIN
// ===========================================

app.post('/dispatch/login', async (req, res) => {
  try {
    const { username, password, category } = req.body

    // Input validation
    const validationErrors = []

    if (!username?.trim()) {
      validationErrors.push({
        field: 'username',
        message: 'Username is required',
      })
    }

    if (!password) {
      validationErrors.push({
        field: 'password',
        message: 'Password is required',
      })
    }

    const categoryValidation = dispatchValidation.validateCategory(category)
    if (!categoryValidation.isValid) {
      validationErrors.push({
        field: 'category',
        message: categoryValidation.message,
        validCategories: categoryValidation.validCategories,
      })
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: validationErrors,
      })
    }

    const cleanUsername = username.toLowerCase().trim()
    const normalizedCategory = categoryValidation.normalized

    // Fetch dispatch unit
    const { data: dispatch, error } = await supabase
      .from('dispatch_units')
      .select('*')
      .eq('username', cleanUsername)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(401).json({ error: 'Invalid username or password' })
      } else {
        console.error('Database error during login:', error)
        return res.status(500).json({
          error: 'Database connection failed. Please try again later.',
        })
      }
    }

    // Check account status
    if (!dispatch.is_verified) {
      return res.status(401).json({
        error:
          'Your dispatch unit account is not verified. Please contact your administrator.',
      })
    }

    if (!dispatch.is_active) {
      return res.status(401).json({
        error:
          'Your dispatch unit has been deactivated. Please contact your supervisor.',
      })
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(
      password,
      dispatch.password
    )

    if (!isValidPassword) {
      // Optional: implement failed login attempt tracking
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    // Check unit type compatibility with category
    const unitTypeCompatibility = {
      'Police Station': ['police'],
      'Traffic Police': ['police'],
      'Fire Station': ['fire'],
      'Hospital/Medical Center': ['medical'],
      'Ambulance Service': ['medical'],
      'Emergency Response Team': ['police', 'fire', 'medical'],
      'Disaster Management': ['police', 'fire', 'medical'],
      Other: ['police', 'fire', 'medical'],
    }

    const allowedCategories = unitTypeCompatibility[dispatch.unit_type] || []
    if (
      allowedCategories.length > 0 &&
      !allowedCategories.includes(normalizedCategory)
    ) {
      return res.status(400).json({
        error: `This unit is registered as "${dispatch.unit_type}" and cannot access "${normalizedCategory}" services.`,
        allowedCategories,
        unitType: dispatch.unit_type,
      })
    }

    // Update last login
    const loginTime = new Date().toISOString()
    await supabase
      .from('dispatch_units')
      .update({ last_login: loginTime })
      .eq('id', dispatch.id)

    // Generate JWT token
    const tokenPayload = {
      unit_id: dispatch.id,
      email: dispatch.email,
      type: 'dispatch',
      username: dispatch.username,
      category: normalizedCategory,
      userType: 'dispatch_unit',
      department_name: dispatch.department_name,
      unit_type: dispatch.unit_type,
      place: dispatch.place,
      district: dispatch.district,
      state: dispatch.state,
      login_time: loginTime,
        officer_in_charge: dispatch.officer_in_charge, // ADD THIS - missing from your current JWT
  officer_contact: dispatch.officer_contact, // ADD THIS if needed
  primary_contact:dispatch.contact_number,
  city:dispatch.city
    }

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: '8d',
      issuer: 'emergency-dispatch-system',
      audience: 'dispatch-units',
      
    })

    console.log(
      `Dispatch login successful: ${dispatch.username} (${normalizedCategory})`
    )

    const responseData = {
      message: 'Dispatch login successful',
      dispatch: {
        id: dispatch.id,
        email: dispatch.email,
        username: dispatch.username,
        department_name: dispatch.department_name,
        unit_type: dispatch.unit_type,
        category: normalizedCategory,
        place: dispatch.place,
        district: dispatch.district,
        state: dispatch.state,
        officer_in_charge: dispatch.officer_in_charge,
        vehicle_count: dispatch.vehicle_count || 0,
        last_login: loginTime,
        contact_number: dispatch.contact_number,
        alternate_contact_number: dispatch.alternate_contact_number,
        officer_in_charge: dispatch.officer_in_charge, // ADD THIS - missing from your current JWT
  officer_contact: dispatch.officer_contact, // ADD THIS if needed
  primary_contact:dispatch.contact_number,
  city:dispatch.city
      },
      token,
      session: {
        loginTime,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        category: normalizedCategory,
      },
    }

    res.json(responseData)
  } catch (err) {
    console.error('Dispatch login error:', err)
    res.status(500).json({
      error: 'Login failed. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
})

// Change password
app.put(
  '/dispatch/change-password',
  authenticateDispatchUnit,
  async (req, res) => {
    try {
      const { current_password, new_password } = req.body

      if (!current_password || !new_password) {
        return res.status(400).json({
          error: 'Current password and new password are required',
        })
      }

      if (new_password.length < 8) {
        return res.status(400).json({
          error: 'New password must be at least 8 characters long',
        })
      }

      // Get current unit data
      const { data: unit, error } = await supabase
        .from('dispatch_units')
        .select('password')
        .eq('id', req.unit.unit_id)
        .single()

      if (error || !unit) {
        return res.status(404).json({ error: 'Dispatch unit not found' })
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(
        current_password,
        unit.password
      )
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' })
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(new_password, 12)

      // Update password
      const { error: updateError } = await supabase
        .from('dispatch_units')
        .update({
          password: hashedNewPassword,
          updated_at: new Date().toISOString(),
        })
        .eq('id', req.unit.unit_id)

      if (updateError) {
        console.error('Password update error:', updateError)
        return res.status(500).json({ error: 'Failed to update password' })
      }

      console.log(`Password updated for dispatch unit: ${req.unit.username}`)

      res.json({
        message: 'Password updated successfully',
        success: true,
      })
    } catch (err) {
      console.error('Change password error:', err)
      res.status(500).json({ error: 'Failed to change password' })
    }
  }
)

// Logout
app.post('/dispatch/logout', authenticateDispatchUnit, async (req, res) => {
  try {
    const { unit_id, username } = req.unit

    // Optional: Log logout activity
    console.log(`Dispatch unit logged out: ${username}`)

    // Optional: Update last activity timestamp
    await supabase
      .from('dispatch_units')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', unit_id)

    res.json({
      message: 'Logged out successfully',
      success: true,
    })
  } catch (err) {
    console.error('Dispatch logout error:', err)
    res.status(500).json({ error: 'Logout failed' })
  }
})
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
)
// Add these missing routes to your backend/index.js

// ===========================================
// DISPATCH DASHBOARD ROUTES
// ===========================================

// Get dispatch unit profile
app.get('/dispatch/profile/me', authenticateDispatchUnit, async (req, res) => {
  try {
    const { unit_id } = req.user

    const { data: unit, error } = await supabase
      .from('dispatch_units')
      .select('*')
      .eq('id', unit_id)
      .single()

    if (error || !unit) {
      return res.status(404).json({ error: 'Dispatch unit not found' })
    }

    // Format response to match frontend expectations
    res.json({
      id: unit.id,
      department_name: unit.department_name,
      unit_type: unit.unit_type,
      place: unit.place,
      district: unit.district,
      state: unit.state,
      pincode: unit.pincode,
      username: unit.username,
      official_email: unit.email,
      primary_contact: unit.contact_number,
      alternate_contact: unit.alternate_contact_number,
      officer_name: unit.officer_in_charge,
      officer_contact: unit.officer_contact,
      vehicle_count: unit.vehicle_count || 0,
      response_count: unit.response_count || 0,
      total_responses: unit.total_responses || 0,
      active_status: unit.is_active ? 'Active' : 'Inactive',
    })
  } catch (err) {
    console.error('Get dispatch profile error:', err)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// Update dispatch unit profile
app.put('/dispatch/profile/me', authenticateDispatchUnit, async (req, res) => {
  try {
    const { unit_id } = req.unit
    const {
      department_name,
      unit_type,
      place,
      district,
      state,
      pincode,
      username,
      official_email,
      primary_contact,
      alternate_contact,
      officer_name,
      officer_contact,
      vehicle_count,
    } = req.body

    // Validate required fields
    if (!department_name || !unit_type || !place || !district || !state) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const updateData = {
      department_name,
      unit_type,
      place,
      district,
      state,
      pincode,
      username: username?.toLowerCase().trim(),
      email: official_email?.toLowerCase().trim(),
      contact_number: primary_contact,
      alternate_contact_number: alternate_contact,
      officer_in_charge: officer_name,
      officer_contact,
      vehicle_count: vehicle_count ? parseInt(vehicle_count) : 0,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('dispatch_units')
      .update(updateData)
      .eq('id', unit_id)

    if (error) {
      console.error('Profile update error:', error)
      return res.status(500).json({ error: 'Failed to update profile' })
    }

    res.json({ message: 'Profile updated successfully' })
  } catch (err) {
    console.error('Update dispatch profile error:', err)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// Get dispatch vehicles
app.get('/dispatch/vehicles', authenticateDispatchUnit, async (req, res) => {
  try {
    const { unit_id } = req.user

    const { data: vehicles, error } = await supabase
      .from('dispatch_vehicles')
      .select('*')
      .eq('dispatch_unit_id', unit_id)
      .order('vehicle_id', { ascending: true })

    if (error) {
      console.error('Vehicles fetch error:', error)
      return res.status(500).json({ error: 'Failed to fetch vehicles' })
    }

    res.json(vehicles || [])
  } catch (err) {
    console.error('Get vehicles error:', err)
    res.status(500).json({ error: 'Failed to fetch vehicles' })
  }
})

// Get request statistics for dispatch dashboard
app.get('/dispatch/requests/stats', authenticateDispatchUnit, async (req, res) => {
  try {
    const { unit_id } = req.user
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format

    // Get pending requests (not yet accepted by any dispatch unit)
    const { data: pendingRequests, error: pendingError } = await supabase
      .from('emergencies')
      .select('id')
      .eq('status', 'Pending')
      .is('dispatch_unit_id', null)

    if (pendingError) {
      console.error('Pending requests error:', pendingError)
    }

    // Get accepted requests by this unit
    const { data: acceptedRequests, error: acceptedError } = await supabase
      .from('emergencies')
      .select('id')
      .eq('dispatch_unit_id', unit_id)
      .in('status', ['Accepted', 'Dispatched', 'En Route', 'On Scene'])

    if (acceptedError) {
      console.error('Accepted requests error:', acceptedError)
    }

    // Get completed requests today
    const { data: completedToday, error: completedError } = await supabase
      .from('emergencies')
      .select('id')
      .eq('dispatch_unit_id', unit_id)
      .eq('status', 'Completed')
      .gte('completed_at', today + 'T00:00:00.000Z')
      .lt('completed_at', today + 'T23:59:59.999Z')

    if (completedError) {
      console.error('Completed requests error:', completedError)
    }

    res.json({
      pending: pendingRequests?.length || 0,
      accepted: acceptedRequests?.length || 0,
      completed_today: completedToday?.length || 0,
    })
  } catch (err) {
    console.error('Request stats error:', err)
    res.status(500).json({ error: 'Failed to fetch request statistics' })
  }
})


// Accept an emergency request
app.post('/dispatch/requests/:requestId/accept', authenticateDispatchUnit, async (req, res) => {
  console.log('🟡 [Backend] Accept request route called');

  try {
    const { requestId } = req.params;
    const { unit_id } = req.user;
    const { accepted_by } = req.body;

    // 1️⃣ Find the dispatch request
    const { data: dispatchReq, error: fetchReqError } = await supabase
      .from('dispatch_requests')
      .select('id, emergency_id, status, dispatch_unit_id')
      .eq('id', requestId)
      .single();

    if (fetchReqError || !dispatchReq) {
      console.error('🔴 Dispatch request not found:', fetchReqError);
      return res.status(404).json({ error: 'Dispatch request not found' });
    }

    if (dispatchReq.status !== 'Pending') {
      if (dispatchReq.dispatch_unit_id === unit_id) {
        return res.json({ 
          message: 'Request already accepted by your unit',
          already_accepted: true 
        });
      }
      return res.status(400).json({
        error: 'This request has already been accepted by another unit',
        already_accepted: true
      });
    }

    // 2️⃣ Find the related emergency
    const { data: emergency, error: fetchEmergencyError } = await supabase
      .from('emergencies')
      .select('*')
      .eq('id', dispatchReq.emergency_id)
      .single();

    if (fetchEmergencyError || !emergency) {
      console.error('🔴 Emergency not found:', fetchEmergencyError);
      return res.status(404).json({ error: 'Emergency not found' });
    }

    if (emergency.status === 'Dispatched' || emergency.dispatch_unit_id) {
      if (emergency.dispatch_unit_id === unit_id) {
        await supabase
          .from('dispatch_requests')
          .update({
            status: 'Accepted',
            dispatch_unit_id: unit_id,
            accepted_at: new Date().toISOString(),
            accepted_by: accepted_by || 'Dispatch Unit',
          })
          .eq('id', requestId);
          
        return res.json({ 
          message: 'Request already accepted by your unit',
          already_accepted: true 
        });
      }
      return res.status(400).json({
        error: 'Emergency has already been accepted by another unit',
        already_accepted: true
      });
    }

    // 3️⃣ Get dispatch unit details
    const { data: dispatchUnit } = await supabase
      .from('dispatch_units')
      .select('department_name, unit_type, place, district, contact_number, officer_in_charge')
      .eq('id', unit_id)
      .single();

    const currentTime = new Date().toISOString();
    
    // Create dispatch service record
    const dispatchServiceRecord = {
      service_name: req.user.department_name || 'Unknown Department',
      service_type: req.user.unit_type || 'Unknown Type',
      service_id: unit_id,
      dispatched_at: currentTime,
      dispatched_by: accepted_by || req.user.officer_in_charge || 'Dispatch Unit',
      phone: dispatchUnit?.contact_number || req.user.primary_contact || 'N/A',
      place: dispatchUnit?.place || req.user.city || 'Unknown',
      district: req.user.district || 'Unknown',
      status: 'Accepted',
      unit_id: unit_id
    };

    console.log('Dispatch service record:', JSON.stringify(dispatchServiceRecord, null, 2));

    // CRITICAL: Parse existing JSONB data properly
    let existingServices = [];
    let existingHistory = [];

    try {
      existingServices = emergency.dispatched_services 
        ? (typeof emergency.dispatched_services === 'string' 
            ? JSON.parse(emergency.dispatched_services) 
            : emergency.dispatched_services)
        : [];
      
      existingHistory = emergency.dispatch_history 
        ? (typeof emergency.dispatch_history === 'string' 
            ? JSON.parse(emergency.dispatch_history) 
            : emergency.dispatch_history)
        : [];
    } catch (parseError) {
      console.error('🔴 Error parsing JSON:', parseError);
      existingServices = [];
      existingHistory = [];
    }

    // Ensure they are arrays
    if (!Array.isArray(existingServices)) existingServices = [];
    if (!Array.isArray(existingHistory)) existingHistory = [];

    console.log('Existing services:', existingServices);
    console.log('Existing history:', existingHistory);

    // Add new service
    const updatedServices = [...existingServices, dispatchServiceRecord];
    const updatedHistory = [...existingHistory, dispatchServiceRecord];

    console.log('Updated services:', JSON.stringify(updatedServices, null, 2));
    console.log('Updated history:', JSON.stringify(updatedHistory, null, 2));

    // 4️⃣ Update emergency - Use JSON.stringify for JSONB fields
    const { data: updatedEmergency, error: updateEmergencyError } = await supabase
      .from('emergencies')
      .update({
        status: 'Dispatching',
        dispatch_unit_id: unit_id,
        accepted_at: currentTime,
        handled_by: accepted_by || 'Dispatch Unit',
        dispatched_services: updatedServices,
        dispatch_history: updatedHistory,
      })
      .eq('id', dispatchReq.emergency_id)
      .eq('status', 'Accepted')
      .is('dispatch_unit_id', null)
      .select();

    console.log('Update result:', updatedEmergency);
    console.log('Update error:', updateEmergencyError);

    if (updateEmergencyError) {
      console.error('🔴 Failed to update emergency:', updateEmergencyError);
      return res.status(500).json({ error: 'Failed to update emergency' });
    }

    if (!updatedEmergency || updatedEmergency.length === 0) {
      console.log('🔴 No rows updated');
      return res.status(400).json({
        error: 'Emergency was just accepted by another unit',
        already_accepted: true
      });
    }

    // 5️⃣ Update dispatch_requests
    const { error: updateDispatchReqError } = await supabase
      .from('dispatch_requests')
      .update({
        status: 'Accepted',
        dispatch_unit_id: unit_id,
        accepted_at: currentTime,
        accepted_by: accepted_by || 'Dispatch Unit',
      })
      .eq('id', requestId);

    if (updateDispatchReqError) {
      console.error('🔴 Failed to update dispatch request, rolling back');
      
      await supabase
        .from('emergencies')
        .update({
          status: 'Reported',
          dispatch_unit_id: null,
          accepted_at: null,
          handled_by: null,
        })
        .eq('id', dispatchReq.emergency_id);
        
      return res.status(500).json({ error: 'Failed to accept request (rollback performed)' });
    }

    console.log('Request accepted successfully');
    res.json({ 
      message: 'Request accepted successfully', 
      accepted: true,
      dispatch_info: dispatchServiceRecord 
    });
    
  } catch (err) {
    console.error('🔴 Accept request error:', err);
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

// Update an emergency request
app.put('/dispatch/requests/:requestId/update', authenticateDispatchUnit, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { unit_id } = req.user;
    const { status, response_notes, assigned_vehicle, estimated_arrival, completed_at } = req.body;

    console.log("🔹 Update emergency request:", { requestId, unit_id, status });

    // Step 1: Get emergency_id from dispatch_requests
    const { data: dispatchReq, error: dispatchError } = await supabase
      .from('dispatch_requests')
      .select('id, emergency_id, dispatch_unit_id, assigned_vehicle')
      .eq('id', requestId)
      .single();

    if (dispatchError || !dispatchReq) {
      return res.status(404).json({ error: 'Dispatch request not found' });
    }

    if (dispatchReq.dispatch_unit_id !== unit_id) {
      return res.status(403).json({ error: 'You can only update requests assigned to your unit' });
    }

    const emergencyId = dispatchReq.emergency_id;
    console.log("➡️ emergencyId to update:", emergencyId);

    // Step 2: Update emergencies table
    const updateData = {
      status,
      response_notes,
      assigned_vehicle,
      estimated_arrival: estimated_arrival || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      completed_at: new Date().toISOString(),
    };

    if (completed_at && status === 'Completed') {
      updateData.completed_at = completed_at;
    }

    const { error: updateError } = await supabase
      .from('emergencies')
      .update(updateData)
      .eq('id', emergencyId);

    if (updateError) {
      console.error("❌ Error updating emergency:", updateError);
      return res.status(500).json({ error: 'Failed to update emergency' });
    }

    console.log("✅ Emergency updated successfully");

    // Step 3: If status is 'Resolved', update dispatch_vehicles table
    if (status.toLowerCase() === 'resolved' && dispatchReq.assigned_vehicle) {
      const { error: vehicleError } = await supabase
        .from('dispatch_vehicles')
        .update({ status: 'Available' })
        .eq('vehicle_id', dispatchReq.assigned_vehicle);

      if (vehicleError) {
        console.error("⚠️ Failed to release vehicle:", vehicleError);
      } else {
        console.log(`✅ Vehicle ${dispatchReq.assigned_vehicle} released`);
      }
    }

    res.json({ message: 'Emergency updated successfully' });

  } catch (err) {
    console.error('🔥 Update emergency error:', err);
    res.status(500).json({ error: 'Failed to update emergency' });
  }
});



// ===============================
// BACKEND API ENDPOINTS (Express.js)
// ===============================

// Add these routes to your Express server

// 1. DISPATCH ENDPOINTS
// ======================

// GET /dispatch/requests/received - Get dispatch requests for logged-in dispatch unit
app.get('/dispatch/requests/received', authenticateDispatchUnit, async (req, res) => {
  try {
    
    const { data, error } = await supabase
      .from('dispatch_requests')
      .select(`
        *,
        emergencies (
          id, type, location, user_id, status, priority
        )
      `)
      .eq('dispatch_unit_id', req.user.unit_id)
      .in('status', ['Pending'])
      .order('requested_at', { ascending: true })

    if (error) throw error
    
    // Format the response
    const formattedRequests = data.map(request => ({
      id: request.id,
      emergency_id: request.emergency_id,
      emergency_type: request.emergency_type,
      location: request.location,
      requester_name: request.requester_name,
      requester_phone: request.requester_phone,
      priority: request.priority,
      assigned_vehicle: request.assigned_vehicle,
      status: request.status,
      requested_at: request.requested_at,
      description: request.description,
      rawData: request
    }))
    
    res.json(formattedRequests)
  } catch (error) {
    console.log(error)
    console.error('Error fetching dispatch requests:', error)
    res.status(500).json({ error: error.message })
  }
})
// GET /dispatch/requests/accepted
app.get('/dispatch/requests/accepted', authenticateDispatchUnit, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('dispatch_requests')
      .select(`
        *,
        emergencies (
          id, type, location, user_id, status, priority, requester_name, requester_phone,assigned_vehicle,estimated_arrival,completed_at
        )
      `)
      .eq('dispatch_unit_id', req.user.unit_id)
      .in('status', ['Accepted','Dispatched'])
      .order('requested_at', { ascending: true });

    if (error) throw error;

    // Update emergencies table with requester_name & requester_phone if missing
    for (const request of data) {
      if (request.requester_name && request.requester_phone) {
        await supabase
          .from('emergencies')
          .update({
            requester_name: request.requester_name,
            requester_phone: request.requester_phone
          })
          .eq('id', request.emergency_id);
      }
    }

    // Format the response
    const formattedRequests = data.map(request => ({
      id: request.id,
      emergency_id: request.emergency_id,
      emergency_type: request.emergency_type,
      location: request.location,
      requester_name: request.requester_name,
      requester_phone: request.requester_phone,
      priority: request.priority,
      assigned_vehicle: request.emergencies?.assigned_vehicle,
      status: request.emergencies?.status,
      requested_at: request.requested_at,
      description: request.description,
      completed_at:request.emergencies?.completed_at,
      rawData: request
    }));

    res.json(formattedRequests);
  } catch (error) {
    console.error('Error fetching dispatch requests:', error);
    res.status(500).json({ error: error.message });
  }
});




// POST /dispatch/requests/:id/accept - Accept a dispatch request
app.post('/dispatch/requests/:id/accept', authenticateDispatchUnit, async (req, res) => {
  try {
    const requestId = req.params.id
    const { accepted_by } = req.body

    // Update the dispatch request
    const { data, error } = await supabase
      .from('dispatch_requests')
      .update({
        status: 'Accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: accepted_by || req.user.officer_name,
      })
      .eq('id', requestId)
      .eq('status', 'Pending') // Only accept if still pending
      .select()

    if (error) throw error

    if (!data || data.length === 0) {
      return res.status(400).json({ error: 'Request not found or already accepted' })
    }

    // Update dispatch unit response count
    await supabase
      .from('dispatch_units')
      .update({
        response_count: req.user.response_count + 1
      })
      .eq('id', req.user.id)

    res.json({ success: true, data: data[0] })
  } catch (error) {
    console.error('Error accepting request:', error)
    res.status(500).json({ error: error.message })
  }
})

// PUT /dispatch/requests/:id/update - Update dispatch request status
app.put('/dispatch/requests/:id/update', authenticateDispatchUnit, async (req, res) => {
  try {
    const requestId = req.params.id
    const { status,  assigned_vehicle } = req.body

    const updateData = {
      assigned_vehicle,
      status    
      
    }

    if (status === 'Completed') {
      updateData.completed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('emergencies')
      .update(updateData)
      .eq('id', requestId)
      .select()

    if (error) throw error

    res.json({ success: true, data: data[0] })
  } catch (error) {
    console.error('Error updating request:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /dispatch/send-message - Send message to admin
app.post('/dispatch/send-message', authenticateDispatchUnit, async (req, res) => {
  try {
    const { emergency_id, message, message_type = 'dispatch_to_admin' } = req.body
    
    if (!emergency_id || !message) {
      return res.status(400).json({ error: 'Emergency ID and message are required' })
    }

    console.log("🔹 Incoming send-message request:", { emergency_id, message, unit: req.user.unit_id })

    // 1. Fetch admin_id from emergencies table
    const { data: emergency, error: fetchError } = await supabase
      .from('emergencies')
      .select('admin_id')
      .eq('id', emergency_id)
      .single()

    if (fetchError || !emergency) {
      console.error("⚠️ Could not fetch emergency:", fetchError)
      return res.status(404).json({ error: 'Emergency not found' })
    }

    console.log("✅ Found admin_id:", emergency.admin_id)

    // 2. Insert message including admin_id
    const { data, error } = await supabase
      .from('dispatch_messages')
      .insert({
        emergency_id,
        dispatch_unit_id: req.user.unit_id,
        admin_id: emergency.admin_id,   // <-- added here
        message: message.trim(),
        message_type,
        sent_by: req.user.officer_in_charge,
        sent_at: new Date().toISOString(),
      })
      .select()

    if (error) {
      console.error("❌ Insert message error:", error)
      throw error
    }
    
    res.json({ success: true, data: data[0] })
  } catch (error) {
    console.error('Error sending message:', error)
    res.status(500).json({ error: error.message })
  }
})


// GET /dispatch/requests/stats - Get request statistics
app.get('/dispatch/requests/stats', authenticateDispatchUnit, async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get pending requests count
    const { count: pending } = await supabase
      .from('dispatch_requests')
      .select('*', { count: 'exact', head: true })
      .eq('dispatch_unit_id', req.user.unit_id)
      .eq('status', 'Pending')

    // Get accepted requests count
    const { count: accepted } = await supabase
      .from('dispatch_requests')
      .select('*', { count: 'exact', head: true })
      .eq('dispatch_unit_id', req.user.id)
      .in('status', ['Accepted', 'En Route', 'On Scene'])

    // Get completed today count
    const { count: completed_today } = await supabase
      .from('dispatch_requests')
      .select('*', { count: 'exact', head: true })
      .eq('dispatch_unit_id', req.user.unit_id)
      .eq('status', 'Completed')
      .gte('completed_at', today.toISOString())

    res.json({
      pending: pending || 0,
      accepted: accepted || 0,
      completed_today: completed_today || 0
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({ error: error.message })
  }
})

// 2. ADMIN ENDPOINTS
// ==================

// GET /admin/messages - Get messages from dispatch units
// GET /admin/messages - Fetch messages sent to admin
app.get('/admin/messages', authenticateAdmin, async (req, res) => {
  try {
    console.log("🔹 [ADMIN] Fetching messages for admin:", req.user?.admin_id)

    const { data, error } = await supabase
      .from('dispatch_messages')
      .select(`
        *,
        emergencies (id, type, location, user_id),
        dispatch_units (unit_type, officer_in_charge, department_name)
      `)
      .eq('message_type', 'dispatch_to_admin')
      .order('sent_at', { ascending: false })
      .limit(50) // Limit to recent 50 messages

    if (error) {
      console.error("❌ [ADMIN] Supabase query error:", error)
      throw error
    }

    console.log(`✅ [ADMIN] Retrieved ${data?.length || 0} messages`)
    if (data && data.length > 0) {
      console.log("📌 Sample message:", JSON.stringify(data[0], null, 2))
    }

    res.json(data)
  } catch (error) {
    console.error('🔥 [ADMIN] Error fetching messages:', error)
    res.status(500).json({ error: error.message })
  }
})


// PUT /admin/messages/:id/read - Mark message as read
app.put('/admin/messages/:id/read', authenticateAdmin, async (req, res) => {
  try {
    const messageId = req.params.id

    const { data, error } = await supabase
      .from('dispatch_messages')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .select()

    if (error) throw error
    res.json({ success: true, data: data[0] })
  } catch (error) {
    console.error('Error marking message as read:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /admin/send-message - Send message to dispatch unit
app.post('/admin/send-message', authenticateAdmin, async (req, res) => {
  try {
    const { emergency_id, dispatch_unit_id, message } = req.body
    
    if (!emergency_id || !dispatch_unit_id || !message) {
      return res.status(400).json({ error: 'All fields are required' })
    }

    const { data, error } = await supabase
      .from('dispatch_messages')
      .insert({
        emergency_id,
        dispatch_unit_id,
        admin_id: req.user.id,
        message: message.trim(),
        message_type: 'admin_to_dispatch',
        sent_by: `${req.user.first_name} ${req.user.last_name}`,
        sent_at: new Date().toISOString(),
      })
      .select()

    if (error) throw error
    res.json({ success: true, data: data[0] })
  } catch (error) {
    console.error('Error sending message:', error)
    res.status(500).json({ error: error.message })
  }
})

// 3. USER ENDPOINTS (for tracking)
// ================================

// GET /user/emergency-tracking - Get emergency tracking info for user
app.get('/user/emergency-tracking', authenticateUserToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('emergency_tracking')
      .select('*')
      .eq('user_id', req.user.id)
      .order('reported_time', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Error fetching emergency tracking:', error)
    res.status(500).json({ error: error.message })
  }
})

// 4. MIDDLEWARE FUNCTIONS
// =======================

// Authentication middleware for dispatch tokens
function authenticateDispatchUnit(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    // Verify and decode the dispatch token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    if (decoded.type !== 'dispatch') {
      return res.status(403).json({ error: 'Invalid token type' })
    }
    
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// Authentication middleware for admin tokens
function authenticateAdminToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    if (decoded.type !== 'admin') {
      return res.status(403).json({ error: 'Invalid token type' })
    }
    
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// Authentication middleware for user tokens
function authenticateUserToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    if (decoded.type !== 'user') {
      return res.status(403).json({ error: 'Invalid token type' })
    }
    
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// 5. WEBHOOK FOR REAL-TIME UPDATES (Optional)
// ===========================================

// POST /webhook/emergency-update - Handle emergency status updates
app.post('/webhook/emergency-update', async (req, res) => {
  try {
    const { emergency_id, status, dispatch_unit_id, vehicle_id } = req.body
    
    // Update emergency status
    const { error } = await supabase
      .from('emergencies')
      .update({
        status,
        assigned_vehicle: vehicle_id,
        dispatch_unit_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', emergency_id)

    if (error) throw error
    
    // You could add WebSocket broadcasting here for real-time updates
    // io.emit('emergency_update', { emergency_id, status, vehicle_id })
    
    res.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(500).json({ error: error.message })
  }
})