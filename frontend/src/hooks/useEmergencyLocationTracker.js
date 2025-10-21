import { useEffect, useRef, useState } from 'react'

export function useEmergencyLocationTracker(emergencyId, token, isActive) {
  const [isTracking, setIsTracking] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [error, setError] = useState(null)
  const watchIdRef = useRef(null)
  const lastUpdateTimeRef = useRef(0)

  useEffect(() => {
    // Don't track if no emergency or not active
    if (!emergencyId || !isActive) {
      stopTracking()
      return
    }

    startTracking()

    return () => {
      stopTracking()
    }
  }, [emergencyId, token, isActive])

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by browser')
      return
    }

    if (watchIdRef.current) return // Already tracking

    setIsTracking(true)
    setError(null)

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handlePositionError,
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 5000
      }
    )

    console.log('Started location tracking for emergency:', emergencyId)
  }

  const handlePositionUpdate = async (position) => {
    const now = Date.now()
    const UPDATE_INTERVAL = 30000 // 30 seconds

    // Throttle updates
    if (now - lastUpdateTimeRef.current < UPDATE_INTERVAL) {
      return
    }

    const { latitude, longitude } = position.coords

    try {
      const response = await fetch(
        `http://localhost:8000/emergency/${emergencyId}/update-location`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ latitude, longitude })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        if (data.stopTracking) {
          console.log('Emergency resolved, stopping tracking')
          stopTracking()
        }
        throw new Error(data.error || 'Update failed')
      }

      lastUpdateTimeRef.current = now
      setLastUpdate({ latitude, longitude, timestamp: new Date() })
      console.log('Location updated:', latitude, longitude)

    } catch (err) {
      console.error('Failed to update location:', err)
      setError(err.message)
    }
  }

  const handlePositionError = (error) => {
    console.error('Geolocation error:', error.message)
    setError(`Location error: ${error.message}`)
  }

  const stopTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
      setIsTracking(false)
      console.log('Stopped location tracking')
    }
  }

  return { isTracking, lastUpdate, error, stopTracking }
}