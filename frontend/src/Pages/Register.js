import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Register.css'

function Register() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    // Primary Emergency Contact
    primaryEmergencyContact: '',
    primaryEmergencyPhone: '',
    primaryEmergencyRelation: '',
    // Secondary Emergency Contact
    secondaryEmergencyContact: '',
    secondaryEmergencyPhone: '',
    secondaryEmergencyRelation: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    medicalConditions: '',
    agreeToTerms: false,
    agreeToEmergencySharing: false,
  })
  const navigate = useNavigate()
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [showOtpPopup, setShowOtpPopup] = useState(false)
  const [otp, setOtp] = useState('')
  const [cooldown, setCooldown] = useState(0)
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
  }

  const validateForm = () => {
    const newErrors = {}

    // Required field validation
    if (!formData.firstName.trim())
      newErrors.firstName = 'First name is required'
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required'
    if (!formData.password) newErrors.password = 'Password is required'
    if (!formData.confirmPassword)
      newErrors.confirmPassword = 'Please confirm password'

    // Primary Emergency Contact validation (required)
    if (!formData.primaryEmergencyContact.trim())
      newErrors.primaryEmergencyContact =
        'Primary emergency contact is required'
    if (!formData.primaryEmergencyPhone.trim())
      newErrors.primaryEmergencyPhone = 'Primary emergency phone is required'
    if (!formData.primaryEmergencyRelation.trim())
      newErrors.primaryEmergencyRelation = 'Relationship is required'

    // Secondary Emergency Contact validation (optional, but if one field is filled, relation is required)
    if (
      (formData.secondaryEmergencyContact.trim() ||
        formData.secondaryEmergencyPhone.trim()) &&
      !formData.secondaryEmergencyRelation.trim()
    ) {
      newErrors.secondaryEmergencyRelation =
        'Relationship is required when contact info is provided'
    }
    if (
      formData.secondaryEmergencyContact.trim() &&
      !formData.secondaryEmergencyPhone.trim()
    ) {
      newErrors.secondaryEmergencyPhone =
        'Phone number is required when contact name is provided'
    }
    if (
      formData.secondaryEmergencyPhone.trim() &&
      !formData.secondaryEmergencyContact.trim()
    ) {
      newErrors.secondaryEmergencyContact =
        'Contact name is required when phone number is provided'
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    // Phone validation
    const phoneRegex = /^\d{10}$/
    if (formData.phone && !phoneRegex.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Please enter a valid 10-digit phone number'
    }
    if (
      formData.primaryEmergencyPhone &&
      !phoneRegex.test(formData.primaryEmergencyPhone.replace(/\D/g, ''))
    ) {
      newErrors.primaryEmergencyPhone =
        'Please enter a valid 10-digit phone number'
    }
    if (
      formData.secondaryEmergencyPhone &&
      !phoneRegex.test(formData.secondaryEmergencyPhone.replace(/\D/g, ''))
    ) {
      newErrors.secondaryEmergencyPhone =
        'Please enter a valid 10-digit phone number'
    }

    // Password validation
    if (formData.password && formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long'
    }

    // Password match validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    // Terms agreement validation
    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the terms and conditions'
    }

    if (!formData.agreeToEmergencySharing) {
      newErrors.agreeToEmergencySharing =
        'You must agree to emergency information sharing'
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

    setIsLoading(true)

    try {
      const response = await fetch('http://localhost:8000/send_otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: `+91${formData.phone}`,
          password: formData.password,
          primary_emergency_contact: formData.primaryEmergencyContact,
          primary_emergency_phone: formData.primaryEmergencyPhone,
          primary_emergency_relation: formData.primaryEmergencyRelation,
          secondary_emergency_contact:
            formData.secondaryEmergencyContact || null,
          secondary_emergency_phone: formData.secondaryEmergencyPhone || null,
          secondary_emergency_relation:
            formData.secondaryEmergencyRelation || null,
          street_address: formData.address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zipCode,
          medical_conditions: formData.medicalConditions || null,
          agree_to_terms: formData.agreeToTerms,
          agree_to_emergency_sharing: formData.agreeToEmergencySharing,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        alert('OTP sent to your mobile number')
        setShowOtpPopup(true) // open OTP popup
      } else {
        alert(data.detail || 'Failed to send OTP') // backend sends 'detail', not 'error'
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
      const response = await fetch('http://localhost:8000/resend_otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `+91${formData.phone}` }),
      })

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

  const handleVerifyOtp = async () => {
    const response = await fetch('http://localhost:8000/verify_otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: `+91${formData.phone}`,
        otp: otp,
      }),
    })

    const data = await response.json()
    if (response.ok) {
      alert('Registration successful!')
      navigate('/login') // redirect to login page
    } else {
      alert(data.error || 'Invalid OTP')
    }
  }

  const handleBackToHome = () => {
    // Add navigation logic here
    console.log('Back to home clicked')
    navigate('/')
  }

  const handleGoToLogin = () => {
    // Add navigation logic here
    console.log('Go to login clicked')
  }

  return (
    <div className="register-page">
      <div className="register-container">
        <div className="register-header">
          <button className="back-btn" onClick={handleBackToHome}>
            ← Back to Home
          </button>
          <div className="register-logo">
            <span className="shield-icon">🛡️</span>
            <h1>Emergency Response System</h1>
          </div>
        </div>

        <div className="register-content">
          <div className="register-card">
            <div className="card-header">
              <h2>Create Your Account</h2>
              <p>
                Join our emergency response network for immediate assistance
                when you need it most
              </p>
            </div>

            <form className="register-form" onSubmit={handleSubmit}>
              {/* Personal Information */}
              <div className="form-section">
                <h3>Personal Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="firstName">First Name *</label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className={errors.firstName ? 'error' : ''}
                      placeholder="Enter your first name"
                    />
                    {errors.firstName && (
                      <span className="error-message">{errors.firstName}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="lastName">Last Name *</label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className={errors.lastName ? 'error' : ''}
                      placeholder="Enter your last name"
                    />
                    {errors.lastName && (
                      <span className="error-message">{errors.lastName}</span>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="email">Email Address *</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={errors.email ? 'error' : ''}
                      placeholder="Enter your email address"
                    />
                    {errors.email && (
                      <span className="error-message">{errors.email}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="phone">Phone Number *</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className={errors.phone ? 'error' : ''}
                      placeholder="Enter your phone number"
                    />
                    {errors.phone && (
                      <span className="error-message">{errors.phone}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Security */}
              <div className="form-section">
                <h3>Security</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="password">Password *</label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={errors.password ? 'error' : ''}
                      placeholder="Create a strong password"
                    />
                    {errors.password && (
                      <span className="error-message">{errors.password}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirmPassword">Confirm Password *</label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className={errors.confirmPassword ? 'error' : ''}
                      placeholder="Confirm your password"
                    />
                    {errors.confirmPassword && (
                      <span className="error-message">
                        {errors.confirmPassword}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Primary Emergency Contact */}
              <div className="form-section">
                <h3>Primary Emergency Contact</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="primaryEmergencyContact">
                      Contact Name *
                    </label>
                    <input
                      type="text"
                      id="primaryEmergencyContact"
                      name="primaryEmergencyContact"
                      value={formData.primaryEmergencyContact}
                      onChange={handleChange}
                      className={errors.primaryEmergencyContact ? 'error' : ''}
                      placeholder="Primary emergency contact full name"
                    />
                    {errors.primaryEmergencyContact && (
                      <span className="error-message">
                        {errors.primaryEmergencyContact}
                      </span>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="primaryEmergencyPhone">
                      Contact Phone *
                    </label>
                    <input
                      type="tel"
                      id="primaryEmergencyPhone"
                      name="primaryEmergencyPhone"
                      value={formData.primaryEmergencyPhone}
                      onChange={handleChange}
                      className={errors.primaryEmergencyPhone ? 'error' : ''}
                      placeholder="Primary emergency contact phone"
                    />
                    {errors.primaryEmergencyPhone && (
                      <span className="error-message">
                        {errors.primaryEmergencyPhone}
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="primaryEmergencyRelation">
                    Relationship *
                  </label>
                  <select
                    id="primaryEmergencyRelation"
                    name="primaryEmergencyRelation"
                    value={formData.primaryEmergencyRelation}
                    onChange={handleChange}
                    className={errors.primaryEmergencyRelation ? 'error' : ''}
                  >
                    <option value="">Select relationship</option>
                    <option value="spouse">Spouse</option>
                    <option value="parent">Parent</option>
                    <option value="child">Child</option>
                    <option value="sibling">Sibling</option>
                    <option value="friend">Friend</option>
                    <option value="relative">Other Relative</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.primaryEmergencyRelation && (
                    <span className="error-message">
                      {errors.primaryEmergencyRelation}
                    </span>
                  )}
                </div>
              </div>

              {/* Secondary Emergency Contact */}
              <div className="form-section">
                <h3>Secondary Emergency Contact (Optional)</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="secondaryEmergencyContact">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      id="secondaryEmergencyContact"
                      name="secondaryEmergencyContact"
                      value={formData.secondaryEmergencyContact}
                      onChange={handleChange}
                      className={
                        errors.secondaryEmergencyContact ? 'error' : ''
                      }
                      placeholder="Secondary emergency contact full name"
                    />
                    {errors.secondaryEmergencyContact && (
                      <span className="error-message">
                        {errors.secondaryEmergencyContact}
                      </span>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="secondaryEmergencyPhone">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      id="secondaryEmergencyPhone"
                      name="secondaryEmergencyPhone"
                      value={formData.secondaryEmergencyPhone}
                      onChange={handleChange}
                      className={errors.secondaryEmergencyPhone ? 'error' : ''}
                      placeholder="Secondary emergency contact phone"
                    />
                    {errors.secondaryEmergencyPhone && (
                      <span className="error-message">
                        {errors.secondaryEmergencyPhone}
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="secondaryEmergencyRelation">
                    Relationship
                  </label>
                  <select
                    id="secondaryEmergencyRelation"
                    name="secondaryEmergencyRelation"
                    value={formData.secondaryEmergencyRelation}
                    onChange={handleChange}
                    className={errors.secondaryEmergencyRelation ? 'error' : ''}
                  >
                    <option value="">Select relationship</option>
                    <option value="spouse">Spouse</option>
                    <option value="parent">Parent</option>
                    <option value="child">Child</option>
                    <option value="sibling">Sibling</option>
                    <option value="friend">Friend</option>
                    <option value="relative">Other Relative</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.secondaryEmergencyRelation && (
                    <span className="error-message">
                      {errors.secondaryEmergencyRelation}
                    </span>
                  )}
                </div>
              </div>

              {/* Address Information */}
              <div className="form-section">
                <h3>Address Information</h3>
                <div className="form-group">
                  <label htmlFor="address">Street Address</label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Enter your street address"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="city">City</label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="Enter your city"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="state">State</label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      placeholder="Enter your state"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="zipCode">ZIP Code</label>
                    <input
                      type="text"
                      id="zipCode"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleChange}
                      placeholder="Enter ZIP code"
                    />
                  </div>
                </div>
              </div>

              {/* Medical Information */}
              <div className="form-section">
                <h3>Medical Information (Optional)</h3>
                <div className="form-group">
                  <label htmlFor="medicalConditions">Medical Conditions</label>
                  <textarea
                    id="medicalConditions"
                    name="medicalConditions"
                    value={formData.medicalConditions}
                    onChange={handleChange}
                    placeholder="List any medical conditions, allergies, or important medical information that emergency responders should know"
                    rows="3"
                  ></textarea>
                </div>
              </div>

              {/* Agreements */}
              <div className="form-section">
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="agreeToTerms"
                      checked={formData.agreeToTerms}
                      onChange={handleChange}
                    />
                    <span className="checkmark"></span>I agree to the{' '}
                    <a href="#" className="link">
                      Terms and Conditions
                    </a>{' '}
                    and{' '}
                    <a href="#" className="link">
                      Privacy Policy
                    </a>{' '}
                    *
                  </label>
                  {errors.agreeToTerms && (
                    <span className="error-message">{errors.agreeToTerms}</span>
                  )}
                </div>

                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="agreeToEmergencySharing"
                      checked={formData.agreeToEmergencySharing}
                      onChange={handleChange}
                    />
                    <span className="checkmark"></span>I consent to sharing my
                    information with emergency responders during emergencies *
                  </label>
                  {errors.agreeToEmergencySharing && (
                    <span className="error-message">
                      {errors.agreeToEmergencySharing}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="register2-btn"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner"></span>
                      Creating Account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </div>
            </form>

            <div className="login-link">
              <p>
                Already have an account?{' '}
                <button onClick={handleGoToLogin} className="link-btn">
                  Sign in here
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
      {showOtpPopup && (
        <div className="otp-popup">
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter OTP"
          />
          <button onClick={handleVerifyOtp}>Verify OTP</button>

          <button onClick={handleResendOtp} disabled={cooldown > 0}>
            {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
          </button>
        </div>
      )}
    </div>
  )
}

export default Register
