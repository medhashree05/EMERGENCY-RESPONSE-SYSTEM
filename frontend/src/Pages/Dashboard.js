import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient' 
import './Dashboard.css'
import { useEmergencyLocationTracker } from '../hooks/useEmergencyLocationTracker'

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [userRole, setUserRole] = useState('user')
  const [loggedInUser, setLoggedInUser] = useState(null)
  const [emergencies, setEmergencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showTrackPopup, setShowTrackPopup] = useState(false)
  const [showUpdatesPopup, setShowUpdatesPopup] = useState(false)
  const [selectedEmergency, setSelectedEmergency] = useState(null)
   const token = localStorage.getItem('token')
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
          .select(`
            *,
            dispatch_units!emergencies_dispatch_unit_id_fkey (
              unit_type,
              department_name,
              contact_number
            )
          `)
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

    // Set up real-time subscription for emergency updates
    const emergencySubscription = supabase
      .channel('emergency_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'emergencies',
          filter: `user_id=eq.${loggedInUser?.id}`
        },
        (payload) => {
          console.log('Emergency updated:', payload)
          fetchEmergencies() // Refresh emergency data
        }
      )
      .subscribe()

    return () => {
      emergencySubscription.unsubscribe()
    }
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
    emergency.status !== 'Resolved' && emergency.status !== 'resolved'
  )
