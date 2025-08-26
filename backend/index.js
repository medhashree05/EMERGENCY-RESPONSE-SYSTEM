// backend/index.js
const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const bcrypt = require('bcryptjs')
const twilio = require('twilio')
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')
const jwt = require('jsonwebtoken')
const Groq = require('groq-sdk')   // 👈 Import Groq SDK

dotenv.config()
const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 8000

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

// --------------------
// Routes
// --------------------

// existing OTP, verify, login routes ...

// 6️⃣ Chat route with Groq
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body
    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    // Send to Groq
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a helpful assistant for emergencies and general queries.' },
        { role: 'user', content: message }
      ],
      model: 'llama-3.1-8b-instant', // fast and good for chat
    })

    const reply = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.'

    res.json({ reply })
  } catch (err) {
    console.error('Groq chat error:', err)
    res.status(500).json({ error: 'Failed to get response from Groq' })
  }
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
    console.log(otpStore);

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
    console.log(req.phone,req.otp);
    const record = otpStore[phone]

    if (!record)
      return res.status(400).json({ error: 'OTP not requested or expired'})
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
      { expiresIn: '7d' }
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

// 4️⃣ Protected route example
app.get('/protected', authenticateToken, (req, res) => {
  res.json({
    message: 'You have access to this protected route',
    user: req.user,
  })
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

// --------------------
// Profile routes
// --------------------
app.get('/profile/me', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.user;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user_id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Decrypt medical conditions before sending to frontend
    const decryptedMedical = decrypt(data.medical_conditions);

    res.json({
      ...data,
      medical_conditions: decryptedMedical,
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.put('/profile/me', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.user;
    const updatedData = { ...req.body };

    // Encrypt medical_conditions before saving
    if (updatedData.medical_conditions) {
      updatedData.medical_conditions = encrypt(updatedData.medical_conditions);
    }

    const { error } = await supabase
      .from('users')
      .update(updatedData)
      .eq('id', user_id);

    if (error) {
      return res.status(400).json({ error: 'Failed to update profile' });
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Increment emergency calls for current user
app.post("/emergency/call", authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.user;

    // Fetch current count
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("emergency_calls")
      .eq("id", user_id)
      .single();

    if (fetchError) throw fetchError;

    const newCount = (user?.emergency_calls || 0) + 1;

    // Update with incremented value
    const { data, error } = await supabase
      .from("users")
      .update({ emergency_calls: newCount })
      .eq("id", user_id)
      .select("emergency_calls")
      .single();

    if (error) throw error;

    res.json({ success: true, emergency_calls: data.emergency_calls });
  } catch (err) {
    console.error("Emergency call error:", err);
    res.status(500).json({ error: "Failed to update emergency call count" });
  }
});

// Update user location
app.post("/update_location", authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.user; // comes from JWT payload
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: "Latitude and longitude are required" });
    }

    const { data, error } = await supabase
      .from("users")
      .update({ latitude, longitude })
      .eq("id", user_id)
      .select("id, latitude, longitude")
      .single();

    if (error) throw error;

    res.json({ success: true, user: data });
  } catch (err) {
    console.error("Update location error:", err);
    res.status(500).json({ error: "Failed to update location" });
  }
});





app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
)
