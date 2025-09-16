import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient' // Adjust import path as needed
import './Dashboard.css'

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [userRole, setUserRole] = useState('user')
  const [loggedInUser, setLoggedInUser] = useState(null)
  const [emergencies, setEmergencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  // ✅ Fetch user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser)
      setLoggedInUser(parsedUser)
      setUserRole(parsedUser.role || 'user') // Set role based on user data
    } else {
      navigate('/profile') // redirect if no user
    }
  }, [navigate])

  // ✅ Fetch emergencies from Supabase
  useEffect(() => {
    const fetchEmergencies = async () => {
      if (!loggedInUser?.id) return

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('emergencies')
          .select('*')
          .eq('user_id', loggedInUser.id)
          .order('reported_time', { ascending: false })

        if (error) throw error

        setEmergencies(data || [])
      } catch (err) {
        console.error('Error fetching emergencies:', err)
        setError('Failed to load emergency data')
      } finally {
        setLoading(false)
      }
    }

    fetchEmergencies()
  }, [loggedInUser])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleEmergencyClick = () => navigate('/')
  const handleProfile = () => navigate('/profile')
  const handleSettings = () => navigate('/settings')
  const handleLocation = () => navigate('/location')

  // Filter active emergencies (those not resolved or closed)
  const activeEmergencies = emergencies.filter(emergency => 
    emergency.status !== 'Resolved' && emergency.status !== 'Closed'
  )

  // Helper function to format time
  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffTime = Math.abs(now - date)
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  // Helper function to format ETA
  const formatETA = (eta) => {
    if (!eta) return 'Not available'
    
    // Parse PostgreSQL interval format (e.g., "00:05:00" for 5 minutes)
    const match = eta.match(/(\d{2}):(\d{2}):(\d{2})/)
    if (match) {
      const [, hours, minutes, seconds] = match
      if (hours !== '00') return `${parseInt(hours)}h ${parseInt(minutes)}m`
      if (minutes !== '00') return `${parseInt(minutes)} mins`
      return `${parseInt(seconds)} secs`
    }
    return eta
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'reported':
        return 'status-active'
      case 'dispatched':
        return 'status-responding'
      case 'in progress':
        return 'status-responding'
      case 'resolved':
      case 'closed':
        return 'status-resolved'
      default:
        return 'status-default'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical':
        return 'priority-critical'
      case 'high':
        return 'priority-high'
      case 'medium':
        return 'priority-medium'
      case 'low':
        return 'priority-low'
      default:
        return 'priority-default'
    }
  }

  const getEmergencyIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'medical':
        return '❤️'
      case 'fire':
        return '🔥'
      case 'accident':
        return '🚗'
      case 'crime':
        return '🚨'
      default:
        return '⚠️'
    }
  }

  const getArrivalStatus = (status, resolvedTime) => {
    switch (status) {
      case 'Resolved':
      case 'Closed':
        return resolvedTime ? 'Completed' : 'Resolved'
      case 'In Progress':
        return 'On Scene'
      case 'Dispatched':
        return 'En Route'
      case 'Reported':
        return 'Pending'
      default:
        return 'Unknown'
    }
  }

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-container">
          <h2>Loading your emergency data...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      {/* HEADER */}
      <header className="header">
        <div className="container user-header-content">
          <div className="logo-section">
            <div className="logo">
              <span className="shield-icon">🛡️</span>
            </div>
            <div className="logo-text">
              <h1>User Emergency Dashboard</h1>
              <p>Personalized Emergency Updates</p>
            </div>
          </div>

          <div className="header-info">
            <div className="user-info">
              <span className="welcome-text">
                Welcome, {loggedInUser?.name || 'Guest'}
              </span>
              <span
                className={`role-badge ${
                  userRole === 'user' ? 'user-role' : 'admin-role'
                }`}
              >
                {userRole}
              </span>
            </div>
            <div className="time-display">
              <span className="time">{currentTime.toLocaleTimeString()}</span>
              <span className="date">{currentTime.toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </header>

      {/* NAVIGATION */}
      <nav className="user-navigation">
        <div className="container nav-links">
          <button className="nav-link" onClick={handleEmergencyClick}>
            Emergency
          </button>
          <button className="nav-link" onClick={handleProfile}>
            Profile
          </button>
          <button className="nav-link" onClick={handleLocation}>
            Location
          </button>
          <button className="nav-link active">Dashboard</button>
          
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <div className="container">
          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}

          {/* Active Emergencies */}
          <section className="emergencies-section">
            <div className="section-header">
              <h3>Your Active Emergencies</h3>
              <span className="status-indicator">Tracking Dispatch</span>
            </div>
            <div className="emergency-cards">
              {activeEmergencies.length > 0 ? (
                activeEmergencies.map((emergency) => (
                  <div key={emergency.id} className="emergency-card">
                    <div className="emergency-header">
                      <div className="emergency-type">
                        <span>{getEmergencyIcon(emergency.type)}</span>
                        <span className="type-text">{emergency.type}</span>
                      </div>
                      <span className={`status-badge ${getStatusColor(emergency.status)}`}>
                        {emergency.status}
                      </span>
                    </div>
                    <div className="emergency-details">
                      <p>📍 Location: {emergency.location}</p>
                      <p>⏰ Reported: {formatTime(emergency.reported_time)}</p>
                      <p>
                        ⚠️ Priority:{' '}
                        <span className={`priority-badge ${getPriorityColor(emergency.priority)}`}>
                          {emergency.priority}
                        </span>
                      </p>
                      <p>🚑 Dispatch: {emergency.dispatched_unit || 'Not assigned'}</p>
                      <p>⏳ ETA: {formatETA(emergency.eta)}</p>
                      <p>✅ Arrival: {getArrivalStatus(emergency.status, emergency.resolved_time)}</p>
                    </div>
                    <div className="emergency-actions">
                      <button className="emergency-btn">Track Unit</button>
                      <button className="emergency-btn secondary">
                        View Updates
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-emergencies">
                  <span className="safe-icon">✅</span>
                  <h4>No Active Emergencies</h4>
                  <p>You haven't reported any current emergencies</p>
                </div>
              )}
            </div>
          </section>

          {/* Emergency History */}
          <section className="history-section">
            <div className="section-header">
              <h3>Emergency History</h3>
              <span className="status-indicator">Past Reports</span>
            </div>
            <div className="history-table">
              <div className="table-header">
                <div>Type</div>
                <div>Location</div>
                <div>Reported</div>
                <div>Status</div>
                <div>Dispatch</div>
                <div>Arrival</div>
              </div>
              {emergencies.map((emergency) => (
                <div key={emergency.id} className="table-row">
                  <div>{emergency.type}</div>
                  <div>{emergency.location}</div>
                  <div>{formatTime(emergency.reported_time)}</div>
                  <div>
                    <span className={`status-badge ${getStatusColor(emergency.status)}`}>
                      {emergency.status}
                    </span>
                  </div>
                  <div>{emergency.dispatched_unit || 'Not assigned'}</div>
                  <div>{getArrivalStatus(emergency.status, emergency.resolved_time)}</div>
                </div>
              ))}
              {emergencies.length === 0 && (
                <div className="table-row">
                  <div colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                    No emergency reports found
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Safety Tips */}
          <section className="safety-section">
            <h3>Safety Information</h3>
            <div className="safety-grid">
              <div className="safety-card">
                <span className="safety-icon">📞</span>
                <h4>Emergency Contacts</h4>
                <p>Police: 911 | Fire: 911 | Medical: 911</p>
              </div>
              <div className="safety-card">
                <span className="safety-icon">📍</span>
                <h4>Evacuation Routes</h4>
                <p>Know your nearest exits and meeting points</p>
              </div>
              <div className="safety-card">
                <span className="safety-icon">🎒</span>
                <h4>Emergency Kit</h4>
                <p>Keep supplies ready: water, food, flashlight</p>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container footer-content">
          <p>© {new Date().getFullYear()} Emergency Response System</p>
          <p className="footer-subtitle">
            Last Updated: {currentTime.toLocaleString()}
          </p>
        </div>
      </footer>
    </div>
  )
}