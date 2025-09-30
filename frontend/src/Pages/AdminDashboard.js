import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './AdminDashboard.css'

function AdminDashboard() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [adminData, setAdminData] = useState(null)
  const [lastResetDate, setLastResetDate] = useState(null)
  const [systemStats, setSystemStats] = useState({
    totalUsers: 0,
    activeEmergencies: 0,
    totalCalls: 0,
    resolvedToday: 0,
  })
  const [recentEmergencies, setRecentEmergencies] = useState([])
  const [availableEmergencies, setAvailableEmergencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [emergenciesLoading, setEmergenciesLoading] = useState(false)
  const [acceptingEmergency, setAcceptingEmergency] = useState(null)
  const [updatingEmergency, setUpdatingEmergency] = useState(null)
  const [showAvailableCases, setShowAvailableCases] = useState(false)
  const [selectedEmergency, setSelectedEmergency] = useState(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [viewEmergency, setViewEmergency] = useState(null)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [nearbyServices, setNearbyServices] = useState([])
  const [loadingServices, setLoadingServices] = useState(false)
  const [dispatchingService, setDispatchingService] = useState(null)
  const [servicesByType, setServicesByType] = useState({})
  const [selectedServices, setSelectedServices] = useState([])
  const [requiredServiceTypes, setRequiredServiceTypes] = useState([])
  const [dispatchingMultiple, setDispatchingMultiple] = useState(false)
  const [showMessagesModal, setShowMessagesModal] = useState(false)
const [dispatchMessages, setDispatchMessages] = useState([])
const [loadingMessages, setLoadingMessages] = useState(false)
const [creatingRequest, setCreatingRequest] = useState(null)
const [unreadCount, setUnreadCount] = useState(0)
  const [updateData, setUpdateData] = useState({
    status: '',
    resolution_notes: '',
    priority: '',
  })
  const navigate = useNavigate()

  useEffect(() => {
  const timer = setInterval(() => {
    setCurrentTime(new Date())
  }, 1000)

  // Check and reset daily count on component mount
  checkAndResetDailyCount()
  
  loadAdminData()
  loadSystemStats()
  loadRecentEmergencies()
  loadAvailableEmergencies()
  loadDispatchMessages()

  // Set up real-time subscription for emergencies
  const emergenciesSubscription = supabase
    .channel('emergencies_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'emergencies' },
      (payload) => {
        console.log('Emergency data changed:', payload)
        loadRecentEmergencies()
        loadAvailableEmergencies()
        loadSystemStats()
      }
    )
    .subscribe()

  // Check for new day every hour
  const dailyCheckInterval = setInterval(() => {
    checkAndResetDailyCount()
  }, 3600000) // Check every hour (3600000 ms)

  // Set up interval to check for new messages
  const messageInterval = setInterval(loadDispatchMessages, 30000)

  return () => {
    clearInterval(timer)
    clearInterval(dailyCheckInterval)
    clearInterval(messageInterval)
    emergenciesSubscription.unsubscribe()
  }
}, [])
  const loadAdminData = async () => {
  try {
    const token =
      localStorage.getItem('adminToken') || localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    const { data, error } = await supabase
      .from('admin')
      .select(
        'id, first_name, last_name, email_address, last_login, calls_attended, resolved_cases, last_reset_date'
      )
      .single()

    if (error) {
      console.error('Error fetching admin:', error)
      return
    }

    // Check if we need to reset the count
    const today = new Date().toDateString()
    const lastReset = data.last_reset_date ? new Date(data.last_reset_date).toDateString() : null

    if (lastReset !== today) {
      console.log('Resetting resolved_cases for new day')
      
      // Reset the count in database
      const { error: resetError } = await supabase
        .from('admin')
        .update({
          resolved_cases: 0,
          last_reset_date: new Date().toISOString().split('T')[0] // Store as YYYY-MM-DD
        })
        .eq('id', data.id)

      if (resetError) {
        console.error('Error resetting daily count:', resetError)
      } else {
        // Update local state with reset values
        data.resolved_cases = 0
        data.last_reset_date = new Date().toISOString().split('T')[0]
      }
    }

    setAdminData(data)
    setLastResetDate(data.last_reset_date)
  } catch (error) {
    console.error('Error loading admin data:', error)
  } finally {
    setLoading(false)
  }
}

const loadDispatchMessages = async () => {
  try {
    setLoadingMessages(true)
    const token = localStorage.getItem('adminToken') || localStorage.getItem('token')
    
    const response = await fetch('http://localhost:8000/admin/messages', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) throw new Error('Failed to fetch messages')
    
    const messages = await response.json()
    setDispatchMessages(messages)
    
    // Count unread messages
    const unread = messages.filter(msg => !msg.is_read).length
    setUnreadCount(unread)
    
  } catch (error) {
    console.error('Error loading messages:', error)
  } finally {
    setLoadingMessages(false)
  }
}

// Add this function to mark messages as read
const markMessageAsRead = async (messageId) => {
  try {
    const token = localStorage.getItem('adminToken') || localStorage.getItem('token')
    
    const response = await fetch(`http://localhost:8000/admin/messages/${messageId}/read`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (response.ok) {
      loadDispatchMessages() // Refresh messages
    }
  } catch (error) {
    console.error('Error marking message as read:', error)
  }
}

// Add this function to update emergency status after receiving dispatch message
const handleEmergencyStatusUpdate = async (emergencyId, newStatus, resolutionNotes = '') => {
  try {
    const updatePayload = {
      status: newStatus,
    }

    if (newStatus === 'resolved') {
      updatePayload.resolved_time = new Date().toISOString()
      updatePayload.resolved_by = `${adminData.first_name} ${adminData.last_name}`
      if (resolutionNotes) {
        updatePayload.resolution_notes = resolutionNotes
      }
    }

    const { error } = await supabase
      .from('emergencies')
      .update(updatePayload)
      .eq('id', emergencyId)

    if (error) throw error

    alert(`Emergency status updated to ${newStatus}`)
    loadRecentEmergencies()
    loadSystemStats()
    
  } catch (error) {
    console.error('Error updating emergency status:', error)
    alert('Failed to update emergency status')
  }
}

// Add to useEffect to load messages
useEffect(() => {
  // ... existing code ...
  loadDispatchMessages()

  // Set up interval to check for new messages
  const messageInterval = setInterval(loadDispatchMessages, 30000) // Check every 30 seconds

  return () => {
    // ... existing cleanup ...
    clearInterval(messageInterval)
  }
}, [])
  const loadSystemStats = async () => {
    try {
      const { count: totalUsers, error: usersError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      if (usersError) {
        console.error('Error fetching users count:', usersError)
      }

      const { count: activeEmergencies, error: activeError } = await supabase
        .from('emergencies')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Reported', 'Accepted', 'responding', 'pending'])

      if (activeError) {
        console.error('Error fetching active emergencies:', activeError)
      }

      // Fetch total calls_attended from admin table
      const { data: adminStats, error: callsError } = await supabase
        .from('admin')
        .select('calls_attended')
        .single()

      if (callsError) {
        console.error('Error fetching calls attended:', callsError)
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      // Use resolved_at for counting resolved emergencies today
      const { count: resolvedToday, error: resolvedError } = await supabase
        .from('emergencies')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'resolved')
        .gte('resolved_at', today.toISOString())

      if (resolvedError) {
        console.error('Error fetching resolved emergencies:', resolvedError)
      }

      setSystemStats({
        totalUsers: totalUsers || 0,
        activeEmergencies: activeEmergencies || 0,
        totalCalls: adminStats?.calls_attended || 0,
        resolvedToday: resolvedToday || 0,
      })
    } catch (error) {
      console.error('Error loading system stats:', error)
    }
  }

  const loadRecentEmergencies = async () => {
    try {
      setEmergenciesLoading(true)

      const { data: emergencies, error } = await supabase
        .from('emergencies')
        .select(
          `
        *,
        users (
          first_name,
          last_name,
          phone
        )
      `
        )
        .in('status', ['Accepted', 'responding', 'pending', 'resolved','Dispatched','On Scene','Completed'])
        .order('reported_time', { ascending: false })
        .limit(15) // Increased limit to show more resolved cases

      if (error) {
        console.error('Error fetching emergencies:', error)
        return
      }

      const formattedEmergencies =
        emergencies?.map((emergency) => ({
          id: emergency.id,
          type: emergency.type || emergency.emergency_type || 'Unknown',
          user_name: emergency.users
            ? `${emergency.users.first_name} ${emergency.users.last_name}`
            : 'Unknown User',
          user_phone: emergency.users?.phone || 'N/A',
          location: emergency.location || 'Unknown Location',
          time: formatTimeAgo(emergency.reported_time),
          status: emergency.status || 'Unknown',
          priority: emergency.priority || 'Medium',
          handled_by: emergency.handled_by || 'Unassigned',
          reported_time: emergency.reported_time,
          accepted_at: emergency.accepted_at,
          resolved_at: emergency.resolved_at,
          resolution_notes: emergency.resolution_notes,
          rawData: emergency,
        })) || []

      setRecentEmergencies(formattedEmergencies)
    } catch (error) {
      console.error('Error loading recent emergencies:', error)
    } finally {
      setEmergenciesLoading(false)
    }
  }

  const loadAvailableEmergencies = async () => {
    try {
      // Priority order: Critical, High, Medium, Low
      const priorityOrder = {
        Critical: 4,
        High: 3,
        Medium: 2,
        Low: 1,
      }

      const { data: emergencies, error } = await supabase
        .from('emergencies')
        .select(
          `
          *,
          users (
            first_name,
            last_name,
            phone
          )
        `
        )
        .eq('status', 'Reported')
        .is('handled_by', null)
        .order('reported_time', { ascending: true })
        .limit(10)

      if (error) {
        console.error('Error fetching available emergencies:', error)
        return
      }

      // Sort by priority (Critical first) and then by time
      const sortedEmergencies =
        emergencies
          ?.sort((a, b) => {
            const priorityA = priorityOrder[a.priority] || 0
            const priorityB = priorityOrder[b.priority] || 0

            if (priorityA !== priorityB) {
              return priorityB - priorityA // Higher priority first
            }

            // If same priority, sort by time (oldest first)
            return new Date(a.reported_time) - new Date(b.reported_time)
          })
          .slice(0, 5) || []

      const formattedEmergencies = sortedEmergencies.map((emergency) => ({
        id: emergency.id,
        type: emergency.type || emergency.emergency_type || 'Unknown',
        user_name: emergency.users
          ? `${emergency.users.first_name} ${emergency.users.last_name}`
          : 'Unknown User',
        user_phone: emergency.users?.phone_number || 'N/A',
        location: emergency.location || 'Unknown Location',
        time: formatTimeAgo(emergency.reported_time),
        priority: emergency.priority || 'Medium',
        reported_time: emergency.reported_time,
        rawData: emergency,
      }))

      setAvailableEmergencies(formattedEmergencies)
    } catch (error) {
      console.error('Error loading available emergencies:', error)
    }
  }

  const formatTimeAgo = (timestamp) => {
    const now = new Date()
    const emergencyTime = new Date(timestamp)
    const diffInMinutes = Math.floor((now - emergencyTime) / (1000 * 60))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes} mins ago`

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours} hours ago`

    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays} days ago`
  }

  const handleAcceptEmergency = async (emergencyId) => {
    console.log('🟡 Starting handleAcceptEmergency with ID:', emergencyId)
    console.log('👤 Admin data:', adminData)
    console.log('🔍 Admin ID:', adminData?.id)

    if (!adminData?.id) {
      console.error('❌ Admin data not loaded')
      alert('Admin data not loaded. Please refresh and try again.')
      return
    }

    setAcceptingEmergency(emergencyId)
    console.log('⏳ Set accepting emergency state for ID:', emergencyId)

    try {
      console.log('📋 Step 1: Fetching current emergency status...')

      // Use a transaction-like approach to prevent race conditions
      const { data: currentEmergency, error: fetchError } = await supabase
        .from('emergencies')
        .select('status, handled_by')
        .eq('id', emergencyId)
        .single()

      console.log('📄 Fetch result - Data:', currentEmergency)
      console.log('📄 Fetch result - Error:', fetchError)

      if (fetchError) {
        console.error('❌ Failed to fetch emergency:', fetchError)
        throw new Error(
          'Failed to fetch current emergency status: ' + fetchError.message
        )
      }

      console.log('✅ Current emergency status:', currentEmergency.status)
      console.log('✅ Current handled_by:', currentEmergency.handled_by)

      // Check if already accepted by someone else
      if (
        currentEmergency.status !== 'Reported' ||
        currentEmergency.handled_by !== null
      ) {
        console.warn(
          '⚠️ Emergency already accepted - Status:',
          currentEmergency.status,
          'Handled by:',
          currentEmergency.handled_by
        )
        alert('This emergency has already been accepted by another admin.')
        loadAvailableEmergencies()
        loadRecentEmergencies()
        return
      }

      console.log('🔄 Step 2: Attempting to update emergency...')

      const updatePayload = {
        status: 'Accepted',
        handled_by: `${adminData.first_name} ${adminData.last_name}`,
        admin_id: adminData.id,
        accepted_at: new Date().toISOString(),
      }

      console.log('📦 Update payload:', updatePayload)

      // Attempt to update the emergency
      const { data: updatedEmergency, error: updateError } = await supabase
        .from('emergencies')
        .update(updatePayload)
        .eq('id', emergencyId)
        .eq('status', 'Reported') // Only update if still in 'Reported' status
        .is('handled_by', null) // Only update if not handled by anyone
        .select()

      console.log('📊 Update result - Data:', updatedEmergency)
      console.log('📊 Update result - Error:', updateError)

      if (updateError) {
        console.error('❌ Update failed with error:', updateError)
        console.error('📝 Error details:', JSON.stringify(updateError, null, 2))
        throw new Error('Failed to accept emergency: ' + updateError.message)
      }

      console.log('📈 Updated emergency length:', updatedEmergency?.length)

      if (!updatedEmergency || updatedEmergency.length === 0) {
        console.warn(
          '⚠️ No rows updated - emergency likely accepted by another admin'
        )
        alert(
          'This emergency was just accepted by another admin. Please try another case.'
        )
        loadAvailableEmergencies()
        loadRecentEmergencies()
        return
      }

      console.log('🔄 Step 3: Updating admin stats...')
      console.log('📊 Current calls_attended:', adminData.calls_attended)

      // Update admin's calls_attended count
      const { data: adminUpdateData, error: adminUpdateError } = await supabase
        .from('admin')
        .update({
          calls_attended: (adminData.calls_attended || 0) + 1,
        })
        .eq('id', adminData.id)
        .select()

      console.log('📊 Admin update result - Data:', adminUpdateData)
      console.log('📊 Admin update result - Error:', adminUpdateError)

      if (adminUpdateError) {
        console.warn('⚠️ Failed to update admin stats:', adminUpdateError)
        // Don't fail the whole operation for this
      }

      console.log('✅ SUCCESS: Emergency accepted successfully!')
      alert('Emergency case accepted successfully!')

      // Refresh all data
      console.log('🔄 Refreshing all data...')
      loadAvailableEmergencies()
      loadRecentEmergencies()
      loadSystemStats()
      loadAdminData()
    } catch (error) {
      console.error('🔥 CATCH BLOCK - Error accepting emergency:', error)
      console.error('🔥 Error message:', error.message)
      console.error('🔥 Error stack:', error.stack)

      // Log the error object in detail
      if (error.details) {
        console.error('🔥 Error details:', error.details)
      }
      if (error.hint) {
        console.error('🔥 Error hint:', error.hint)
      }
      if (error.code) {
        console.error('🔥 Error code:', error.code)
      }

      alert(
        'Failed to accept emergency. Please try again. Check console for details.'
      )
    } finally {
      console.log('🔚 Finally block - resetting accepting state')
      setAcceptingEmergency(null)
    }
  }

  const handleEmergencyAction = async (emergencyId, action) => {
    try {
      if (action === 'view') {
        const emergency = recentEmergencies.find((e) => e.id === emergencyId)
        if (emergency) {
          // Get full user details
          const { data: userDetails, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', emergency.rawData.user_id)
            .single()

          if (!error && userDetails) {
            // Decrypt medical conditions asynchronously
            const decryptedMedical = await decrypt(
              userDetails.medical_conditions
            )

            setViewEmergency({
              ...emergency,
              userDetails: {
                ...userDetails,
                medical_conditions: decryptedMedical,
              },
            })
          } else {
            setViewEmergency(emergency)
          }
          setShowViewModal(true)
        }
      } else if (action === 'update') {
        const emergency = recentEmergencies.find((e) => e.id === emergencyId)
        setSelectedEmergency(emergency)
        setUpdateData({
          status: emergency.status,
          resolution_notes: emergency.resolution_notes || '',
          priority: emergency.priority,
        })
        setShowUpdateModal(true)
      }
    } catch (error) {
      console.error('Error handling emergency action:', error)
      alert('Failed to load emergency details.')
    }
  }

 


const handleMultiDispatchRequest = async () => {
  if (selectedServices.length === 0) {
    alert('Please select at least one dispatch unit')
    return
  }

  setDispatchingMultiple(true)

  try {
    const emergencyId = viewEmergency?.id || viewEmergency?.rawData?.id
    if (!emergencyId) throw new Error('Emergency ID not found')

    // Create multiple dispatch requests
    const dispatchPromises = selectedServices.map(async service => {
      const { data, error } = await supabase.from('dispatch_requests').insert({
        emergency_id: emergencyId,
        dispatch_unit_id: service.id,
        emergency_type: viewEmergency.type,
        location: viewEmergency.location,
        requester_name: viewEmergency.user_name,
        requester_phone: viewEmergency.user_phone,
        priority: viewEmergency.priority,
        status: 'Pending',  // Note: You used 'Requested' here but 'Pending' in single dispatch
        requested_at: new Date().toISOString(),
        description: `Emergency dispatch request for ${viewEmergency.type} at ${viewEmergency.location}`,
      })
      
      if (error) {
        console.error('Error inserting dispatch request:', error)
        throw error
      }
      
      return data
    })

    const results = await Promise.all(dispatchPromises)
    console.log('All dispatch requests created:', results)

    const unitNames = selectedServices.map(s => s.name).join(', ')
    alert(`Dispatch requests sent to ${selectedServices.length} unit(s): ${unitNames}`)

    // Close modals and refresh data
    setShowDispatchModal(false)
    setShowViewModal(false)
    setSelectedServices([])
    await Promise.all([loadRecentEmergencies(), loadSystemStats()])

  } catch (error) {
    console.error('Multi-dispatch request error:', error)
    alert('Failed to send dispatch requests. Error: ' + error.message)
  } finally {
    setDispatchingMultiple(false)
  }
}
// Updated loadAvailableEmergencies function to filter units with availability > 0
const handleDispatch = async () => {
  if (!viewEmergency) {
    alert('Emergency data not available')
    return
  }

  console.log(
    `Emergency Type: "${viewEmergency.type}" - Fetching dispatch units from database`
  )

  setLoadingServices(true)
  try {
    // Get user's city from the emergency data
    const userId = viewEmergency.rawData?.user_id

    if (!userId) {
      throw new Error('User ID not found in emergency data')
    }

    // Fetch user's city information
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('city')
      .eq('id', userId)
      .single()

    if (userError) {
      throw new Error('Failed to fetch user location: ' + userError.message)
    }

    if (!userData?.city) {
      throw new Error('User city information not available')
    }

    const userCity = userData.city

    console.log(`User city: ${userCity} - Fetching dispatch units`)

    // Determine required service types based on emergency type
    const getRequiredServiceTypes = (emergencyType) => {
      const type = emergencyType.toLowerCase()
      switch (type) {
        case 'medical':
        case 'medical emergency':
        case 'accident':
          return ['medical']
        case 'fire':
        case 'fire emergency':
            return ['fire']
        case 'police':
        case 'police emergency':
        case 'assault':
          return ['police']
        case 'natural disaster':
          case 'general emergency':
          return ['medical', 'fire', 'police']
        default:
          return ['medical', 'police','fire'] // Default services
      }
    }

    const requiredTypes = getRequiredServiceTypes(viewEmergency.type)

    // UPDATED: Fetch dispatch units with units_available > 0 instead of just checking boolean
    const { data: dispatchUnits, error: dispatchError } = await supabase
      .from('dispatch_units')
      .select('*')
      .eq('city', userCity)
      .in('unit_type', requiredTypes)
      .gt('units_available', 0) // Only units with available count > 0
      .order('unit_type')

    if (dispatchError) {
      throw new Error(
        'Failed to fetch dispatch units: ' + dispatchError.message
      )
    }

    if (!dispatchUnits || dispatchUnits.length === 0) {
      alert(
        `No available dispatch units found in ${userCity} for this emergency type`
      )
      return
    }

    console.log(`Found ${dispatchUnits.length} dispatch units in ${userCity}`)

    // Group units by type
    const unitsByType = {}
    dispatchUnits.forEach((unit) => {
      if (!unitsByType[unit.unit_type]) {
        unitsByType[unit.unit_type] = []
      }
      unitsByType[unit.unit_type].push({
        id: unit.id,
        name: unit.officer_in_charge,
        type: unit.unit_type,
        station: unit.department_name,
        contact: unit.contact_number,
        isAvailable: unit.units_available, // Now shows the actual count
        city: unit.city,
        address: unit.district || 'Address not available',
        unitData: unit,
      })
    })

    // Set services data for dispatch
    setNearbyServices(
      dispatchUnits.map((unit) => ({
        id: unit.id,
        name: unit.officer_in_charge,
        serviceType: unit.unit_type,
        station: unit.department_name,
        contact: unit.contact_number,
        city: unit.city,
        address: unit.district || 'Address not available',
        isAvailable: unit.units_available, // Now shows the actual count
        unitData: unit,
      }))
    )

    setServicesByType(unitsByType)
    setRequiredServiceTypes(requiredTypes)
    setSelectedServices([]) // Reset selection
    setShowDispatchModal(true)
      
    
  }  catch (error) {
    console.error('Error fetching dispatch units:', error)
    alert('Failed to load dispatch units. Error: ' + error.message)
  } finally {
    setLoadingServices(false)
  }

}
const handleServiceSelection = (service, isSelected) => {
  setSelectedServices(prev => {
    if (isSelected) {
      return [...prev, service]
    } else {
      return prev.filter(s => s.id !== service.id)
    }
  })
}

  // Helper function to get unit type display name
  const getUnitTypeDisplayName = (unitType) => {
    switch (unitType) {
      case 'ambulance':
        return 'Ambulance Services'
      case 'hospital':
        return 'Hospital Units'
      case 'police':
        return 'Police Units'
      case 'fire_department':
        return 'Fire Department'
      default:
        return unitType
    }
  }

  // Helper function to get unit type icon
  const getUnitTypeIcon = (unitType) => {
    switch (unitType) {
      case 'ambulance':
        return '🚑'
      case 'hospital':
        return '🏥'
      case 'police':
        return '👮'
      case 'fire_department':
        return '🚒'
      default:
        return '🚨'
    }
  }
  // Helper function to get service type display name
  const getServiceTypeDisplayName = (serviceType) => {
    switch (serviceType) {
      case 'hospital':
        return 'Medical Services'
      case 'police':
        return 'Police Services'
      case 'fire_station':
        return 'Fire Services'
      default:
        return serviceType
    }
  }

  // Helper function to get service type icon
  const getServiceTypeIcon = (serviceType) => {
    switch (serviceType) {
      case 'hospital':
        return '🏥'
      case 'police':
        return '👮'
      case 'fire_station':
        return '🚒'
      default:
        return '🚨'
    }
  }

  const decrypt = async (encryptedText) => {
    // Handle null, undefined, or empty values
    if (!encryptedText || encryptedText.trim() === '') {
      return 'N/A'
    }

    try {
      const token =
        localStorage.getItem('adminToken') || localStorage.getItem('token')
      const response = await fetch(
        'http://localhost:8000/admin/decrypt-medical',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ encryptedData: encryptedText }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to decrypt')
      }

      const result = await response.json()
      return result.decryptedData
    } catch (error) {
      console.error('Error decrypting medical conditions:', error)
      return 'Unable to decrypt medical information'
    }
  }
const handleCreateDispatchRequest = async (service) => {
  console.log('Creating dispatch request for unit:', service.name)
  setCreatingRequest(service.id)

  try {
    const emergencyId = viewEmergency?.id || viewEmergency?.rawData?.id
    if (!emergencyId) throw new Error('Emergency ID not found')

    const dispatchRequestData = {
      emergency_id: emergencyId,
      dispatch_unit_id: service.id,
      emergency_type: viewEmergency.type,
      location: viewEmergency.location,
      requester_name: viewEmergency.user_name,
      requester_phone: viewEmergency.user_phone,
      priority: viewEmergency.priority,
      status: 'Pending',
      requested_at: new Date().toISOString(),
      description: `Emergency dispatch request for ${viewEmergency.type} at ${viewEmergency.location}`,
    }

    const { error: dispatchRequestError } = await supabase
      .from('dispatch_requests')
      .insert(dispatchRequestData)

    if (dispatchRequestError) {
      throw new Error('Failed to create dispatch request: ' + dispatchRequestError.message)
    }

    alert(`Dispatch request sent to ${service.name} successfully!`)
    setShowDispatchModal(false)
    setShowViewModal(false)
    await Promise.all([loadRecentEmergencies(), loadSystemStats()])

  } catch (error) {
    console.error('Error creating dispatch request:', error)
    alert('Failed to send dispatch request. Error: ' + error.message)
  } finally {
    setCreatingRequest(null)
  }
}
  const handleUpdateEmergency = async () => {
  if (!selectedEmergency || !adminData?.id) {
    alert('Unable to update emergency. Please try again.')
    return
  }

  setUpdatingEmergency(selectedEmergency.id)

  try {
    const updatePayload = {
      status: updateData.status,
      priority: updateData.priority,
    }

    // Track if this is a new resolution
    const isNewResolution = updateData.status === 'resolved' && selectedEmergency.status !== 'resolved'

    // If resolving, add resolution timestamp and notes
    if (updateData.status === 'resolved') {
      updatePayload.resolved_at = new Date().toISOString()
      updatePayload.resolved_time = new Date().toISOString()
      updatePayload.resolution_notes = updateData.resolution_notes
      updatePayload.resolved_by = `${adminData.first_name} ${adminData.last_name}`
      
      // FREE UP THE ASSIGNED VEHICLE
      if (selectedEmergency.rawData?.assigned_vehicle) {
        const { error: vehicleError } = await supabase
          .from('dispatch_vehicles')
          .update({ status: 'Available' })
          .eq('vehicle_id', selectedEmergency.rawData.assigned_vehicle)
        
        if (vehicleError) {
          console.error('Failed to release vehicle:', vehicleError)
        }
      }
    }

    // If status is changing from 'Reported' to something else and not handled yet
    if (
      selectedEmergency.status === 'Reported' &&
      !selectedEmergency.handled_by
    ) {
      updatePayload.handled_by = `${adminData.first_name} ${adminData.last_name}`
      updatePayload.admin_id = adminData.id
      updatePayload.accepted_at = new Date().toISOString()

      // Update admin's calls_attended count
      await supabase
        .from('admin')
        .update({
          calls_attended: (adminData.calls_attended || 0) + 1,
        })
        .eq('id', adminData.id)
    }

    // Update the emergency
    const { error: updateError } = await supabase
      .from('emergencies')
      .update(updatePayload)
      .eq('id', selectedEmergency.id)

    if (updateError) {
      throw new Error('Failed to update emergency')
    }

    // If this is a NEW resolution, increment admin's resolved count
    if (isNewResolution) {
      console.log('Incrementing resolved cases count for admin:', adminData.id)
      
      // Get current admin data with latest reset date
      const { data: currentAdminData, error: fetchAdminError } = await supabase
        .from('admin')
        .select('calls_attended, resolved_cases, last_reset_date')
        .eq('id', adminData.id)
        .single()

      if (fetchAdminError) {
        console.error('Error fetching current admin data:', fetchAdminError)
      } else {
        // Check if we need to reset before incrementing
        const today = new Date().toDateString()
        const lastReset = currentAdminData.last_reset_date 
          ? new Date(currentAdminData.last_reset_date).toDateString() 
          : null

        let newResolvedCount = (currentAdminData.resolved_cases || 0) + 1

        // If last reset was not today, start from 1
        if (lastReset !== today) {
          newResolvedCount = 1
        }

        // Update with new count and today's date
        const { error: incrementError } = await supabase
          .from('admin')
          .update({
            resolved_cases: newResolvedCount,
            last_reset_date: new Date().toISOString().split('T')[0]
          })
          .eq('id', adminData.id)

        if (incrementError) {
          console.error('Failed to increment resolved cases count:', incrementError)
        } else {
          console.log(`Successfully set resolved cases count to ${newResolvedCount}`)
        }
      }
    }

    alert('Emergency updated successfully!')
    setShowUpdateModal(false)
    setSelectedEmergency(null)
    setUpdateData({
      status: '',
      resolution_notes: '',
      priority: '',
    })

    // Refresh all data
    loadRecentEmergencies()
    loadAvailableEmergencies()
    loadSystemStats()
    loadAdminData()
  } catch (error) {
    console.error('Error updating emergency:', error)
    alert('Failed to update emergency. Please try again.')
  } finally {
    setUpdatingEmergency(null)
  }
}
const checkAndResetDailyCount = async () => {
  try {
    const today = new Date().toDateString() // Get today's date as string
    const storedResetDate = localStorage.getItem('lastResetDate')

    // If it's a new day, reset the count
    if (storedResetDate !== today) {
      console.log('New day detected, resetting resolved cases count')

      // Reset all admins' resolved_cases to 0
      const { error } = await supabase
        .from('admin')
        .update({ resolved_cases: 0 })
        .neq('id', '00000000-0000-0000-0000-000000000000') // Update all records

      if (error) {
        console.error('Error resetting daily count:', error)
      } else {
        // Store today's date in localStorage
        localStorage.setItem('lastResetDate', today)
        setLastResetDate(today)
        console.log('Successfully reset all admin resolved cases to 0')
        
        // Reload admin data to reflect the reset
        loadAdminData()
      }
    } else {
      setLastResetDate(storedResetDate)
    }
  } catch (error) {
    console.error('Error in checkAndResetDailyCount:', error)
  }
}


  const refreshEmergencies = () => {
    loadRecentEmergencies()
    loadAvailableEmergencies()
    loadSystemStats()
  }

  const handleProfile = () => {
    navigate('/admin-profile')
  }

  const handleSettings = () => {
    navigate('/admin-settings')
  }

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('userType')
    navigate('/login')
  }

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'admin-status-active'
      case 'accepted':
        return 'admin-status-accepted'
      case 'responding':
        return 'admin-status-responding'
      case 'resolved':
        return 'admin-status-resolved'
      case 'pending':
        return 'admin-status-pending'
      case 'reported':
        return 'admin-status-reported'
      default:
        return 'admin-status-default'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'admin-priority-critical'
      case 'high':
        return 'admin-priority-high'
      case 'medium':
        return 'admin-priority-medium'
      case 'low':
        return 'admin-priority-low'
      default:
        return 'admin-priority-default'
    }
  }

  const getEmergencyTypeIcon = (type) => {
    switch (type.toLowerCase()) {
      case 'medical':
        return '❤️'
      case 'fire':
        return '🔥'
      case 'police':
        return '👮'
      case 'accident':
        return '🚗'
      case 'natural disaster':
        return '🌪️'
      default:
        return '🚨'
    }
  }

  if (loading) {
    return (
      <div className="admin-admin-loading">
        <div className="admin-loading-spinner"></div>
        <p>Loading Admin Dashboard...</p>
      </div>
    )
  }

  return (
    <div className="admin-admin-dashboard">
      {/* Header - Same for all admin pages */}
      <header className="admin-admin-header">
        <div className="admin-admin-container">
          <div className="admin-header-content">
            <div className="admin-logo-section">
              <div className="admin-admin-logo">
                <span className="admin-admin-shield">🛡️</span>
              </div>
              <div className="admin-logo-text">
                <h1>Admin Control Panel</h1>
                <p>Emergency Response Management</p>
              </div>
            </div>
            <div className="admin-header-info">
              <div className="admin-admin-info">
                <span className="admin-welcome-text">
                  Welcome, {adminData?.first_name}
                </span>
                <span className="admin-admin-badge">Administrator</span>
              </div>
              <div className="admin-time-display">
                <span className="admin-time">
                  {currentTime.toLocaleTimeString()}
                </span>
                <span className="admin-date">
                  {currentTime.toLocaleDateString()}
                </span>
              </div>
              <div className="admin-alert-indicator">
                <span className="admin-alert-count">
                  {systemStats.activeEmergencies}
                </span>
                <span className="admin-alert-text">Active</span>
              </div>
            </div>
          </div>
        </div>
      </header>
      {/* Navigation */}
      <nav className="admin-admin-navigation">
  <div className="admin-admin-container">
    <div className="admin-nav-links">
      <button className="admin-nav-link admin-active">Dashboard</button>
      <button className="admin-nav-link" onClick={handleProfile}>
        Profile
      </button>
      <button 
        className="admin-nav-link admin-messages-link" 
        onClick={() => {
          setShowMessagesModal(true)
          loadDispatchMessages()
        }}
      >
        Messages {unreadCount > 0 && <span className="admin-unread-badge">{unreadCount}</span>}
      </button>
      <button
        className="admin-nav-link admin-logout-btn"
        onClick={handleLogout}
      >
        Logout
      </button>
    </div>
  </div>
</nav>
      {/* Main Content */}
      <main className="admin-admin-main">
        <div className="admin-admin-container">
          {/* System Statistics */}
          <section className="admin-admin-stats-section">
            <h2>System Overview</h2>
            <div className="admin-admin-stats-grid">
              <div className="admin-admin-stat-card">
                <div className="admin-stat-icon admin-users-icon">👥</div>
                <div className="admin-stat-content">
                  <h3>Total Users</h3>
                  <div className="admin-stat-number">
                    {systemStats.totalUsers}
                  </div>
                  <p className="admin-stat-change">Registered users</p>
                </div>
              </div>

              <div className="admin-admin-stat-card">
                <div className="admin-stat-icon admin-emergency-icon">🚨</div>
                <div className="admin-stat-content">
                  <h3>Active Emergencies</h3>
                  <div className="admin-stat-number">
                    {systemStats.activeEmergencies}
                  </div>
                  <p className="admin-stat-change admin-urgent">
                    Requires attention
                  </p>
                </div>
              </div>

              <div className="admin-admin-stat-card">
                <div className="admin-stat-icon admin-calls-icon">📞</div>
                <div className="admin-stat-content">
                  <h3>Total Calls </h3>
                  <div className="admin-stat-number">
                    {systemStats.totalCalls}
                  </div>
                  <p className="admin-stat-change">Emergency calls</p>
                </div>
              </div>

              <div className="admin-admin-stat-card">
                <div className="admin-stat-icon admin-resolved-icon">✅</div>
                <div className="admin-stat-content">
                  <h3>Resolved Today</h3>
                  <div className="admin-stat-number">
                    {systemStats.resolvedToday}
                  </div>
                  <p className="admin-stat-change admin-positive">
                    Successfully handled
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Admin Performance */}
          <section className="admin-admin-performance">
            <div className="admin-section-header">
              <h3>Your Performance</h3>
              <span className="admin-performance-badge">Administrator</span>
            </div>
            <div className="admin-performance-card">
              <div className="admin-performance-stats">
                <div className="admin-performance-item">
                  <span className="admin-performance-label">
                    Calls Attended
                  </span>
                  <span className="admin-performance-value">
                    {adminData?.calls_attended || 0}
                  </span>
                </div>
                <div className="admin-performance-item">
                  <span className="admin-performance-label">Last Login</span>
                  <span className="admin-performance-value">
                    {adminData?.last_login
                      ? new Date(adminData.last_login).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
                <div className="admin-performance-item">
                  <span className="admin-performance-label">
                    Account Status
                  </span>
                  <span className="admin-performance-value admin-active-status">
                    Active
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Available Cases to Accept */}
          <section className="admin-admin-available-cases-section">
            <div className="admin-section-header">
              <h3>New Cases Requiring Response</h3>
              <div className="admin-section-actions">
                <span className="admin-available-count">
                  {availableEmergencies.length} Available
                </span>
                <button
                  className="admin-toggle-cases-btn"
                  onClick={() => setShowAvailableCases(!showAvailableCases)}
                >
                  {showAvailableCases ? 'Hide Cases' : 'Show Available Cases'}
                </button>
              </div>
            </div>

            {showAvailableCases && (
              <div className="admin-available-cases-grid">
                {availableEmergencies.length === 0 ? (
                  <div className="admin-no-available-cases">
                    <span className="admin-no-data-icon">✅</span>
                    <h4>No Cases Awaiting Response</h4>
                    <p>All emergency reports have been addressed</p>
                  </div>
                ) : (
                  availableEmergencies.map((emergency) => (
                    <div
                      key={emergency.id}
                      className="admin-available-case-card"
                    >
                      <div className="admin-case-header">
                        <div className="admin-case-type">
                          <span className="admin-case-icon">
                            {getEmergencyTypeIcon(emergency.type)}
                          </span>
                          <span className="admin-case-type-text">
                            {emergency.type}
                          </span>
                        </div>
                        <span
                          className={`admin-case-priority ${getPriorityColor(
                            emergency.priority
                          )}`}
                        >
                          {emergency.priority}
                        </span>
                      </div>

                      <div className="admin-case-details">
                        <div className="admin-case-detail">
                          <span className="admin-detail-label">Reporter:</span>
                          <span className="admin-detail-value">
                            {emergency.user_name}
                          </span>
                        </div>
                        <div className="admin-case-detail">
                          <span className="admin-detail-label">Phone:</span>
                          <span className="admin-detail-value">
                            {emergency.user_phone}
                          </span>
                        </div>
                        <div className="admin-case-detail">
                          <span className="admin-detail-label">Location:</span>
                          <span
                            className="admin-detail-value"
                            title={emergency.location}
                          >
                            {emergency.location.length > 30
                              ? emergency.location.substring(0, 30) + '...'
                              : emergency.location}
                          </span>
                        </div>
                        <div className="admin-case-detail">
                          <span className="admin-detail-label">Reported:</span>
                          <span className="admin-detail-value">
                            {emergency.time}
                          </span>
                        </div>
                      </div>

                      <div className="admin-case-actions">
                        <button
                          className={`admin-accept-case-btn ${
                            acceptingEmergency === emergency.id
                              ? 'admin-accepting'
                              : ''
                          }`}
                          onClick={() => handleAcceptEmergency(emergency.id)}
                          disabled={acceptingEmergency === emergency.id}
                        >
                          {acceptingEmergency === emergency.id
                            ? 'Accepting...'
                            : 'Accept Case'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>

          {/* Recent Emergencies */}
          <section className="admin-admin-emergencies-section">
            <div className="admin-section-header">
              <h3>Recent Emergency Reports</h3>
              <div className="admin-section-actions">
                <span className="admin-status-indicator">Live Updates</span>
                <button
                  className="admin-refresh-btn"
                  onClick={refreshEmergencies}
                  disabled={emergenciesLoading}
                >
                  {emergenciesLoading ? '🔄' : '↻'} Refresh
                </button>
              </div>
            </div>

            <div className="admin-admin-emergencies-table">
              <div className="admin-table-header">
                <div className="admin-header-cell">Type</div>
                <div className="admin-header-cell">User</div>
                <div className="admin-header-cell">Location</div>
                <div className="admin-header-cell">Time</div>
                <div className="admin-header-cell">Status</div>
                <div className="admin-header-cell">Priority</div>
                <div className="admin-header-cell">Assigned To</div>
                <div className="admin-header-cell">Actions</div>
              </div>

              {emergenciesLoading ? (
                <div className="admin-table-loading">
                  <div className="admin-loading-spinner"></div>
                  <p>Loading emergencies...</p>
                </div>
              ) : (
                recentEmergencies.map((emergency) => (
                  <div key={emergency.id} className="admin-table-row">
                    <div className="admin-table-cell">
                      <div className="admin-emergency-type">
                        <span className="admin-type-icon">
                          {getEmergencyTypeIcon(emergency.type)}
                        </span>
                        {emergency.type}
                      </div>
                    </div>
                    <div className="admin-table-cell">
                      <div className="admin-user-info">
                        <span className="admin-user-name">
                          {emergency.user_name}
                        </span>
                        {emergency.user_phone &&
                          emergency.user_phone !== 'N/A' && (
                            <span className="admin-user-phone">
                              {emergency.user_phone}
                            </span>
                          )}
                      </div>
                    </div>
                    <div className="admin-table-cell">
                      <span
                        className="admin-location"
                        title={emergency.location}
                      >
                        {emergency.location.length > 20
                          ? emergency.location.substring(0, 20) + '...'
                          : emergency.location}
                      </span>
                    </div>
                    <div className="admin-table-cell">
                      <span
                        className="admin-time-info"
                        title={new Date(
                          emergency.reported_time
                        ).toLocaleString()}
                      >
                        {emergency.time}
                      </span>
                    </div>
                    <div className="admin-table-cell">
                      <span
                        className={`admin-status-badge ${getStatusColor(
                          emergency.status
                        )}`}
                      >
                        {emergency.status.charAt(0).toUpperCase() +
                          emergency.status.slice(1)}
                      </span>
                    </div>
                    <div className="admin-table-cell">
                      <span
                        className={`admin-priority-badge ${getPriorityColor(
                          emergency.priority
                        )}`}
                      >
                        {emergency.priority.charAt(0).toUpperCase() +
                          emergency.priority.slice(1)}
                      </span>
                    </div>
                    <div className="admin-table-cell">
                      <span
                        className={`admin-assigned-to ${
                          emergency.handled_by === 'Unassigned'
                            ? 'admin-unassigned'
                            : 'admin-assigned'
                        }`}
                      >
                        {emergency.handled_by}
                      </span>
                    </div>
                    <div className="admin-table-cell">
                      {emergency.status !== 'Reported' ? (
                        <>
                          <button
                            className="admin-action-btn admin-view-btn"
                            onClick={() =>
                              handleEmergencyAction(emergency.id, 'view')
                            }
                            title="View emergency details"
                          >
                            View
                          </button>
                          <button
                            className="admin-action-btn admin-update-btn"
                            onClick={() =>
                              handleEmergencyAction(emergency.id, 'update')
                            }
                            title="Update emergency status"
                            disabled={updatingEmergency === emergency.id}
                          >
                            {updatingEmergency === emergency.id
                              ? 'Updating...'
                              : 'Update'}
                          </button>
                        </>
                      ) : (
                        <span className="admin-new-case-indicator">
                          New Case
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {!emergenciesLoading && recentEmergencies.length === 0 && (
              <div className="admin-no-emergencies">
                <span className="admin-no-data-icon">📋</span>
                <h4>No Recent Emergencies</h4>
                <p>All emergency reports will appear here</p>
              </div>
            )}
          </section> 
          {showMessagesModal && (
  <div className="admin-modal-overlay">
    <div className="admin-modal admin-messages-modal">
      <div className="admin-modal-header">
        <h3>Dispatch Messages</h3>
        <button
          className="admin-modal-close"
          onClick={() => setShowMessagesModal(false)}
        >
          ×
        </button>
      </div>

      <div className="admin-modal-content">
        {loadingMessages ? (
          <div className="admin-loading-messages">
            <div className="admin-loading-spinner"></div>
            <p>Loading messages...</p>
          </div>
        ) : dispatchMessages.length === 0 ? (
          <div className="admin-no-messages">
            <span className="admin-no-data-icon">📬</span>
            <h4>No Messages</h4>
            <p>No messages from dispatch units yet</p>
          </div>
        ) : (
          <div className="admin-messages-list">
            {dispatchMessages.map((message) => (
              <div 
                key={message.id} 
                className={`admin-message-item ${!message.is_read ? 'admin-unread' : ''}`}
              >
                <div className="admin-message-header">
                  <div className="admin-message-info">
                    <span className="admin-message-from">
                      From: {message.sent_by} ({message.dispatch_units?.unit_name})
                    </span>
                    <span className="admin-message-time">
                      {new Date(message.sent_at).toLocaleString()}
                    </span>
                  </div>
                  {!message.is_read && (
                    <button
                      className="admin-mark-read-btn"
                      onClick={() => markMessageAsRead(message.id)}
                    >
                      Mark Read
                    </button>
                  )}
                </div>
                
                <div className="admin-message-emergency">
                  <h5>Emergency #{message.emergency_id}</h5>
                  <p>Type: {message.emergencies?.type} | Location: {message.emergencies?.location}</p>
                </div>

                <div className="admin-message-content">
                  <p>{message.message}</p>
                </div>

                <div className="admin-message-actions">
                  <button
                    className="admin-message-action-btn admin-view-emergency"
                    onClick={() => {
                      // Find and view the emergency
                      const emergency = recentEmergencies.find(e => e.id === message.emergency_id)
                      if (emergency) {
                        handleEmergencyAction(emergency.id, 'view')
                      }
                    }}
                  >
                    View Emergency
                  </button>
                  

                  
<button
  className="admin-message-action-btn admin-resolve-emergency"
  onClick={() => {
    const emergency = recentEmergencies.find(
      (e) => e.id === message.emergency_id
    );
    if (!emergency) {
      alert('Emergency not found. Please refresh the page.');
      return;
    }

    // Pre-fill the modal
    setSelectedEmergency(emergency);
    setUpdateData({
      status: 'resolved', // pre-select resolved
      resolution_notes: `Emergency resolved based on dispatch message from ${message.sent_by}: ${message.message}`,
      priority: emergency.priority,
    });

    // Show the same Update Emergency Modal
    setShowUpdateModal(true);
  }}
>
  Resolve Emergency
</button>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-modal-actions">
        <button
          className="admin-modal-btn admin-cancel-btn"
          onClick={() => setShowMessagesModal(false)}
        >
          Close
        </button>
        <button
          className="admin-modal-btn admin-refresh-btn"
          onClick={loadDispatchMessages}
          disabled={loadingMessages}
        >
          {loadingMessages ? 'Loading...' : 'Refresh Messages'}
        </button>
      </div>
    </div>
  </div>
)}
        </div>
      </main>
      {/* Update Emergency Modal */}
      {showUpdateModal && selectedEmergency && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Update Emergency Case #{selectedEmergency.id}</h3>
              <button
                className="admin-modal-close"
                onClick={() => setShowUpdateModal(false)}
              >
                ×
              </button>
            </div>

            <div className="admin-modal-content">
              <div className="admin-emergency-summary">
                <div className="admin-summary-item">
                  <strong>Type:</strong> {selectedEmergency.type}
                </div>
                <div className="admin-summary-item">
                  <strong>Reporter:</strong> {selectedEmergency.user_name}
                </div>
                <div className="admin-summary-item">
                  <strong>Location:</strong> {selectedEmergency.location}
                </div>
                <div className="admin-summary-item">
                  <strong>Reported:</strong>{' '}
                  {new Date(selectedEmergency.reported_time).toLocaleString()}
                </div>
                {selectedEmergency.accepted_at && (
                  <div className="admin-summary-item">
                    <strong>Accepted:</strong>{' '}
                    {new Date(selectedEmergency.accepted_at).toLocaleString()}
                  </div>
                )}
                {selectedEmergency.resolved_at && (
                  <div className="admin-summary-item">
                    <strong>Resolved:</strong>{' '}
                    {new Date(selectedEmergency.resolved_at).toLocaleString()}
                  </div>
                )}
              </div>

              <div className="admin-update-form">
                <div className="admin-form-group">
                  <label htmlFor="status">Status:</label>
                  <select
                    id="status"
                    value={updateData.status}
                    onChange={(e) =>
                      setUpdateData({ ...updateData, status: e.target.value })
                    }
                    className="admin-form-select"
                  >
                    <option value="Reported">Reported</option>
                    <option value="Accepted">Accepted</option>
                    <option value="responding">Responding</option>
                    <option value="pending">Pending</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="priority">Priority:</label>
                  <select
                    id="priority"
                    value={updateData.priority}
                    onChange={(e) =>
                      setUpdateData({ ...updateData, priority: e.target.value })
                    }
                    className="admin-form-select"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                {updateData.status === 'resolved' && (
                  <div className="admin-form-group">
                    <label htmlFor="resolution_notes">Resolution Notes:</label>
                    <textarea
                      id="resolution_notes"
                      value={updateData.resolution_notes}
                      onChange={(e) =>
                        setUpdateData({
                          ...updateData,
                          resolution_notes: e.target.value,
                        })
                      }
                      className="admin-form-textarea"
                      placeholder="Enter resolution details..."
                      rows="4"
                    />
                  </div>
                )}

                {selectedEmergency.resolution_notes && (
                  <div className="admin-form-group">
                    <label>Previous Resolution Notes:</label>
                    <div className="admin-previous-notes">
                      {selectedEmergency.resolution_notes}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="admin-modal-actions">
              <button
                className="admin-modal-btn admin-cancel-btn"
                onClick={() => setShowUpdateModal(false)}
                disabled={updatingEmergency === selectedEmergency.id}
              >
                Cancel
              </button>
              <button
                className="admin-modal-btn admin-save-btn"
                onClick={handleUpdateEmergency}
                disabled={updatingEmergency === selectedEmergency.id}
              >
                {updatingEmergency === selectedEmergency.id
                  ? 'Updating...'
                  : 'Update Emergency'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showViewModal && viewEmergency && (
        <div className="admin-modal-overlay">
          <div className="admin-modal admin-view-modal">
            <div className="admin-modal-header">
              <h3>Emergency Case Details #{viewEmergency.id}</h3>
              <button
                className="admin-modal-close"
                onClick={() => setShowViewModal(false)}
              >
                ×
              </button>
            </div>

            <div className="admin-modal-content">
              {/* Emergency Information */}
              <div className="admin-view-section">
                <h4>Emergency Information</h4>
                <div className="admin-view-grid">
                  <div className="admin-view-item">
                    <span className="admin-view-label">Type:</span>
                    <span className="admin-view-value">
                      {viewEmergency.type}
                    </span>
                  </div>
                  <div className="admin-view-item">
                    <span className="admin-view-label">Priority:</span>
                    <span
                      className={`admin-view-value ${getPriorityColor(
                        viewEmergency.priority
                      )}`}
                    >
                      {viewEmergency.priority}
                    </span>
                  </div>
                  <div className="admin-view-item">
                    <span className="admin-view-label">Status:</span>
                    <span
                      className={`admin-view-value ${getStatusColor(
                        viewEmergency.status
                      )}`}
                    >
                      {viewEmergency.status}
                    </span>
                  </div>
                  <div className="admin-view-item">
                    <span className="admin-view-label">Location:</span>
                    <span className="admin-view-value">
                      {viewEmergency.location}
                    </span>
                  </div>
                  <div className="admin-view-item">
                    <span className="admin-view-label">Reported:</span>
                    <span className="admin-view-value">
                      {new Date(viewEmergency.reported_time).toLocaleString()}
                    </span>
                  </div>
                  {viewEmergency.accepted_at && (
                    <div className="admin-view-item">
                      <span className="admin-view-label">Accepted:</span>
                      <span className="admin-view-value">
                        {new Date(viewEmergency.accepted_at).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="admin-view-item">
                    <span className="admin-view-label">Handled By:</span>
                    <span className="admin-view-value">
                      {viewEmergency.handled_by}
                    </span>
                  </div>
                </div>
              </div>

              {/* User Information */}
              <div className="admin-view-section">
                <h4>Reporter Information</h4>
                <div className="admin-view-grid">
                  <div className="admin-view-item">
                    <span className="admin-view-label">Name:</span>
                    <span className="admin-view-value">
                      {viewEmergency.user_name}
                    </span>
                  </div>
                  <div className="admin-view-item">
                    <span className="admin-view-label">Phone:</span>
                    <span className="admin-view-value">
                      {viewEmergency.user_phone}
                    </span>
                  </div>
                  {viewEmergency.userDetails && (
                    <>
                      <div className="admin-view-item">
                        <span className="admin-view-label">Email:</span>
                        <span className="admin-view-value">
                          {viewEmergency.userDetails.email}
                        </span>
                      </div>
                      <div className="admin-view-item">
                        <span className="admin-view-label">Address:</span>
                        <span className="admin-view-value">
                          {viewEmergency.userDetails.street_address &&
                            `${viewEmergency.userDetails.street_address}, ${viewEmergency.userDetails.city}, ${viewEmergency.userDetails.state} ${viewEmergency.userDetails.zip_code}`}
                        </span>
                      </div>
                      {viewEmergency.userDetails.medical_conditions && (
                        <div className="admin-view-item admin-view-medical">
                          <span className="admin-view-label">
                            Medical Conditions:
                          </span>
                          <span className="admin-view-value admin-medical-info">
                            {viewEmergency.userDetails.medical_conditions}
                          </span>
                        </div>
                      )}
                      <div className="admin-view-item">
                        <span className="admin-view-label">
                          Emergency Contact:
                        </span>
                        <span className="admin-view-value">
                          {viewEmergency.userDetails.primary_emergency_contact}{' '}
                          - {viewEmergency.userDetails.primary_emergency_phone}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Resolution Notes if any */}
              {viewEmergency.resolution_notes && (
                <div className="admin-view-section">
                  <h4>Resolution Notes</h4>
                  <div className="admin-resolution-notes">
                    {viewEmergency.resolution_notes}
                  </div>
                </div>
              )}
            </div>

            <div className="admin-modal-actions">
              <button
                className="admin-modal-btn admin-cancel-btn"
                onClick={() => setShowViewModal(false)}
              >
                Close
              </button>
              {viewEmergency.status !== 'resolved' && viewEmergency.status != 'Dispatched'&& (  // Remove the responding check
  <button
    className="admin-modal-btn admin-dispatch-btn"
    onClick={handleDispatch}
    disabled={loadingServices}
  >
    {loadingServices
      ? 'Loading Services...'
      : 'Send Dispatch Requests'}  
  </button>
)}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Multi-Unit Dispatch Modal */}
      {showDispatchModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal admin-dispatch-modal admin-multi-dispatch-modal">
            <div className="admin-modal-header">
              <h3>Dispatch Emergency Units</h3>
              <button
                className="admin-modal-close"
                onClick={() => setShowDispatchModal(false)}
              >
                ×
              </button>
            </div>

            <div className="admin-modal-content">
              <div className="admin-dispatch-info">
                <div className="admin-emergency-info">
                  <h4>Emergency: {viewEmergency?.type}</h4>
                  <p>
                    Required units:{' '}
                    {requiredServiceTypes
                      .map((type) => getUnitTypeDisplayName(type))
                      .join(', ')}
                  </p>
                  <p>
                    Found {nearbyServices.length} available units in the area
                  </p>
                </div>

                {selectedServices.length > 0 && (
                  <div className="admin-selected-services">
                    <h5>Selected for Dispatch ({selectedServices.length}):</h5>
                    <div className="admin-selected-list">
                      {selectedServices.map((service) => (
                        <span key={service.id} className="admin-selected-tag">
                          {getUnitTypeIcon(service.serviceType || service.type)}{' '}
                          {service.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="admin-services-by-type">
                {Object.keys(servicesByType).map((unitType) => (
                  <div key={unitType} className="admin-service-type-section">
                    <h4 className="admin-service-type-header">
                      {getUnitTypeIcon(unitType)}{' '}
                      {getUnitTypeDisplayName(unitType)}
                      <span className="admin-service-count">
                        ({servicesByType[unitType]?.length || 0})
                      </span>
                    </h4>

                    <div className="admin-service-type-list">
                      {(servicesByType[unitType] || []).map((unit) => (
                        <div
                          key={unit.id}
                          className="admin-service-card admin-selectable-service"
                        >
                          <div className="admin-service-selector">
                            <input
                              type="checkbox"
                              id={`unit-${unit.id}`}
                              checked={selectedServices.some(
                                (s) => s.id === unit.id
                              )}
                              onChange={(e) =>
                                handleServiceSelection(unit, e.target.checked)
                              }
                              className="admin-service-checkbox"
                            />
                            <label
                              htmlFor={`unit-${unit.id}`}
                              className="admin-service-checkbox-label"
                            >
                              Select
                            </label>
                          </div>

                          <div className="admin-service-info">
                            <div className="admin-service-main">
                              <h5>{unit.name}</h5>
                              <p className="admin-service-station">
                                {unit.station}
                              </p>
                              <p className="admin-service-address">
                                {unit.address}
                              </p>
                              <div className="admin-service-details">
                                <span className="admin-service-city">
                                  📍 {unit.city}
                                </span>
                                <span
                                  className={`admin-service-status ${
                                    unit.isAvailable
                                      ? 'available'
                                      : 'unavailable'
                                  }`}
                                >
                                  {unit.isAvailable
                                    ? '✅ Available'
                                    : '❌ Unavailable'}
                                </span>
                              </div>
                              <p className="admin-service-phone">
                                📞 {unit.contact}
                              </p>
                            </div>
                          </div>

                          <div className="admin-service-quick-dispatch">
  <button
    className="admin-quick-dispatch-btn"
    onClick={() => handleCreateDispatchRequest(unit)}
    disabled={
      creatingRequest === unit.id ||
      !unit.isAvailable
    }
    title="Send request to this dispatch unit"
  >
    {creatingRequest === unit.id
      ? 'Sending Request...'
      : 'Send Request'}
  </button>
</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {nearbyServices.length === 0 && (
                <div className="admin-no-services">
                  <p>
                    No available dispatch units found in the user's city. Please
                    try manual coordination.
                  </p>
                </div>
              )}
            </div>

            <div className="admin-modal-actions">
              <button
                className="admin-modal-btn admin-cancel-btn"
                onClick={() => setShowDispatchModal(false)}
              >
                Close
              </button>

              {selectedServices.length > 0 && (
                <button
                  className="admin-modal-btn admin-dispatch-selected-btn"
                  onClick={handleMultiDispatchRequest}
                  disabled={dispatchingMultiple}
                >
                  {dispatchingMultiple
                    ? 'Dispatching...'
                    : `Dispatch Selected (${selectedServices.length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Footer */}
      <footer className="admin-admin-footer">
        <div className="admin-container">
          <div className="admin-footer-content">
            <p>
              © {new Date().getFullYear()} Emergency Response Admin Panel |
              System Status: Online
            </p>
            <p className="admin-footer-subtitle">
              Admin: {adminData?.email_address} | Last Updated:{' '}
              {currentTime.toLocaleString()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default AdminDashboard
