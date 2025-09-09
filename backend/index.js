// backend/index.js
const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const bcrypt = require('bcryptjs')
const twilio = require('twilio')
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')
const jwt = require('jsonwebtoken')
const Groq = require('groq-sdk') // 👈 Import Groq SDK
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

// Replace the simple upload configuration
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadsDir = path.join(__dirname, 'uploads')
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
      }
      cb(null, uploadsDir)
    },
    filename: (req, file, cb) => {
      // Generate unique filename with proper extension
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
      const ext = path.extname(file.originalname) || '.webm'
      cb(null, `audio-${uniqueSuffix}${ext}`)
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/webm',
      'audio/wav',
      'audio/mp3',
      'audio/mp4',
      'audio/mpeg',
      'audio/ogg',
      'audio/opus',
    ]

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`), false)
    }
  },
})

// --------------------
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
        }
      ],
      createdAt: new Date(),
      lastActivity: new Date()
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

// Enhanced chat endpoint
// Enhanced chat endpoint with location integration
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
    if (session.messages.length > 21) { // +1 for system message
      session.messages = [
        session.messages[0], // Keep system message
        ...session.messages.slice(-20) // Keep last 20 user/assistant messages
      ]
    }

    // Check for location-related requests
    const locationKeywords = [
      'location', 'coordinates', 'where am i', 'my location', 'track me',
      'store my location', 'update location', 'save location', 'gps',
      'latitude', 'longitude', 'position', 'address'
    ]
    
    const isLocationRequest = locationKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    )

    // Enhanced system message for location requests
    let systemMessage = session.messages[0].content
    if (isLocationRequest) {
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
      ...session.messages.slice(1)
    ]

    // Send conversation to Groq
    const completion = await groq.chat.completions.create({
      messages: messagesForAPI,
      model: 'llama-3.1-8b-instant',
      max_tokens: 500,
      temperature: 0.7
    })

    let reply = completion.choices[0]?.message?.content || 
      'Sorry, I could not generate a response.'

    // If location request detected and user is authenticated
    if (isLocationRequest && token) {
      try {
        // Verify user token
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const userId = decoded.id

        // Check if message contains coordinates
        const coordinatePattern = /(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/
        const coordinateMatch = message.match(coordinatePattern)
        
        if (coordinateMatch) {
          const [, latitude, longitude] = coordinateMatch
          
          // Store coordinates in user table
          await supabase.from('users').update({ latitude, longitude, location_updated_at: new Date().toISOString() }).eq('id', userId)
          
          reply += '\n\n✅ Your location coordinates have been saved to your profile for emergency services.'
        } else {
          // Add instructions for location sharing
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
    
    res.json({ 
      reply,
      sessionId: currentSessionId,
      messageCount: session.messages.length - 1,
      locationDetected: isLocationRequest
    })

  } catch (err) {
    console.error('Chat error:', err)
    res.status(500).json({ error: 'Failed to get response' })
  }
})

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
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=IN&limit=1`
        )
        const geocodeData = await geocodeResponse.json()
        
        if (geocodeData && geocodeData.length > 0) {
          lat = parseFloat(geocodeData[0].lat)
          lng = parseFloat(geocodeData[0].lon)
        } else {
          return res.status(400).json({ error: 'Could not find coordinates for this address' })
        }
      } catch (geocodeError) {
        return res.status(400).json({ error: 'Geocoding failed' })
      }
    }

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' })
    }

    // Update user location
    await supabase.from('users').update({ latitude, longitude, location_updated_at: new Date().toISOString() }).eq('id', userId)

    res.json({
      success: true,
      message: 'Location stored successfully',
      coordinates: { latitude: lat, longitude: lng }
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
          longitude: parseFloat(data[0].lon)
        }
      }
    } catch (error) {
      console.log('Pincode geocoding failed, trying full address')
    }
  }
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=IN&limit=1`
    )
    const data = await response.json()
    
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon)
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
    lastActivity: session.lastActivity
  })
})

// Optional: Clear session endpoint
app.delete('/chat/session/:sessionId', (req, res) => {
  const { sessionId } = req.params
  const deleted = chatSessions.delete(sessionId)
  
  res.json({ 
    success: deleted,
    message: deleted ? 'Session cleared' : 'Session not found'
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

// Add this route to your backend (e.g., in routes/emergency.js or app.js)

// Add this route to your backend (e.g., in routes/emergency.js or app.js)

// Add this route to your backend (e.g., in routes/emergency.js or app.js)

app.post('/emergency/create', authenticateToken, async (req, res) => {
  try {
    const { type, location, priority = 'Critical' } = req.body;
    const userId = req.user?.id || req.user?.user_id; // Try both possible fields from JWT token

    console.log('JWT User object:', req.user); // Debug log
    console.log('User ID extracted:', userId); // Debug log

    // Validate required fields
    if (!type || !location) {
      return res.status(400).json({ 
        error: 'Type and location are required' 
      });
    }

    // Validate user ID
    if (!userId) {
      console.error('No user ID found in JWT token');
      return res.status(401).json({ 
        error: 'User ID not found in token' 
      });
    }

    // Insert emergency into database using Supabase
    const { data: emergency, error } = await supabase
      .from('emergencies')
      .insert([
        {
          user_id: userId,
          type: type,
          location: location,
          priority: priority,
          status: 'Reported'
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Failed to create emergency report',
        details: error.message 
      });
    }

    res.json({
      success: true,
      message: 'Emergency reported successfully',
      emergency: {
        id: emergency.id,
        type: emergency.type,
        location: emergency.location,
        priority: emergency.priority,
        status: emergency.status,
        reported_time: emergency.reported_time
      }
    });

  } catch (error) {
    console.error('Error creating emergency:', error);
    res.status(500).json({ 
      error: 'Failed to create emergency report' 
    });
  }
});

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

app.post('/transcribe', upload.single('file'), async (req, res) => {
  let filePath = null

  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: 'No audio file received' })
    }

    filePath = req.file.path // ✅ Now this exists because we use diskStorage

    console.log('Processing audio file:', {
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: filePath,
    })

    // ✅ Check if file actually exists
    if (!fs.existsSync(filePath)) {
      throw new Error('Uploaded file not found on disk')
    }

    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-large-v3',
    })

    // ✅ Clean up the temporary file
    fs.unlinkSync(filePath)

    console.log(
      'Transcription successful:',
      transcription.text?.substring(0, 100) + '...'
    )

    res.json({
      success: true,
      text: transcription.text,
    })
  } catch (err) {
    console.error('Error transcribing audio:', err.message)

    // ✅ Clean up file even if transcription fails
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
      } catch (cleanupErr) {
        console.error('Error cleaning up file:', cleanupErr.message)
      }
    }

    // ✅ Return more specific error messages
    let errorMessage = 'Failed to transcribe audio'
    if (err.message.includes('Unsupported audio format')) {
      errorMessage = 'Audio format not supported. Please try again.'
    } else if (err.message.includes('File too large')) {
      errorMessage = 'Audio file is too large. Please record a shorter message.'
    }

    res.status(500).json({ success: false, error: errorMessage })
  }
})

app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
)
