import React, { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './Login.css'

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    category: '',
    userType: 'user',
    rememberMe: false,
  })
  const navigate = useNavigate()

  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')

  // Enhanced dispatch categories with more specific unit types
  const dispatchCategories = [
    {
      value: 'police',
      label: 'Police Unit',
      icon: '🚔',
      description: 'Police Station, Traffic Police, Law Enforcement',
    },
    {
      value: 'fire',
      label: 'Fire Department',
      icon: '🚒',
      description: 'Fire Station, Fire and Rescue Services',
    },
    {
      value: 'medical',
      label: 'Medical Emergency',
      icon: '🚑',
      description: 'Hospital, Medical Center, Ambulance Service',
    },
  ]

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prevState) => ({
      ...prevState,
      [name]: type === 'checkbox' ? checked : value,
    }))

    // Clear specific field errors when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }

    // Clear general errors when user makes changes
    if (errors.general) {
      setErrors((prev) => ({ ...prev, general: '' }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (formData.userType === 'dispatch') {
      // Dispatch unit validation
      if (!formData.category) {
        newErrors.category = 'Please select a dispatch category'
      }

      if (!formData.username.trim()) {
        newErrors.username = 'Username is required'
      } else if (formData.username.trim().length < 3) {
        newErrors.username = 'Username must be at least 3 characters'
      }

      if (!formData.password) {
        newErrors.password = 'Password is required'
      } else if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters'
      }
    } else {
      // Regular user/admin validation
      if (!formData.email.trim()) {
        newErrors.email = 'Email is required'
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(formData.email)) {
          newErrors.email = 'Please enter a valid email address'
        }
      }

      if (!formData.password) {
        newErrors.password = 'Password is required'
      }
    }

    if (!formData.userType) {
      newErrors.userType = 'Please select user type'
    }

    return newErrors
  }

  // Enhanced user data storage and state update
  const updateApplicationState = (userData, userType, token) => {
    try {
      // Store in localStorage with proper error handling
      const userToStore = {
        ...userData,
        userType: userType,
        isAuthenticated: true,
        loginTime: new Date().toISOString(),
        ...(userType === 'admin' && { role: 'admin' }),
        ...(userType === 'dispatch' && {
          role: 'dispatch',
          category: formData.category,
        }),
      }

      localStorage.setItem('user', JSON.stringify(userToStore))
      localStorage.setItem('token', token)
      localStorage.setItem('userType', userType)
      localStorage.setItem('isAuthenticated', 'true')

      // Trigger a custom event for other components
      window.dispatchEvent(
        new CustomEvent('userLogin', {
          detail: { user: userToStore, userType, token },
        })
      )

      console.log('✅ User data stored successfully:', userToStore)
      return Promise.resolve()
    } catch (error) {
      console.error('❌ Error updating application state:', error)
      return Promise.reject(error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsLoading(true)
    setErrors({})

    try {
      let endpoint
      let requestBody

      // Determine endpoint and request body based on user type
      if (formData.userType === 'admin') {
        endpoint = 'http://localhost:8000/admin/login'
        requestBody = {
          email: formData.email.trim(),
          password: formData.password,
        }
      } else if (formData.userType === 'dispatch') {
        endpoint = 'http://localhost:8000/dispatch/login'
        requestBody = {
          username: formData.username.trim(),
          password: formData.password,
          category: formData.category,
        }
      } else {
        endpoint = 'http://localhost:8000/login'
        requestBody = {
          email: formData.email.trim(),
          password: formData.password,
          userType: formData.userType,
        }
      }

      console.log(`🔄 Attempting ${formData.userType} login to:`, endpoint)
      console.log('📤 Request body:', { ...requestBody, password: '[HIDDEN]' })

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()
      console.log('📄 Server response status:', response.status)

      if (response.ok && data.token) {
        let userData, userType

        // Extract user data based on response structure
        if (formData.userType === 'admin') {
          userData = data.admin
          userType = 'admin'
        } else if (formData.userType === 'dispatch') {
          userData = data.dispatch
          userType = 'dispatch'
        } else {
          userData = data.user
          userType = 'user'
        }

        console.log('✅ Login successful, user data:', userData)

        // Update application state
        await updateApplicationState(userData, userType, data.token)

        // Create personalized welcome message
        let welcomeMessage
        if (formData.userType === 'admin') {
          welcomeMessage = `Admin login successful! Welcome back${
            userData?.first_name ? `, ${userData.first_name}` : ''
          }.`
        } else if (formData.userType === 'dispatch') {
          const categoryInfo = dispatchCategories.find(
            (cat) => cat.value === formData.category
          )
          welcomeMessage = `Dispatch login successful! Welcome to ${
            categoryInfo?.label || formData.category
          } unit${
            userData?.department_name ? ` - ${userData.department_name}` : ''
          }.`
        } else {
          welcomeMessage = `Login successful! Welcome back${
            userData?.first_name ? `, ${userData.first_name}` : ''
          }.`
        }

        // Show success message
        alert(welcomeMessage)

        // Navigate to appropriate dashboard
        console.log(`🧭 Navigating to dashboard...`)

        if (formData.userType === 'admin') {
          navigate('/admin-dashboard', { replace: true })
        } else if (formData.userType === 'dispatch') {
          navigate('/dispatch-dashboard', { replace: true })
        } else {
          navigate('/', { replace: true })
        }

        // Small delay then reload to ensure state is updated
        setTimeout(() => {
          window.location.reload()
        }, 100)
      } else {
        console.error('❌ Login failed:', data)
        handleLoginError(data, formData.userType)
      }
    } catch (err) {
      console.error('💥 Login error:', err)
      setErrors({
        general: `Connection error. Please check your internet connection and try again.`,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoginError = (data, userType) => {
    const errorMessage = data.error || data.message || 'Invalid credentials'

    if (userType === 'admin') {
      if (errorMessage.includes('deactivated')) {
        setErrors({
          general:
            'Your admin account has been deactivated. Please contact the super administrator.',
        })
      } else if (errorMessage.includes('Invalid email or password')) {
        setErrors({
          general:
            'Invalid admin credentials. Please check your email and password.',
        })
      } else {
        setErrors({ general: errorMessage })
      }
    } else if (userType === 'dispatch') {
      if (errorMessage.includes('deactivated')) {
        setErrors({
          general:
            'Your dispatch unit has been deactivated. Please contact your supervisor.',
        })
      } else if (errorMessage.includes('Invalid username or password')) {
        setErrors({
          general:
            'Invalid dispatch credentials. Please check your username and password.',
        })
      } else if (errorMessage.includes('category')) {
        setErrors({
          general:
            'Category mismatch. Please select the correct category for your unit type.',
        })
      } else {
        setErrors({ general: errorMessage })
      }
    } else {
      if (errorMessage.includes('not verified')) {
        setErrors({
          general: 'Please verify your email address before logging in.',
        })
      } else {
        setErrors({ general: errorMessage })
      }
    }
  }

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault()

    if (!forgotEmail.trim()) {
      alert('Please enter your email')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(forgotEmail)) {
      alert('Please enter a valid email')
      return
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: 'http://localhost:3000/reset-password',
      })

      if (error) {
        alert(error.message)
      } else {
        alert('Password reset instructions sent to your email!')
        setShowForgotPassword(false)
        setForgotEmail('')
      }
    } catch (err) {
      console.error('Password reset error:', err)
      alert('Failed to send reset email. Please try again.')
    }
  }

  const handleBackToHome = () => navigate('/')
  const handleGoToRegister = () => navigate('/register')
  const handleGoToDispatchRegister = () => navigate('/dispatchregister')

  const getUserTypeDescription = () => {
    switch (formData.userType) {
      case 'admin':
        return 'Admin sign-in to access system management dashboard'
      case 'dispatch':
        return 'Dispatch unit sign-in to manage emergency responses'
      default:
        return 'Sign in to access your emergency response dashboard'
    }
  }

  const getSelectedCategoryInfo = () => {
    if (formData.userType === 'dispatch' && formData.category) {
      return dispatchCategories.find((cat) => cat.value === formData.category)
    }
    return null
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <button className="back-btn" onClick={handleBackToHome}>
            ← Back to Home
          </button>
          <div className="login-logo">
            <span className="shield-icon">🛡️</span>
            <h1>Emergency Response System</h1>
          </div>
        </div>

        <div className="login-content">
          <div className="login-main">
            <div className="login-card">
              <div className="card-header">
                <h2>Welcome Back</h2>
                <p>{getUserTypeDescription()}</p>
                {getSelectedCategoryInfo() && (
                  <div className="category-info">
                    <span className="category-icon">
                      {getSelectedCategoryInfo().icon}
                    </span>
                    <span className="category-description">
                      {getSelectedCategoryInfo().description}
                    </span>
                  </div>
                )}
              </div>

              {errors.general && (
                <div className="alert alert-error">
                  <span className="alert-icon">⚠️</span>
                  {errors.general}
                </div>
              )}

              <form className="login-form" onSubmit={handleSubmit}>
                {/* User Type Selection */}
                <div className="form-group">
                  <label>User Type</label>
                  <div className="user-type-selector">
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="userType"
                        value="user"
                        checked={formData.userType === 'user'}
                        onChange={handleChange}
                      />
                      <span className="radio-custom"></span>
                      <span className="radio-text">
                        <span className="user-icon">👤</span>
                        <span>User</span>
                      </span>
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="userType"
                        value="dispatch"
                        checked={formData.userType === 'dispatch'}
                        onChange={handleChange}
                      />
                      <span className="radio-custom"></span>
                      <span className="radio-text">
                        <span className="dispatch-icon">🚨</span>
                        <span>Dispatch</span>
                      </span>
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="userType"
                        value="admin"
                        checked={formData.userType === 'admin'}
                        onChange={handleChange}
                      />
                      <span className="radio-custom"></span>
                      <span className="radio-text">
                        <span className="admin-icon">⚙️</span>
                        <span>Admin</span>
                      </span>
                    </label>
                  </div>
                  {errors.userType && (
                    <span className="error-message">{errors.userType}</span>
                  )}
                </div>

                {/* Dispatch Unit Category Selection */}
                {formData.userType === 'dispatch' && (
                  <div className="form-group">
                    <label>Dispatch Category</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className={errors.category ? 'error' : ''}
                    >
                      <option value="">Select your dispatch category</option>
                      {dispatchCategories.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.icon} {category.label}
                        </option>
                      ))}
                    </select>
                    {errors.category && (
                      <span className="error-message">{errors.category}</span>
                    )}
                    {formData.category && (
                      <div className="category-help-text">
                        {
                          dispatchCategories.find(
                            (cat) => cat.value === formData.category
                          )?.description
                        }
                      </div>
                    )}
                  </div>
                )}

                {/* Username field for dispatch units */}
                {formData.userType === 'dispatch' ? (
                  <div className="form-group">
                    <label>Username</label>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      className={errors.username ? 'error' : ''}
                      placeholder="Enter your dispatch username"
                      autoComplete="username"
                    />
                    {errors.username && (
                      <span className="error-message">{errors.username}</span>
                    )}
                  </div>
                ) : (
                  /* Email field for users and admins */
                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={errors.email ? 'error' : ''}
                      placeholder={
                        formData.userType === 'admin'
                          ? 'Enter your admin email address'
                          : 'Enter your email address'
                      }
                      autoComplete="email"
                    />
                    {errors.email && (
                      <span className="error-message">{errors.email}</span>
                    )}
                  </div>
                )}

                {/* Password field */}
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={errors.password ? 'error' : ''}
                    placeholder={
                      formData.userType === 'admin'
                        ? 'Enter your admin password'
                        : formData.userType === 'dispatch'
                        ? 'Enter your dispatch password'
                        : 'Enter your password'
                    }
                    autoComplete="current-password"
                  />
                  {errors.password && (
                    <span className="error-message">{errors.password}</span>
                  )}
                </div>

                {/* Form options */}
                <div className="form-options">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleChange}
                    />
                    <span className="checkmark"></span>
                    Remember me
                  </label>

                  {formData.userType === 'user' && (
                    <button
                      type="button"
                      className="forgot-password-btn"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="login2-btn"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner"></span>
                      Signing In...
                    </>
                  ) : (
                    `Sign In as ${
                      formData.userType === 'admin'
                        ? 'Admin'
                        : formData.userType === 'dispatch'
                        ? 'Dispatch Unit'
                        : 'User'
                    }`
                  )}
                </button>
              </form>

              {/* Registration links */}
              {formData.userType === 'user' && (
                <div className="register-link">
                  <p>
                    Don't have an account?{' '}
                    <button onClick={handleGoToRegister} className="link-btn">
                      Create one here
                    </button>
                  </p>
                </div>
              )}

              {formData.userType === 'admin' && (
                <div className="admin-register-note">
                  <p>
                    <small>
                      Admin accounts are created by super administrators only.
                    </small>
                  </p>
                </div>
              )}

              {formData.userType === 'dispatch' && (
                <div className="register-link">
                  <p>
                    Don't have an account?{' '}
                    <button
                      onClick={handleGoToDispatchRegister}
                      className="link-btn"
                    >
                      Create one here
                    </button>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Forgot Password Modal */}
        {showForgotPassword && formData.userType === 'user' && (
          <div
            className="modal-overlay"
            onClick={() => setShowForgotPassword(false)}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Reset Your Password</h3>
                <button
                  className="modal-close"
                  onClick={() => setShowForgotPassword(false)}
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <p>
                  Enter your email address and we'll send you instructions to
                  reset your password.
                </p>

                <form onSubmit={handleForgotPasswordSubmit}>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="Enter your email address"
                      autoFocus
                    />
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowForgotPassword(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      Send Reset Link
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Login
