import React, { useState, useEffect } from 'react'
import './DispatchRegister.css'

export default function DispatchRegister() {
  const [formData, setFormData] = useState({
    departmentName: '',
    unitType: '',
    place: '',
    district: '',
    state: '',
    pincode: '',
    username: '',
    contactNumber: '',
    alternateContactNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    officerInCharge: '',
    officerContact: '',
    vehicleCount: '',
  })

  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [showOtpPopup, setShowOtpPopup] = useState(false)
  const [otp, setOtp] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [usernameCheckLoading, setUsernameCheckLoading] = useState(false)
  const [usernameValidationTimeout, setUsernameValidationTimeout] =
    useState(null)

  const unitTypes = ['Police Station', 'Fire Station', 'Medical Service']

  // Username validation regex
  const usernameRegex = /^[a-zA-Z0-9_-]{8,}$/
  const usernameWithLetterRegex = /^(?=.*[a-zA-Z])[a-zA-Z0-9_-]{8,}$/

  // Check username uniqueness with backend
  const checkUsernameUniqueness = async (username) => {
    try {
      const response = await fetch(
        'http://localhost:8000/dispatch/check-username',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username }),
        }
      )

      const data = await response.json()
      return data.isUnique
    } catch (error) {
      console.error('Error checking username uniqueness:', error)
      return true // Assume unique if API fails to avoid blocking user
    }
  }

  // Real-time username validation
  const validateUsernameRealtime = async (username) => {
    const newErrors = { ...errors }

    if (!username) {
      newErrors.username = 'Username is required'
      setErrors(newErrors)
      return newErrors
    }

    if (!usernameWithLetterRegex.test(username)) {
      newErrors.username =
        'Username must be at least 8 characters long, contain at least one letter, and only use letters, numbers, underscores, or hyphens'
      setErrors(newErrors)
      return newErrors
    }

    // Check uniqueness with backend
    setUsernameCheckLoading(true)
    const isUnique = await checkUsernameUniqueness(username)
    setUsernameCheckLoading(false)

    if (!isUnique) {
      newErrors.username =
        'This username is already taken. Please choose a different one.'
      setErrors(newErrors)
      return newErrors
    }

    // Clear username error if validation passes
    delete newErrors.username
    setErrors(newErrors)
    return {}
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prevState) => ({
      ...prevState,
      [name]: type === 'checkbox' ? checked : value,
    }))

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }

    // Special handling for username with debounced validation
    if (name === 'username') {
      // Clear previous timeout
      if (usernameValidationTimeout) {
        clearTimeout(usernameValidationTimeout)
      }

      // Set new timeout for validation
      const timeoutId = setTimeout(() => {
        if (value.trim()) {
          validateUsernameRealtime(value.trim())
        }
      }, 800) // Wait 800ms after user stops typing

      setUsernameValidationTimeout(timeoutId)
    }
  }

  const validateForm = () => {
    const newErrors = {}

    // Required field validation
    if (!formData.departmentName.trim())
      newErrors.departmentName = 'Department name is required'
    if (!formData.unitType) newErrors.unitType = 'Unit type is required'
    if (!formData.place.trim()) newErrors.place = 'Place is required'
    if (!formData.district.trim()) newErrors.district = 'District is required'
    if (!formData.state.trim()) newErrors.state = 'State is required'
    if (!formData.pincode.trim()) newErrors.pincode = 'Pincode is required'
    if (!formData.username.trim()) newErrors.username = 'Username is required'
    if (!formData.contactNumber.trim())
      newErrors.contactNumber = 'Contact number is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    if (!formData.password) newErrors.password = 'Password is required'
    if (!formData.confirmPassword)
      newErrors.confirmPassword = 'Please confirm password'
    if (!formData.officerInCharge.trim())
      newErrors.officerInCharge = 'Officer in charge name is required'
    if (!formData.officerContact.trim())
      newErrors.officerContact = 'Officer contact is required'

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    // Username validation
    if (formData.username && !usernameWithLetterRegex.test(formData.username)) {
      newErrors.username =
        'Username must be at least 8 characters long, contain at least one letter, and only use letters, numbers, underscores, or hyphens'
    }

    // Phone validation
    const phoneRegex = /^\d{10}$/
    if (
      formData.contactNumber &&
      !phoneRegex.test(formData.contactNumber.replace(/\D/g, ''))
    ) {
      newErrors.contactNumber = 'Please enter a valid 10-digit contact number'
    }
    if (
      formData.alternateContactNumber &&
      !phoneRegex.test(formData.alternateContactNumber.replace(/\D/g, ''))
    ) {
      newErrors.alternateContactNumber =
        'Please enter a valid 10-digit alternate contact number'
    }
    if (
      formData.officerContact &&
      !phoneRegex.test(formData.officerContact.replace(/\D/g, ''))
    ) {
      newErrors.officerContact =
        'Please enter a valid 10-digit officer contact number'
    }

    // Pincode validation
    const pincodeRegex = /^\d{6}$/
    if (formData.pincode && !pincodeRegex.test(formData.pincode)) {
      newErrors.pincode = 'Please enter a valid 6-digit pincode'
    }

    // Password validation
    if (formData.password && formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long'
    }

    // Password match validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    return newErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    // Final username uniqueness check before submission
    if (!(await checkUsernameUniqueness(formData.username))) {
      setErrors({
        username:
          'This username is already taken. Please choose a different one.',
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('http://localhost:8000/dispatch/send_otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department_name: formData.departmentName,
          unit_type: formData.unitType,
          place: formData.place,
          district: formData.district,
          state: formData.state,
          pincode: formData.pincode,
          username: formData.username,
          contact_number: formData.contactNumber,
          alternate_contact_number: formData.alternateContactNumber || null,
          email: formData.email,
          password: formData.password,
          officer_in_charge: formData.officerInCharge,
          officer_contact: formData.officerContact,
          vehicle_count: formData.vehicleCount
            ? parseInt(formData.vehicleCount)
            : null,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        alert('OTP sent to your contact number')
        setShowOtpPopup(true)
      } else {
        alert(data.detail || 'Failed to send OTP')
      }
    } catch (error) {
      console.error('Registration error:', error)
      alert('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOtp = async () => {
    try {
      const response = await fetch(
        'http://localhost:8000/dispatch/resend_otp',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact_number: `+91${formData.contactNumber}`,
          }),
        }
      )

      const data = await response.json()
      if (response.ok) {
        alert('New OTP sent!')
        setCooldown(60)
      } else {
        alert(data.error)
      }
    } catch (error) {
      console.error('Resend OTP error:', error)
      alert('Failed to resend OTP')
    }
  }

  // Countdown for button
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])

  // Cleanup timeout on component unmount
  useEffect(() => {
    return () => {
      if (usernameValidationTimeout) {
        clearTimeout(usernameValidationTimeout)
      }
    }
  }, [usernameValidationTimeout])

  const handleVerifyOtp = async () => {
    const response = await fetch('http://localhost:8000/dispatch/verify_otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_number: `+91${formData.contactNumber}`,
        otp: otp,
      }),
    })

    const data = await response.json()
    if (response.ok) {
      alert('Dispatch unit registered successfully!')
      // navigate('/dispatch/login') - would be used with router
      window.location.href = '/dispatch/login'
    } else {
      alert(data.error || 'Invalid OTP')
    }
  }

  const handleBackToHome = () => {
    window.location.href = '/'
  }

  const handleGoToLogin = () => {
    window.location.href = '/dispatch/login'
  }

  const getUsernameInputClasses = () => {
    let classes = []
    if (errors.username) classes.push('error')
    if (usernameCheckLoading) classes.push('checking')
    if (formData.username && !errors.username && formData.username.length >= 8)
      classes.push('success')
    return classes.join(' ')
  }

  return (
    <div className="dispatch-register-page">
      <div className="dispatch-register-container">
        <div className="dispatch-header">
          <button onClick={handleBackToHome} className="dispatch-back-btn">
            ← Back to Home
          </button>
          <div className="dispatch-logo">
            <div className="emergency-icon">🚨</div>
            <h1>Emergency Dispatch Unit Registration</h1>
          </div>
        </div>

        <div className="dispatch-card">
          <div className="dispatch-card-header">
            <h2>Register Dispatch Unit</h2>
            <p>
              Join our emergency response network to coordinate and respond to
              emergencies efficiently
            </p>
          </div>

          <form onSubmit={handleSubmit} className="dispatch-form">
            {/* Department Information */}
            <div className="dispatch-section">
              <h3>Department Information</h3>
              <div className="dispatch-form-row">
                <div className="dispatch-form-group">
                  <label>Department/Agency Name *</label>
                  <input
                    type="text"
                    name="departmentName"
                    value={formData.departmentName}
                    onChange={handleChange}
                    placeholder="Enter department name"
                    className={errors.departmentName ? 'error' : ''}
                  />
                  {errors.departmentName && (
                    <span className="dispatch-error-message">
                      {errors.departmentName}
                    </span>
                  )}
                </div>

                <div className="dispatch-form-group">
                  <label>Unit Type *</label>
                  <select
                    name="unitType"
                    value={formData.unitType}
                    onChange={handleChange}
                    className={errors.unitType ? 'error' : ''}
                  >
                    <option value="">Select unit type</option>
                    {unitTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  {errors.unitType && (
                    <span className="dispatch-error-message">
                      {errors.unitType}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Location Information */}
            <div className="dispatch-section">
              <h3>Location Information</h3>
              <div className="dispatch-form-row">
                <div className="dispatch-form-group">
                  <label>Place/Area *</label>
                  <input
                    type="text"
                    name="place"
                    value={formData.place}
                    onChange={handleChange}
                    placeholder="Enter place/area name"
                    className={errors.place ? 'error' : ''}
                  />
                  {errors.place && (
                    <span className="dispatch-error-message">
                      {errors.place}
                    </span>
                  )}
                </div>

                <div className="dispatch-form-group">
                  <label>District *</label>
                  <input
                    type="text"
                    name="district"
                    value={formData.district}
                    onChange={handleChange}
                    placeholder="Enter district"
                    className={errors.district ? 'error' : ''}
                  />
                  {errors.district && (
                    <span className="dispatch-error-message">
                      {errors.district}
                    </span>
                  )}
                </div>
              </div>

              <div className="dispatch-form-row">
                <div className="dispatch-form-group">
                  <label>State *</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="Enter state"
                    className={errors.state ? 'error' : ''}
                  />
                  {errors.state && (
                    <span className="dispatch-error-message">
                      {errors.state}
                    </span>
                  )}
                </div>

                <div className="dispatch-form-group">
                  <label>Pincode *</label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    placeholder="Enter 6-digit pincode"
                    maxLength="6"
                    className={errors.pincode ? 'error' : ''}
                  />
                  {errors.pincode && (
                    <span className="dispatch-error-message">
                      {errors.pincode}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="dispatch-section">
              <h3>Account Information</h3>
              <div className="dispatch-form-row">
                <div className="dispatch-form-group">
                  <label>Username *</label>
                  <div className="dispatch-username-container">
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      placeholder="Enter username (min 8 characters)"
                      className={getUsernameInputClasses()}
                      autoComplete="username"
                    />
                    {usernameCheckLoading && (
                      <div className="dispatch-username-status">
                        <div className="dispatch-loading-spinner-small"></div>
                      </div>
                    )}
                    {!usernameCheckLoading &&
                      formData.username &&
                      !errors.username &&
                      formData.username.length >= 8 && (
                        <div className="dispatch-username-status success">
                          ✓
                        </div>
                      )}
                  </div>
                  {errors.username && (
                    <span className="dispatch-error-message">
                      {errors.username}
                    </span>
                  )}
                  <div className="dispatch-username-help">
                    Username must be at least 8 characters long, contain at
                    least one letter, and can include numbers, underscores, or
                    hyphens.
                  </div>
                </div>

                <div className="dispatch-form-group">
                  <label>Official Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter official email address"
                    className={errors.email ? 'error' : ''}
                  />
                  {errors.email && (
                    <span className="dispatch-error-message">
                      {errors.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="dispatch-section">
              <h3>Contact Information</h3>
              <div className="dispatch-form-row">
                <div className="dispatch-form-group">
                  <label>Primary Contact Number *</label>
                  <input
                    type="tel"
                    name="contactNumber"
                    value={formData.contactNumber}
                    onChange={handleChange}
                    placeholder="Enter 10-digit contact number"
                    maxLength="10"
                    className={errors.contactNumber ? 'error' : ''}
                  />
                  {errors.contactNumber && (
                    <span className="dispatch-error-message">
                      {errors.contactNumber}
                    </span>
                  )}
                </div>

                <div className="dispatch-form-group">
                  <label>Alternate Contact Number</label>
                  <input
                    type="tel"
                    name="alternateContactNumber"
                    value={formData.alternateContactNumber}
                    onChange={handleChange}
                    placeholder="Enter alternate contact number"
                    maxLength="10"
                    className={errors.alternateContactNumber ? 'error' : ''}
                  />
                  {errors.alternateContactNumber && (
                    <span className="dispatch-error-message">
                      {errors.alternateContactNumber}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Officer Information */}
            <div className="dispatch-section">
              <h3>Officer-in-Charge Information</h3>
              <div className="dispatch-form-row">
                <div className="dispatch-form-group">
                  <label>Officer-in-Charge Name *</label>
                  <input
                    type="text"
                    name="officerInCharge"
                    value={formData.officerInCharge}
                    onChange={handleChange}
                    placeholder="Enter officer-in-charge full name"
                    className={errors.officerInCharge ? 'error' : ''}
                  />
                  {errors.officerInCharge && (
                    <span className="dispatch-error-message">
                      {errors.officerInCharge}
                    </span>
                  )}
                </div>

                <div className="dispatch-form-group">
                  <label>Officer Contact Number *</label>
                  <input
                    type="tel"
                    name="officerContact"
                    value={formData.officerContact}
                    onChange={handleChange}
                    placeholder="Enter officer contact number"
                    maxLength="10"
                    className={errors.officerContact ? 'error' : ''}
                  />
                  {errors.officerContact && (
                    <span className="dispatch-error-message">
                      {errors.officerContact}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Vehicle Information */}
            <div className="dispatch-section">
              <h3>Vehicle Information</h3>
              <div className="dispatch-form-row">
                <div className="dispatch-form-group">
                  <label>Number of Vehicles</label>
                  <input
                    type="number"
                    name="vehicleCount"
                    value={formData.vehicleCount}
                    onChange={handleChange}
                    placeholder="Enter number of vehicles"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Security */}
            <div className="dispatch-section">
              <h3>Account Security</h3>
              <div className="dispatch-form-row">
                <div className="dispatch-form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Create a strong password"
                    className={errors.password ? 'error' : ''}
                    autoComplete="new-password"
                  />
                  {errors.password && (
                    <span className="dispatch-error-message">
                      {errors.password}
                    </span>
                  )}
                </div>

                <div className="dispatch-form-group">
                  <label>Confirm Password *</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    className={errors.confirmPassword ? 'error' : ''}
                    autoComplete="new-password"
                  />
                  {errors.confirmPassword && (
                    <span className="dispatch-error-message">
                      {errors.confirmPassword}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="dispatch-submit-container">
              <button
                type="submit"
                disabled={isLoading || usernameCheckLoading}
                className="dispatch-submit-btn"
              >
                {isLoading && <div className="dispatch-loading-spinner"></div>}
                {isLoading ? 'Registering Unit...' : 'Register Dispatch Unit'}
              </button>
            </div>
          </form>

          <div className="dispatch-login-link">
            <p>
              Already have an account?{' '}
              <button onClick={handleGoToLogin} className="dispatch-link-btn">
                Sign in here
              </button>
            </p>
          </div>
        </div>
      </div>

      {showOtpPopup && (
        <div className="dispatch-otp-popup">
          <div className="dispatch-otp-content">
            <h3>Enter OTP</h3>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter 6-digit OTP"
              className="dispatch-otp-input"
            />
            <div className="dispatch-otp-actions">
              <button
                onClick={handleVerifyOtp}
                className="dispatch-otp-btn dispatch-otp-verify"
              >
                Verify OTP
              </button>
              <button
                onClick={handleResendOtp}
                disabled={cooldown > 0}
                className="dispatch-otp-btn dispatch-otp-resend"
              >
                {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
