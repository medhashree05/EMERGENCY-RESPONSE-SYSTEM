# 911 Emergency Response System

## Overview

The 911 Emergency Response System is a full-stack emergency assistance platform designed to provide faster and more reliable emergency communication workflows. The system enables users to raise emergency alerts, share live location information, communicate through voice/audio, and receive AI-assisted emergency guidance.

The platform integrates real-time alert management, geolocation-based tracking, Twilio-powered SMS/call notifications, AI-assisted emergency support, and voice transcription workflows into a single coordinated system.

---

# Features

## Emergency Alert Management
- Raise emergency alerts instantly
- Track active emergency requests
- Manage alert lifecycle and status updates
- Dispatcher/admin monitoring workflows

## Real-Time Assistance
- Live emergency alert tracking
- Geolocation-based response coordination
- Nearby emergency service assistance

## AI-Powered Emergency Guidance
- AI-assisted emergency support using Groq APIs
- Conversational emergency help assistant
- Context-aware emergency recommendations
- Session-based chat continuity

## Voice Transcription
- Audio recording upload support
- Speech-to-text transcription using Whisper APIs
- Emergency voice communication workflows

## Authentication & Security
- JWT-based authentication
- Protected backend APIs
- Secure session management
- Environment variable-based secret management

## Notification System
- Twilio-powered SMS notifications
- Emergency call workflows
- Alert broadcasting support

---

# Tech Stack

## Frontend
- React.js
- JavaScript
- CSS

## Backend
- Node.js
- Express.js

## Database & Authentication
- Supabase
- PostgreSQL

## APIs & Services
- Twilio API
- Groq API
- Whisper Speech-to-Text

## Testing
- Jest

---

# System Architecture

```text
React Frontend
      ↓
Express Backend APIs
      ↓
Supabase Database & Authentication
      ↓
Twilio / Groq / Geolocation Services
```

---

# Emergency Alert Workflow

```text
User raises emergency alert
        ↓
Frontend captures geolocation
        ↓
Backend validates request
        ↓
Emergency stored in database
        ↓
Twilio notifications triggered
        ↓
Dispatcher/admin dashboard updated
```

---

# Voice Transcription Workflow

```text
User uploads audio
        ↓
Multer processes multipart upload
        ↓
Temporary file storage
        ↓
Audio sent to Whisper API
        ↓
Transcribed text returned
        ↓
Temporary files cleaned up
```

---

# AI Assistant Workflow

```text
User sends emergency query
        ↓
Backend manages session context
        ↓
Groq LLM generates response
        ↓
Nearby service recommendations fetched
        ↓
Response returned to frontend
```

---

# Security Features

- JWT authentication
- Protected API routes
- Environment variable-based secret management
- Sensitive data encryption
- File upload validation
- Backend-side authorization checks

---

# Key Engineering Challenges Solved

## Handling Asynchronous Workflows
The project involved coordinating multiple asynchronous services such as:
- Twilio notifications
- Audio uploads
- AI inference
- Database operations
- Transcription workflows

This required careful handling of:
- async/await
- timeout management
- retries
- failure handling
- request synchronization

## Dynamic File Upload Handling
Implemented secure multipart audio uploads using multer with:
- MIME validation
- file-size restrictions
- temporary storage
- cleanup jobs

## Reliability & Stability
Added:
- timeout protection
- graceful error handling
- retry-aware workflows
- cleanup mechanisms
- secure authentication middleware

---

# Installation

## Clone Repository

```bash
git clone <repo-url>
cd emergency-response-system
```

## Install Dependencies

### Frontend

```bash
cd frontend
npm install
```

### Backend

```bash
cd backend
npm install
```

---

# Environment Variables

Create a `.env` file inside backend:

```env
SUPABASE_URL=
SUPABASE_KEY=
JWT_SECRET=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
GROQ_API_KEY=
```

---

# Run Application

## Backend

```bash
npm start
```

## Frontend

```bash
npm run dev
```

---

# Possible Future Improvements

- WebSocket-based live emergency updates
- Queue-based notification processing
- AI-based emergency severity classification
- Multilingual emergency assistance
- Offline SMS fallback support
- Responder route optimization
- Docker/Kubernetes deployment
- Monitoring dashboards

---

# Project Highlights

- Real-world emergency response use case
- AI + full-stack integration
- Voice transcription workflows
- Geolocation-aware assistance
- Twilio communication system
- Secure backend architecture
- Real-time operational workflows
