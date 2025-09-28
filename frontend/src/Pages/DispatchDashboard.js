import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './DispatchDashboard.css'
import { supabase } from '../supabaseClient'
function DispatchDashboard() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [dispatchData, setDispatchData] = useState(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [systemStats, setSystemStats] = useState({
    totalVehicles: 0,
    availableVehicles: 0,
    onDutyVehicles: 0,
    pendingRequests: 0,
    acceptedRequests: 0,
    completedToday: 0,
  })
  const [receivedRequests, setReceivedRequests] = useState([])
  const [acceptedRequests, setAcceptedRequests] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [acceptingRequest, setAcceptingRequest] = useState(null)
  const [updatingRequest, setUpdatingRequest] = useState(null)
  const [showVehicleModal, setShowVehicleModal] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [viewRequest, setViewRequest] = useState(null)
  const [showMessageModal, setShowMessageModal] = useState(false)
const [messageData, setMessageData] = useState({
  emergency_id: '',
  message: '',
  status: '',
})
const [sendingMessage, setSendingMessage] = useState(false)
  const [updateData, setUpdateData] = useState({
    status: '',
    response_notes: '',
    assigned_vehicle: '',
  })
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    loadDispatchData()
    loadSystemStats()
    loadReceivedRequests()
    loadAcceptedRequests()
    loadVehicles()

    // Set up real-time subscription for emergency requests
    const interval = setInterval(() => {
      loadReceivedRequests()
      loadAcceptedRequests()
      loadSystemStats()
    }, 30000) // Refresh every 30 seconds

    return () => {
      clearInterval(timer)
      clearInterval(interval)
    }
  }, [])

  const loadDispatchData = async () => {
    try {
      const token = localStorage.getItem("dispatchToken") || localStorage.getItem('token')  || localStorage.getItem('token')
      if (!token) {
        navigate('/')
        return
      }

      const res = await fetch('http://localhost:8000/dispatch/profile/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) throw new Error('Failed to fetch dispatch data')
      const data = await res.json()

      setDispatchData({
        id: data.id,
        departmentName: data.department_name,
        unitType: data.unit_type,
        place: data.city,
        district: data.district,
        state: data.state,
        officerName: data.officer_in_charge,
        primaryContact: data.primary_contact,
        vehicleCount: data.vehicle_count || 0,
        responseCount: data.response_count || 0,
        activeStatus: data.active_status || 'Active',
      })
     
    } catch (error) {
      console.error('Error loading dispatch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSystemStats = async () => {
    try {
      const token = localStorage.getItem("dispatchToken") || localStorage.getItem('token')
      
      // Load vehicle statistics
      const vehiclesRes = await fetch('http://localhost:8000/dispatch/vehicles', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const vehiclesData = await vehiclesRes.json()
      const totalVehicles = vehiclesData.length
      const availableVehicles = vehiclesData.filter(v => v.status === 'Available').length
      const onDutyVehicles = vehiclesData.filter(v => v.status === 'On Duty').length

      // Load request statistics
      const requestsRes = await fetch('http://localhost:8000/dispatch/requests/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const requestsData = await requestsRes.json()

      setSystemStats({
        totalVehicles,
        availableVehicles,
        onDutyVehicles,
        pendingRequests: requestsData.pending || 0,
        acceptedRequests: requestsData.accepted || 0,
        completedToday: requestsData.completed_today || 0,
      })
    } catch (error) {
      console.error('Error loading system stats:', error)
    }
  }

  const loadReceivedRequests = async () => {
  try {
    setRequestsLoading(true);
    const token = localStorage.getItem("dispatchToken") || localStorage.getItem("token") ;

    console.log('[DEBUG] Fetching received requests with token:', token);

    const res = await fetch('http://localhost:8000/dispatch/requests/received', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('[DEBUG] Fetch response status:', res.status);

    if (!res.ok) {
      // Try to read the response body to get error details
      const errorText = await res.text();
      console.error('[ERROR] Failed to fetch received requests. Response body:', errorText);
      throw new Error('Failed to fetch received requests');
    }

    const data = await res.json();
    console.log('[DEBUG] Received requests data:', data);

    const formattedRequests = data.map((request) => ({
      id: request.id,
      emergencyType: request.emergency_type || 'Unknown',
      location: request.location || 'Unknown Location',
      requesterName: request.requester_name || 'Unknown',
      requesterPhone: request.requester_phone || 'N/A',
      priority: request.priority || 'Medium',
      requestedAt: request.requested_at,
      time: formatTimeAgo(request.requested_at),
      description: request.description || '',
      rawData: request,
    }));

    setReceivedRequests(formattedRequests);
  } catch (error) {
    console.error('[ERROR] Error loading received requests:', error);
  } finally {
    setRequestsLoading(false);
  }
};

  const loadAcceptedRequests = async () => {
  try {
    console.log('🟡 [Frontend] Loading accepted requests...')
    const token = localStorage.getItem("dispatchToken") || localStorage.getItem("token");

    const res = await fetch('http://localhost:8000/dispatch/requests/accepted', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    console.log('🟡 [Frontend] Accepted requests response status:', res.status)

    if (!res.ok) throw new Error('Failed to fetch accepted requests')
    const data = await res.json()
    console.log('[DEBUG] Raw accepted requests data:', data);
    console.log('[DEBUG] Number of accepted requests:', data.length);
console.log('[DEBUG] Processing request:', data.id, data);
    const formattedRequests = data.map(request => {
      
      return {
        id: request.id,
        emergencyType: request.emergency_type || 'Unknown',
        location: request.location || 'Unknown Location',
        requesterName: request.requester_name || 'Unknown',
        requesterPhone: request.requester_phone || 'N/A',
        priority: request.emergencies?.priority || 'Medium',
        status: request.status || 'Accepted',
        acceptedAt: request.accepted_at,
        assignedVehicle: request.assigned_vehicle || 'Unassigned',
        estimatedArrival: request.estimated_arrival || '',
        responseNotes: request.response_notes || '',
        time: formatTimeAgo(request.completed_at),
        rawData: request,
      }
    });

    console.log('🟢 [Frontend] Formatted accepted requests:', formattedRequests);
    console.log('🟢 [Frontend] Setting accepted requests count:', formattedRequests.length);
    setAcceptedRequests(formattedRequests)
  } catch (error) {
    console.log(error)
    console.error('🔴 [Frontend] Error loading accepted requests:', error)
  }
}
  const loadVehicles = async () => {
    try {
      const token = localStorage.getItem("dispatchToken") || localStorage.getItem('token')

      const res = await fetch('http://localhost:8000/dispatch/vehicles', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) throw new Error('Failed to fetch vehicles')
      const data = await res.json()

      setVehicles(data)
    } catch (error) {
      console.error('Error loading vehicles:', error)
    }
  }

  const formatTimeAgo = (timestamp) => {
    const now = new Date()
    const requestTime = new Date(timestamp)
    const diffInMinutes = Math.floor((now - requestTime) / (1000 * 60))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes} mins ago`

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours} hours ago`

    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays} days ago`
  }

const handleAcceptRequest = async (requestId) => {
  console.log('🔵 [Frontend] Starting accept request for ID:', requestId)
  
  setAcceptingRequest(requestId)

  try {
    const token = localStorage.getItem("dispatchToken") || localStorage.getItem("token")
    console.log('🔵 [Frontend] Using token:', token ? 'Token found' : 'No token found')
    
    const requestPayload = {
      accepted_by: dispatchData?.officerName || 'Dispatch Unit'
    }
    console.log('🔵 [Frontend] Request payload:', requestPayload)

    const acceptRes = await fetch(`http://localhost:8000/dispatch/requests/${requestId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestPayload),
    })

    console.log('🔵 [Frontend] Response status:', acceptRes.status)

    if (!acceptRes.ok) {
      const errorData = await acceptRes.json()
      console.error('🔴 [Frontend] Accept request failed:', errorData)
      
      // Handle specific error cases
      if (acceptRes.status === 400 && errorData.error?.includes('already been accepted')) {
        alert('This emergency has already been accepted by another unit. The request will be removed from your list.')
        // Refresh the data to remove the accepted request
        loadReceivedRequests()
        loadAcceptedRequests()
        loadSystemStats()
        return
      }
      
      throw new Error(errorData.error || 'Failed to accept request')
    }

    const acceptData = await acceptRes.json()
    console.log('🟢 [Frontend] Accept response data:', acceptData)

    alert('Request accepted successfully!')
    
    // Refresh all data
    loadReceivedRequests()
    loadAcceptedRequests()
    loadSystemStats()

  } catch (error) {
    console.error('🔴 [Frontend] Error in handleAcceptRequest:', error)
    if (!error.message.includes('already been accepted')) {
      alert('Failed to accept request. Please try again.')
    }
  } finally {
    setAcceptingRequest(null)
  }
}
  const handleRequestAction = (requestId, action) => {
  const request = acceptedRequests.find((r) => r.id === requestId)
  if (!request) return

  if (action === 'view') {
    setViewRequest(request)
    setShowViewModal(true)
  } else if (action === 'update') {
    setSelectedRequest(request)
    setUpdateData({
      status: request.status,
      response_notes: request.responseNotes || '',
      assigned_vehicle: request.assignedVehicle || '',
    })
    setShowUpdateModal(true)
  } else if (action === 'message') {
    setMessageData({
      emergency_id: request.rawData.emergency_id,
      message: '',
      status: request.status,
    })
    setShowMessageModal(true)
  }
}
const handleAssignVehicle = async (requestId) => {
  if (!selectedVehicleId) return

  try {
    const token = localStorage.getItem("dispatchToken") || localStorage.getItem("token")
    
    // Get request details
    const request = acceptedRequests.find(r => r.id === requestId)
    
    // Update emergency with vehicle assignment
    await supabase
      .from('emergencies')
      .update({
        assigned_vehicle: selectedVehicleId,
        status: 'Dispatched',
        estimated_arrival: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      })
      .eq('id', request.rawData.emergency_id)

    // Update vehicle status to unavailable
    await supabase
      .from('dispatch_vehicles') // or dispatch_units depending on your structure
      .update({ status: 'On Duty' })
      .eq('vehicle_id', selectedVehicleId)

    // Update dispatch request
    await fetch(`http://localhost:8000/dispatch/requests/${requestId}/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        assigned_vehicle: selectedVehicleId,
        status: 'Dispatched'
      }),
    })

    alert('Vehicle assigned successfully!')
    setShowViewModal(false)
    loadAcceptedRequests()
    loadVehicles()
    
  } catch (error) {
    console.error('Error assigning vehicle:', error)
  }
}

// New function to send message to admin
const handleSendMessage = async () => {
  if (!messageData.message.trim()) {
    alert('Please enter a message')
    return
  }

  setSendingMessage(true)

  try {
    const token = localStorage.getItem("dispatchToken") || localStorage.getItem("token")

    const messagePayload = {
      emergency_id: messageData.emergency_id,
      message: messageData.message,
      dispatch_unit_id: dispatchData.id,
      sent_by: dispatchData.officerName,
      sent_at: new Date().toISOString(),
      message_type: 'dispatch_to_admin',
    }

    const res = await fetch('http://localhost:8000/dispatch/send-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(messagePayload),
    })

    if (!res.ok) throw new Error('Failed to send message')

    alert('Message sent to admin successfully!')
    setShowMessageModal(false)
    setMessageData({ emergency_id: '', message: '', status: '' })

  } catch (error) {
    console.error('Error sending message:', error)
    alert('Failed to send message. Please try again.')
  } finally {
    setSendingMessage(false)
  }
}

  const handleUpdateRequest = async () => {
    if (!selectedRequest || !dispatchData?.id) {
      alert('Unable to update request. Please try again.')
      return
    }

    setUpdatingRequest(selectedRequest.id)

    try {
      const token = localStorage.getItem("dispatchToken") || localStorage.getItem('token')

      const updatePayload = {
        status: updateData.status,
        response_notes: updateData.response_notes,
        assigned_vehicle: updateData.assigned_vehicle,
      }

      if (updateData.status === 'Completed') {
        updatePayload.completed_at = new Date().toISOString()
      }

      const res = await fetch(`http://localhost:8000/dispatch/requests/${selectedRequest.id}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatePayload),
      })

      if (!res.ok) throw new Error('Failed to update request')

      alert('Request updated successfully!')
      setShowUpdateModal(false)
      setSelectedRequest(null)
      setUpdateData({
        status: '',
        response_notes: '',
        assigned_vehicle: '',
      })

      // Refresh data
      loadAcceptedRequests()
      loadSystemStats()
    } catch (error) {
      console.error('Error updating request:', error)
      alert('Failed to update request. Please try again.')
    } finally {
      setUpdatingRequest(null)
    }
  }

  const refreshData = () => {
    loadReceivedRequests()
    loadAcceptedRequests()
    loadSystemStats()
    loadVehicles()
  }

  const handleDispatchProfile = () => {
    navigate('/dispatch-profile')
  }

  const handleLogout = () => {
    localStorage.removeItem('dispatchToken')
    navigate('/login')
  }

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'available':
        return 'dispatch-status-available'
      case 'accepted':
        return 'dispatch-status-accepted'
      case 'dispatched':
        return 'dispatch-status-dispatched'
      case 'en route':
        return 'dispatch-status-enroute'
      case 'on scene':
        return 'dispatch-status-onscene'
      case 'completed':
        return 'dispatch-status-completed'
      case 'on duty':
        return 'dispatch-status-onduty'
      default:
        return 'dispatch-status-default'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'dispatch-priority-critical'
      case 'high':
        return 'dispatch-priority-high'
      case 'medium':
        return 'dispatch-priority-medium'
      case 'low':
        return 'dispatch-priority-low'
      default:
        return 'dispatch-priority-default'
    }
  }

  const getEmergencyTypeIcon = (type) => {
    switch (type.toLowerCase()) {
      case 'medical':
        return '🚑'
      case 'fire':
        return '🚒'
      case 'police':
        return '🚓'
      case 'accident':
        return '🚗'
      case 'rescue':
        return '🚁'
      default:
        return '🚨'
    }
  }

  if (loading) {
    return (
      <div className="dispatch-loading">
        <div className="dispatch-loading-spinner"></div>
        <p>Loading Dispatch Dashboard...</p>
      </div>
    )
  }

  return (
    <div className="dispatch-dashboard">
      {/* Header */}
      <header className="dispatch-header">
        <div className="dispatch-container">
          <div className="dispatch-header-content">
            <div className="dispatch-logo-section">
              <div className="dispatch-logo">
                <span className="dispatch-shield">🚨</span>
              </div>
              <div className="dispatch-logo-text">
                <h1>Dispatch Control Center</h1>
                <p>{dispatchData?.departmentName} - {dispatchData?.unitType}</p>
              </div>
            </div>
            <div className="dispatch-header-info">
              <div className="dispatch-unit-info">
                <span className="dispatch-welcome-text">
                  {dispatchData?.place}, {dispatchData?.district}
                </span>
                <span className="dispatch-unit-badge">{dispatchData?.unitType}</span>
              </div>
              <div className="dispatch-time-display">
                <span className="dispatch-time">
                  {currentTime.toLocaleTimeString()}
                </span>
                <span className="dispatch-date">
                  {currentTime.toLocaleDateString()}
                </span>
              </div>
              <div className="dispatch-alert-indicator">
                <span className="dispatch-alert-count">
                  {systemStats.pendingRequests}
                </span>
                <span className="dispatch-alert-text">Pending</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="dispatch-navigation">
        <div className="dispatch-container">
          <div className="dispatch-nav-links">
            <button className="dispatch-nav-link dispatch-active">Dashboard</button>
            <button className="dispatch-nav-link" onClick={handleDispatchProfile}>
              Profile
            </button>
            <button className="dispatch-nav-link" onClick={() => setShowVehicleModal(true)}>
              Vehicles ({systemStats.availableVehicles}/{systemStats.totalVehicles})
            </button>
            <button
              className="dispatch-nav-link dispatch-logout-btn"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="dispatch-main">
        <div className="dispatch-container">
          {/* System Statistics */}
          <section className="dispatch-stats-section">
            <h2>Fleet & Operations Overview</h2>
            <div className="dispatch-stats-grid">
              <div className="dispatch-stat-card">
                <div className="dispatch-stat-icon dispatch-vehicles-icon">🚛</div>
                <div className="dispatch-stat-content">
                  <h3>Total Vehicles</h3>
                  <div className="dispatch-stat-number">{systemStats.totalVehicles}</div>
                  <p className="dispatch-stat-change">Fleet strength</p>
                </div>
              </div>

              <div className="dispatch-stat-card">
                <div className="dispatch-stat-icon dispatch-available-icon">✅</div>
                <div className="dispatch-stat-content">
                  <h3>Available</h3>
                  <div className="dispatch-stat-number">{systemStats.availableVehicles}</div>
                  <p className="dispatch-stat-change dispatch-positive">Ready for dispatch</p>
                </div>
              </div>

              <div className="dispatch-stat-card">
                <div className="dispatch-stat-icon dispatch-duty-icon">🚨</div>
                <div className="dispatch-stat-content">
                  <h3>On Duty</h3>
                  <div className="dispatch-stat-number">{systemStats.onDutyVehicles}</div>
                  <p className="dispatch-stat-change dispatch-urgent">Active responses</p>
                </div>
              </div>

              <div className="dispatch-stat-card">
                <div className="dispatch-stat-icon dispatch-completed-icon">📊</div>
                <div className="dispatch-stat-content">
                  <h3>Completed Today</h3>
                  <div className="dispatch-stat-number">{systemStats.completedToday}</div>
                  <p className="dispatch-stat-change dispatch-positive">Successfully handled</p>
                </div>
              </div>
            </div>
          </section>

          {/* Unit Performance */}
          <section className="dispatch-performance">
            <div className="dispatch-section-header">
              <h3>Unit Performance</h3>
              <span className="dispatch-performance-badge">
                Officer: {dispatchData?.officerName}
              </span>
            </div>
            <div className="dispatch-performance-card">
              <div className="dispatch-performance-stats">
                <div className="dispatch-performance-item">
                  <span className="dispatch-performance-label">Total Responses</span>
                  <span className="dispatch-performance-value">
                    {dispatchData?.responseCount || 0}
                  </span>
                </div>
                <div className="dispatch-performance-item">
                  <span className="dispatch-performance-label">Contact</span>
                  <span className="dispatch-performance-value">
                    {dispatchData?.primaryContact}
                  </span>
                </div>
                <div className="dispatch-performance-item">
                  <span className="dispatch-performance-label">Unit Status</span>
                  <span className="dispatch-performance-value dispatch-active-status">
                    {dispatchData?.activeStatus}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Received Requests */}
          <section className="dispatch-requests-section">
            <div className="dispatch-section-header">
              <h3>New Emergency Requests</h3>
              <div className="dispatch-section-actions">
                <span className="dispatch-status-indicator">
                  {receivedRequests.length} New Requests
                </span>
                <button
                  className="dispatch-refresh-btn"
                  onClick={refreshData}
                  disabled={requestsLoading}
                >
                  {requestsLoading ? '🔄' : '↻'} Refresh
                </button>
              </div>
            </div>

            <div className="dispatch-requests-grid">
              {receivedRequests.length === 0 ? (
                <div className="dispatch-no-requests">
                  <span className="dispatch-no-data-icon">📬</span>
                  <h4>No New Requests</h4>
                  <p>All emergency requests have been addressed</p>
                </div>
              ) : (
                receivedRequests.map((request) => (
                  <div key={request.id} className="dispatch-request-card">
                    <div className="dispatch-card-header">
                      <div className="dispatch-emergency-type">
                        <span className="dispatch-type-icon">
                          {getEmergencyTypeIcon(request.emergencyType)}
                        </span>
                        <span className="dispatch-type-text">{request.emergencyType}</span>
                      </div>
                      <span
                        className={`dispatch-priority ${getPriorityColor(request.priority)}`}
                      >
                        {request.priority}
                      </span>
                    </div>

                    <div className="dispatch-card-details">
                      <div className="dispatch-detail">
                        <span className="dispatch-detail-label">Requester:</span>
                        <span className="dispatch-detail-value">{request.requesterName}</span>
                      </div>
                      <div className="dispatch-detail">
                        <span className="dispatch-detail-label">Phone:</span>
                        <span className="dispatch-detail-value">{request.requesterPhone}</span>
                      </div>
                      <div className="dispatch-detail">
                        <span className="dispatch-detail-label">Location:</span>
                        <span className="dispatch-detail-value" title={request.location}>
                          {request.location.length > 30
                            ? request.location.substring(0, 30) + '...'
                            : request.location}
                        </span>
                      </div>
                      <div className="dispatch-detail">
                        <span className="dispatch-detail-label">Requested:</span>
                        <span className="dispatch-detail-value">{request.time}</span>
                      </div>
                      {request.description && (
                        <div className="dispatch-detail">
                          <span className="dispatch-detail-label">Description:</span>
                          <span className="dispatch-detail-value">{request.description}</span>
                        </div>
                      )}
                    </div>

                    <div className="dispatch-card-actions">
                      <button
                        className={`dispatch-accept-btn ${
                          acceptingRequest === request.id ? 'dispatch-accepting' : ''
                        }`}
                        onClick={() => handleAcceptRequest(request.id)}
                        disabled={acceptingRequest === request.id}
                      >
                        {acceptingRequest === request.id ? 'Accepting...' : 'Accept Request'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Accepted Requests */}
          <section className="dispatch-accepted-section">
            <div className="dispatch-section-header">
              <h3>Active Requests</h3>
              <span className="dispatch-accepted-count">
                {acceptedRequests.length} Active
              </span>
            </div>

            <div className="dispatch-accepted-table">
              <div className="dispatch-table-header">
                <div className="dispatch-header-cell">Type</div>
                <div className="dispatch-header-cell">Requester</div>
                <div className="dispatch-header-cell">Location</div>
                <div className="dispatch-header-cell">Status</div>
                <div className="dispatch-header-cell">Vehicle</div>
                <div className="dispatch-header-cell">Time</div>
                <div className="dispatch-header-cell">Actions</div>
              </div>

              {acceptedRequests.length === 0 ? (
                <div className="dispatch-table-empty">
                  <span className="dispatch-no-data-icon">📋</span>
                  <h4>No Active Requests</h4>
                  <p>Accepted requests will appear here</p>
                </div>
              ) : (
                acceptedRequests.map((request) => (
                  <div key={request.id} className="dispatch-table-row">
                    <div className="dispatch-table-cell">
                      <div className="dispatch-emergency-type">
                        <span className="dispatch-type-icon">
                          {getEmergencyTypeIcon(request.emergencyType)}
                        </span>
                        {request.emergencyType}
                      </div>
                    </div>
                    <div className="dispatch-table-cell">
                      <div className="dispatch-requester-info">
                        <span className="dispatch-requester-name">{request.requesterName}</span>
                        <span className="dispatch-requester-phone">{request.requesterPhone}</span>
                      </div>
                    </div>
                    <div className="dispatch-table-cell">
                      <span className="dispatch-location" title={request.location}>
                        {request.location.length > 25
                          ? request.location.substring(0, 25) + '...'
                          : request.location}
                      </span>
                    </div>
                    <div className="dispatch-table-cell">
                      <span className={`dispatch-status-badge ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                    <div className="dispatch-table-cell">
                      <span
                        className={`dispatch-vehicle-info ${
                          request.assignedVehicle === 'Unassigned'
                            ? 'dispatch-unassigned'
                            : 'dispatch-assigned'
                        }`}
                      >
                        {request.assignedVehicle}
                      </span>
                    </div>
                    <div className="dispatch-table-cell">
                      <span className="dispatch-time-info">{request.time}</span>
                    </div>
                    <div className="dispatch-table-cell">
  <button
    className="dispatch-action-btn dispatch-view-btn"
    onClick={() => handleRequestAction(request.id, 'view')}
  >
    View
  </button>
  <button
    className="dispatch-action-btn dispatch-update-btn"
    onClick={() => handleRequestAction(request.id, 'update')}
    disabled={updatingRequest === request.id}
  >
    {updatingRequest === request.id ? 'Updating...' : 'Update'}
  </button>
  <button
    className="dispatch-action-btn dispatch-message-btn"
    onClick={() => handleRequestAction(request.id, 'message')}
  >
    Message Admin
  </button>
</div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
{showMessageModal && (
  <div className="dispatch-modal-overlay">
    <div className="dispatch-modal">
      <div className="dispatch-modal-header">
        <h3>Send Message to Admin</h3>
        <button
          className="dispatch-modal-close"
          onClick={() => setShowMessageModal(false)}
        >
          ×
        </button>
      </div>
      <div className="dispatch-modal-content">
        <div className="dispatch-form-group">
          <label htmlFor="message">Message:</label>
          <textarea
            id="message"
            value={messageData.message}
            onChange={(e) => setMessageData({ ...messageData, message: e.target.value })}
            className="dispatch-form-textarea"
            placeholder="Enter message for admin (e.g., 'Vehicle dispatched and en route', 'Unable to dispatch due to vehicle unavailability', etc.)"
            rows="4"
          />
        </div>
        <div className="dispatch-message-templates">
          <h4>Quick Templates:</h4>
          <button 
            className="dispatch-template-btn"
            onClick={() => setMessageData({ ...messageData, message: 'Vehicle has been dispatched and is en route to the location.' })}
          >
            Vehicle Dispatched
          </button>
          <button 
            className="dispatch-template-btn"
            onClick={() => setMessageData({ ...messageData, message: 'Vehicle has arrived at the scene and is responding.' })}
          >
            Arrived at Scene
          </button>
          <button 
            className="dispatch-template-btn"
            onClick={() => setMessageData({ ...messageData, message: 'Unable to dispatch vehicle due to unavailability. Please reassign.' })}
          >
            Unable to Dispatch
          </button>
        </div>
      </div>
      <div className="dispatch-modal-actions">
        <button
          className="dispatch-modal-btn dispatch-cancel-btn"
          onClick={() => setShowMessageModal(false)}
          disabled={sendingMessage}
        >
          Cancel
        </button>
        <button
          className="dispatch-modal-btn dispatch-save-btn"
          onClick={handleSendMessage}
          disabled={sendingMessage || !messageData.message.trim()}
        >
          {sendingMessage ? 'Sending...' : 'Send Message'}
        </button>
      </div>
    </div>
  </div>
)}
      {/* Vehicle Modal */}
      {showVehicleModal && (
        <div className="dispatch-modal-overlay">
          <div className="dispatch-modal">
            <div className="dispatch-modal-header">
              <h3>Fleet Status</h3>
              <button
                className="dispatch-modal-close"
                onClick={() => setShowVehicleModal(false)}
              >
                ×
              </button>
            </div>
            <div className="dispatch-modal-content">
              <div className="dispatch-vehicles-list">
                {vehicles.map((vehicle) => (
                  <div key={vehicle.id} className="dispatch-vehicle-item">
                    <div className="dispatch-vehicle-info">
                      <span className="dispatch-vehicle-id">{vehicle.vehicle_id}</span>
                      <span className="dispatch-vehicle-type">{vehicle.vehicle_type}</span>
                    </div>
                    <span className={`dispatch-vehicle-status ${getStatusColor(vehicle.status)}`}>
                      {vehicle.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="dispatch-modal-actions">
              <button
                className="dispatch-modal-btn dispatch-cancel-btn"
                onClick={() => setShowVehicleModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewRequest && (
        <div className="dispatch-modal-overlay">
          <div className="dispatch-modal dispatch-view-modal">
            <div className="dispatch-modal-header">
              <h3>Request Details #{viewRequest.id}</h3>
              <button
                className="dispatch-modal-close"
                onClick={() => setShowViewModal(false)}
              >
                ×
              </button>
            </div>
            <div className="dispatch-modal-content">
              <div className="dispatch-view-section">
                <h4>Request Information</h4>
                <div className="dispatch-view-grid">
                  <div className="dispatch-view-item">
                    <span className="dispatch-view-label">Type:</span>
                    <span className="dispatch-view-value">{viewRequest.emergencyType}</span>
                  </div>
                  <div className="dispatch-view-item">
                    <span className="dispatch-view-label">Priority:</span>
                    <span className={`dispatch-view-value ${getPriorityColor(viewRequest.priority)}`}>
                      {viewRequest.priority}
                    </span>
                  </div>
                  <div className="dispatch-view-item">
                    <span className="dispatch-view-label">Status:</span>
                    <span className={`dispatch-view-value ${getStatusColor(viewRequest.status)}`}>
                      {viewRequest.status}
                    </span>
                  </div>
                  <div className="dispatch-view-item">
                    <span className="dispatch-view-label">Location:</span>
                    <span className="dispatch-view-value">{viewRequest.location}</span>
                  </div>
                  <div className="dispatch-view-item">
                    <span className="dispatch-view-label">Accepted:</span>
                    <span className="dispatch-view-value">
                      {new Date(viewRequest.acceptedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="dispatch-view-item">
                    <span className="dispatch-view-label">Assigned Vehicle:</span>
                    <span className="dispatch-view-value">{viewRequest.assignedVehicle}</span>
                  </div>
                </div>
              </div>

              <div className="dispatch-view-section">
                <h4>Requester Information</h4>
                <div className="dispatch-view-grid">
                  <div className="dispatch-view-item">
                    <span className="dispatch-view-label">Name:</span>
                    <span className="dispatch-view-value">{viewRequest.requesterName}</span>
                  </div>
                  <div className="dispatch-view-item">
                    <span className="dispatch-view-label">Phone:</span>
                    <span className="dispatch-view-value">{viewRequest.requesterPhone}</span>
                  </div>
                </div>
              </div>
              // Add to the view modal content:
<div className="dispatch-view-section">
  <h4>Vehicle Assignment</h4>
  {!viewRequest.assignedVehicle || viewRequest.assignedVehicle === 'Unassigned' ? (
    <div className="dispatch-vehicle-assignment">
      <select 
        value={selectedVehicleId} 
        onChange={(e) => setSelectedVehicleId(e.target.value)}
        className="dispatch-form-select"
      >
        <option value="">Select Vehicle</option>
        {vehicles.filter(v => v.status === 'Available').map(vehicle => (
          <option key={vehicle.id} value={vehicle.vehicle_id}>
            {vehicle.vehicle_id} - {vehicle.vehicle_type}
          </option>
        ))}
      </select>
      <button 
        onClick={() => handleAssignVehicle(viewRequest.id)}
        className="dispatch-assign-btn"
        disabled={!selectedVehicleId}
      >
        Assign Vehicle
      </button>
    </div>
  ) : (
    <div className="dispatch-assigned-vehicle">
      <p>Assigned Vehicle: <strong>{viewRequest.assignedVehicle}</strong></p>
    </div>
  )}
</div>

              {viewRequest.responseNotes && (
                <div className="dispatch-view-section">
                  <h4>Response Notes</h4>
                  <div className="dispatch-response-notes">
                    {viewRequest.responseNotes}
                  </div>
                </div>
              )}
            </div>

            <div className="dispatch-modal-actions">
              <button
                className="dispatch-modal-btn dispatch-cancel-btn"
                onClick={() => setShowViewModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Modal */}
      {showUpdateModal && selectedRequest && (
        <div className="dispatch-modal-overlay">
          <div className="dispatch-modal">
            <div className="dispatch-modal-header">
              <h3>Update Request #{selectedRequest.id}</h3>
              <button
                className="dispatch-modal-close"
                onClick={() => setShowUpdateModal(false)}
              >
                ×
              </button>
            </div>
            <div className="dispatch-modal-content">
              <div className="dispatch-request-summary">
                <div className="dispatch-summary-item">
                  <strong>Type:</strong> {selectedRequest.emergencyType}
                </div>
                <div className="dispatch-summary-item">
                  <strong>Requester:</strong> {selectedRequest.requesterName}
                </div>
                <div className="dispatch-summary-item">
                  <strong>Location:</strong> {selectedRequest.location}
                </div>
              </div>

              <div className="dispatch-update-form">
                <div className="dispatch-form-group">
                  <label htmlFor="status">Status:</label>
                  <select
                    id="status"
                    value={updateData.status}
                    onChange={(e) => setUpdateData({ ...updateData, status: e.target.value })}
                    className="dispatch-form-select"
                  >
                    <option value="Accepted">Accepted</option>
                    <option value="Dispatched">Dispatched</option>
                    <option value="En Route">En Route</option>
                    <option value="On Scene">On Scene</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                

                <div className="dispatch-form-group">
                  <label htmlFor="response_notes">Response Notes:</label>
                  <textarea
                    id="response_notes"
                    value={updateData.response_notes}
                    onChange={(e) => setUpdateData({ ...updateData, response_notes: e.target.value })}
                    className="dispatch-form-textarea"
                    placeholder="Enter response details..."
                    rows="4"
                  />
                </div>

                {selectedRequest.responseNotes && (
                  <div className="dispatch-form-group">
                    <label>Previous Response Notes:</label>
                    <div className="dispatch-previous-notes">
                      {selectedRequest.responseNotes}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="dispatch-modal-actions">
              <button
                className="dispatch-modal-btn dispatch-cancel-btn"
                onClick={() => setShowUpdateModal(false)}
                disabled={updatingRequest === selectedRequest.id}
              >
                Cancel
              </button>
              <button
                className="dispatch-modal-btn dispatch-save-btn"
                onClick={handleUpdateRequest}
                disabled={updatingRequest === selectedRequest.id}
              >
                {updatingRequest === selectedRequest.id ? 'Updating...' : 'Update Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DispatchDashboard