const activeEmergencyId = activeEmergencies[0]?.id || null
const hasActiveEmergency = activeEmergencies.length > 0
  const { isTracking, lastUpdate, error: trackingError } = useEmergencyLocationTracker(
    activeEmergencyId,
    token,
    hasActiveEmergency
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
      case 'responding':
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
      case 'resolved':
        return 'Completed'
      case 'Accepted':
        return 'On Scene'
      case 'Responding':
        return 'En Route'
      case 'Reported':
        return 'Pending'
      default:
        return 'Unknown'
    }
  }

  const handleTrackUnit = (emergency) => {
    setSelectedEmergency(emergency)
    setShowTrackPopup(true)
  }

  const handleViewUpdates = (emergency) => {
    setSelectedEmergency(emergency)
    setShowUpdatesPopup(true)
  }

  const closePopups = () => {
    setShowTrackPopup(false)
    setShowUpdatesPopup(false)
    setSelectedEmergency(null)
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
              <span className={`role-badge ${userRole === 'user' ? 'user-role' : 'admin-role'}`}>
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
              <div className="tracking-status">
      {isTracking ? (
        <span className="status-indicator tracking">
          📍 Location Tracking Active
        </span>
      ) : hasActiveEmergency ? (
        <span className="status-indicator warning">
          ⚠️ Location Tracking Disabled
        </span>
      ) : (
        <span className="status-indicator">No Active Emergencies</span>
      )}
    </div>
            </div>
            {trackingError && (
    <div className="tracking-error">
      ⚠️ {trackingError}
    </div>
  )}
  
  {lastUpdate && (
    <div className="tracking-info">
      Last location update: {lastUpdate.timestamp.toLocaleTimeString()}
    </div>
  )}

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
                      {emergency.assigned_vehicle && (
                        <p>🚑 Assigned Vehicle: {emergency.assigned_vehicle}</p>
                      )}
                      {emergency.dispatch_units && (
                        <p>🏢 Dispatch Unit: {emergency.dispatch_units.service_name || emergency.dispatch_units.unit_type || 'Assigned'}</p>
                      )}
                      {emergency.dispatch_units?.phone && (
                        <p>📞 Unit Contact: {emergency.dispatch_units.phone}</p>
                      )}
                      <p>✅ Status: {getArrivalStatus(emergency.status, emergency.resolved_time)}</p>
                      {emergency.estimated_arrival && (
                        <p>⏳ Estimated Arrival: {new Date(emergency.estimated_arrival).toLocaleString()}</p>
                      )}
                    </div>

                    <div className="emergency-actions">
                      <button className="emergency-btn" onClick={() => handleTrackUnit(emergency)}>
                        Track Unit
                      </button>
                      <button className="emergency-btn secondary" onClick={() => handleViewUpdates(emergency)}>
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
                  <div>{emergency.dispatch_units?.service_name || emergency.dispatch_units?.unit_type || 'Not assigned'}</div>
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

      {/* Track Unit Popup */}
      {showTrackPopup && selectedEmergency && (
        <div className="popup-overlay" onClick={closePopups}>
          <div className="popup-content" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3>🚑 Track Dispatch Unit</h3>
              <button className="popup-close" onClick={closePopups}>✕</button>
            </div>

            <div className="popup-body">
              <div className="track-info">
                <div className="track-section">
                  <h4>Emergency Details</h4>
                  <div className="info-row">
                    <span className="info-label">Type:</span>
                    <span className="info-value">{selectedEmergency.type}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Location:</span>
                    <span className="info-value">{selectedEmergency.location}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Priority:</span>
                    <span className={`priority-badge ${getPriorityColor(selectedEmergency.priority)}`}>
                      {selectedEmergency.priority}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Status:</span>
                    <span className={`status-badge ${getStatusColor(selectedEmergency.status)}`}>
                      {selectedEmergency.status}
                    </span>
                  </div>
                </div>

                <div className="track-section">
                  <h4>Dispatch Unit Information</h4>
                  {selectedEmergency.dispatch_units ? (
                    <>
                      <div className="info-row">
                        <span className="info-label">Unit Type:</span>
                        <span className="info-value">{selectedEmergency.dispatch_units.service_type || selectedEmergency.dispatch_units.unit_type || 'N/A'}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Department:</span>
                        <span className="info-value">{selectedEmergency.dispatch_units.service_name || selectedEmergency.dispatch_units.department_name || 'N/A'}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Contact:</span>
                        <span className="info-value">{selectedEmergency.dispatch_units.phone || selectedEmergency.dispatch_units.contact_number || 'N/A'}</span>
                      </div>
                    </>
                  ) : (
                    <p className="no-data">No dispatch unit assigned yet</p>
                  )}
                  {selectedEmergency.assigned_vehicle && (
                    <div className="info-row">
                      <span className="info-label">Vehicle:</span>
                      <span className="info-value">{selectedEmergency.assigned_vehicle}</span>
                    </div>
                  )}
                </div>

                <div className="track-section">
                  <h4>Estimated Arrival</h4>
                  {selectedEmergency.estimated_arrival ? (
                    <div className="eta-display">
                      <span className="eta-icon">⏰</span>
                      <span className="eta-time">
                        {new Date(selectedEmergency.estimated_arrival).toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    <p className="no-data">ETA not available</p>
                  )}
                </div>

                <div className="track-section">
                  <h4>Timeline</h4>
                  <div className="timeline">
                    <div className="timeline-item completed">
                      <div className="timeline-marker">✓</div>
                      <div className="timeline-content">
                        <div className="timeline-title">Emergency Reported</div>
                        <div className="timeline-time">{formatTime(selectedEmergency.reported_time)}</div>
                      </div>
                    </div>

                    {selectedEmergency.accepted_at && (
                      <div className="timeline-item completed">
                        <div className="timeline-marker">✓</div>
                        <div className="timeline-content">
                          <div className="timeline-title">Unit Accepted</div>
                          <div className="timeline-time">{formatTime(selectedEmergency.accepted_at)}</div>
                        </div>
                      </div>
                    )}

                    {selectedEmergency.status === 'Responding' && (
                      <div className="timeline-item active">
                        <div className="timeline-marker">●</div>
                        <div className="timeline-content">
                          <div className="timeline-title">Unit En Route</div>
                          <div className="timeline-time">In Progress</div>
                        </div>
                      </div>
                    )}

                    {selectedEmergency.resolved_at && (
                      <div className="timeline-item completed">
                        <div className="timeline-marker">✓</div>
                        <div className="timeline-content">
                          <div className="timeline-title">Emergency Resolved</div>
                          <div className="timeline-time">{formatTime(selectedEmergency.resolved_at)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Updates Popup */}
      {showUpdatesPopup && selectedEmergency && (
        <div className="popup-overlay" onClick={closePopups}>
          <div className="popup-content" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3>📋 Emergency Updates</h3>
              <button className="popup-close" onClick={closePopups}>✕</button>
            </div>

            <div className="popup-body">
              <div className="updates-info">
                <div className="update-section">
                  <h4>Current Status</h4>
                  <div className="status-display">
                    <span className={`status-badge large ${getStatusColor(selectedEmergency.status)}`}>
                      {selectedEmergency.status}
                    </span>
                   
                  </div>
                </div>

                <div className="update-section">
                  <h4>Emergency Information</h4>
                  <div className="info-grid">
                    <div className="info-card">
                      <span className="info-icon">🚨</span>
                      <div className="info-details">
                        <span className="info-label">Type</span>
                        <span className="info-value">{selectedEmergency.type}</span>
                      </div>
                    </div>
                    <div className="info-card">
                      <span className="info-icon">📍</span>
                      <div className="info-details">
                        <span className="info-label">Location</span>
                        <span className="info-value">{selectedEmergency.location}</span>
                      </div>
                    </div>
                    <div className="info-card">
                      <span className="info-icon">⚠️</span>
                      <div className="info-details">
                        <span className="info-label">Priority</span>
                        <span className={`priority-badge ${getPriorityColor(selectedEmergency.priority)}`}>
                          {selectedEmergency.priority}
                        </span>
                      </div>
                    </div>
                    <div className="info-card">
                      <span className="info-icon">⏰</span>
                      <div className="info-details">
                        <span className="info-label">Reported</span>
                        <span className="info-value">{formatTime(selectedEmergency.reported_time)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="update-section">
                  <h4>Response Team</h4>
                  {selectedEmergency.dispatch_units ? (
                    <div className="team-info">
                      <div className="team-detail">
                        <span className="team-icon">🚑</span>
                        <div>
                          <div className="team-label">Unit Type</div>
                          <div className="team-value">{selectedEmergency.dispatch_units.service_type || selectedEmergency.dispatch_units.unit_type || 'N/A'}</div>
                        </div>
                      </div>
                      <div className="team-detail">
                        <span className="team-icon">🏢</span>
                        <div>
                          <div className="team-label">Department</div>
                          <div className="team-value">{selectedEmergency.dispatch_units.service_name || selectedEmergency.dispatch_units.department_name || 'N/A'}</div>
                        </div>
                      </div>
                      <div className="team-detail">
                        <span className="team-icon">📞</span>
                        <div>
                          <div className="team-label">Contact</div>
                          <div className="team-value">{selectedEmergency.dispatch_units.phone || selectedEmergency.dispatch_units.contact_number || 'N/A'}</div>
                        </div>
                      </div>
                      {selectedEmergency.assigned_vehicle && (
                        <div className="team-detail">
                          <span className="team-icon">🚗</span>
                          <div>
                            <div className="team-label">Vehicle</div>
                            <div className="team-value">{selectedEmergency.assigned_vehicle}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="no-data">No response team assigned yet</p>
                  )}
                </div>

                {selectedEmergency.response_notes && (
                  <div className="update-section">
                    <h4>Response Notes</h4>
                    <div className="notes-display">
                      <p>{selectedEmergency.response_notes}</p>
                    </div>
                  </div>
                )}

                {selectedEmergency.resolution_notes && (
                  <div className="update-section">
                    <h4>Resolution Notes</h4>
                    <div className="notes-display">
                      <p>{selectedEmergency.resolution_notes}</p>
                    </div>
                  </div>
                )}

                <div className="update-section">
                  <h4>Dispatch History</h4>
                  {selectedEmergency.dispatch_history && Array.isArray(selectedEmergency.dispatch_history) && selectedEmergency.dispatch_history.length > 0 ? (
                    <div className="history-list">
                      {selectedEmergency.dispatch_history.map((history, index) => {
                        // Check if history is an object
                        if (typeof history === 'object' && history !== null) {
                          return (
                            <div key={index} className="history-item">
                              <span className="history-icon">📝</span>
                              <div className="history-content">
                                <div className="history-text">
                                  {history.action || history.message || history.service_name || 'Update'}
                                </div>
                                {history.timestamp && (
                                  <div className="history-time">{new Date(history.timestamp).toLocaleString()}</div>
                                )}
                                {history.dispatched_at && (
                                  <div className="history-time">{new Date(history.dispatched_at).toLocaleString()}</div>
                                )}
                                {history.service_type && (
                                  <div className="history-detail">Service: {history.service_type}</div>
                                )}
                                {history.status && (
                                  <div className="history-detail">Status: {history.status}</div>
                                )}
                              </div>
                            </div>
                          )
                        }
                        return null
                      })}
                    </div>
                  ) : (
                    <p className="no-data">No dispatch history available</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}