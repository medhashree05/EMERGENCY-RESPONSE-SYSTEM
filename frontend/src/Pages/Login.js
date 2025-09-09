import React, { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './Login.css'

// If you have a context for user state, import it here
// import { AuthContext } from '../context/AuthContext'
// import { UserContext } from '../context/UserContext'

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    userType: 'user',
    rememberMe: false,
  })
  const navigate = useNavigate()

  // If you have context, uncomment these:
  // const { setUser, setIsAuthenticated } = useContext(AuthContext)
  // const { updateUserData } = useContext(UserContext)

  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prevState) => ({
      ...prevState,
      [name]: type === 'checkbox' ? checked : value,
    }))

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

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

    if (!formData.userType) {
      newErrors.userType = 'Please select user type'
    }

    return newErrors
  }

  // Enhanced user data storage and state update
  const updateApplicationState = (userData, userType, token) => {
    try {
      // Store in localStorage
      localStorage.setItem('user', JSON.stringify(userData))
      localStorage.setItem('token', token)
      localStorage.setItem('userType', userType)
      localStorage.setItem('isAuthenticated', 'true')

      // If you have context providers, update them here:
      // setUser(userData)
      // setIsAuthenticated(true)
      // updateUserData(userData)

      // Trigger a custom event that other parts of your app can listen to
      window.dispatchEvent(new CustomEvent('userLogin', {
        detail: { user: userData, userType, token }
      }))

      // Force a small delay to ensure state propagation
      return new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.error('Error updating application state:', error)
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
      const endpoint =
        formData.userType === 'admin'
          ? 'http://localhost:8000/admin/login'
          : 'http://localhost:8000/login'

      console.log(`🔄 Attempting ${formData.userType} login to:`, endpoint)

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          ...(formData.userType === 'user' && { userType: formData.userType }),
        }),
      })

      const data = await response.json()
      console.log('📄 Server response:', data)

      if (response.ok) {
        const isAdmin = formData.userType === 'admin'
        const userData = isAdmin ? data.admin : data.user
        const userType = isAdmin ? 'admin' : 'user'

        console.log('✅ Login successful, user data:', userData)

        // Enhanced user data structure
        const userToStore = {
          ...userData,
          userType: userType,
          isAuthenticated: true,
          loginTime: new Date().toISOString(),
          ...(isAdmin && { role: 'admin' }),
        }

        console.log('💾 Storing user data:', userToStore)

        // Update application state first
        await updateApplicationState(userToStore, userType, data.token)

        alert(
          `${isAdmin ? 'Admin' : 'User'} login successful! Welcome back${
            userData?.first_name ? `, ${userData.first_name}` : ''
          }.`
        )

        console.log(`🧭 Navigating to ${isAdmin ? 'admin dashboard' : 'home'}...`)

        // Use replace instead of navigate to prevent back button issues
        if (isAdmin) {
          navigate('/admin-dashboard', { replace: true })
        } else {
          navigate('/', { replace: true })
        }

        // Alternative: Force a page reload after navigation (if other solutions don't work)
        // setTimeout(() => {
        //   window.location.reload()
        // }, 100)

      } else {
        console.error('❌ Login failed:', data)
        
        const errorMessage = data.error || data.message || 'Invalid credentials'

        if (formData.userType === 'admin') {
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
        } else {
          setErrors({ general: errorMessage })
        }
      }
    } catch (err) {
      console.error('💥 Login error:', err)
      setErrors({
        general: `${
          formData.userType === 'admin' ? 'Admin l' : 'L'
        }ogin failed. Please check your connection and try again.`,
      })
    } finally {
      setIsLoading(false)
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

    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: 'http://localhost:3000/reset-password',
    })

    if (error) {
      alert(error.message)
    } else {
      alert('Password reset instructions sent!')
      setShowForgotPassword(false)
    }
  }

  const handleBackToHome = () => navigate('/')
  const handleGoToRegister = () => navigate('/register')
  const handleTextChat = () => navigate('/chat')
  const handleQuickAccess = (type) => console.log(`Quick access: ${type}`)

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
                <p>
                  {formData.userType === 'admin'
                    ? 'Admin sign-in to access system management'
                    : 'Sign in to access your emergency response dashboard'}
                </p>
              </div>

              {errors.general && (
                <div className="alert alert-error">
                  <span className="alert-icon">⚠️</span>
                  {errors.general}
                </div>
              )}

              <form className="login-form" onSubmit={handleSubmit}>
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
                        User
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
                        Admin
                      </span>
                    </label>
                  </div>
                  {errors.userType && (
                    <span className="error-message">{errors.userType}</span>
                  )}
                </div>

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
                        : 'Enter your password'
                    }
                    autoComplete="current-password"
                  />
                  {errors.password && (
                    <span className="error-message">{errors.password}</span>
                  )}
                </div>

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

                  {formData.userType === 'admin' && (
                    <span className="admin-help-text">
                      Contact super admin for password reset
                    </span>
                  )}
                </div>

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
                      formData.userType === 'admin' ? 'Admin' : 'User'
                    }`
                  )}
                </button>
              </form>

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
            </div>

            {formData.userType === 'user' && (
              <div className="quick-access">
                <h3>Emergency Quick Access</h3>
                <p>
                  For immediate emergencies, you can access these services
                  without logging in:
                </p>
                <div className="quick-access-buttons">
                  <button
                    className="quick-btn emergency"
                    onClick={handleTextChat}
                  >
                    🚨 Emergency Chat
                  </button>
                  <button
                    className="quick-btn medical"
                    onClick={() => handleQuickAccess('medical')}
                  >
                    🏥 Medical Emergency
                  </button>
                  <button
                    className="quick-btn fire"
                    onClick={() => handleQuickAccess('fire')}
                  >
                    🔥 Fire Emergency
                  </button>
                  <button
                    className="quick-btn police"
                    onClick={() => handleQuickAccess('police')}
                  >
                    👮 Police Emergency
                  </button>
                </div>
              </div>
            )}

            {formData.userType === 'admin' && (
              <div className="admin-info">
                <h3>Admin Access</h3>
                <p>
                  You are signing in as an administrator. You will have access
                  to:
                </p>
                <div className="admin-features">
                  <div className="feature-item">
                    <span className="feature-icon">📊</span>
                    <span>System Analytics & Reports</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">👥</span>
                    <span>User Management</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">🚨</span>
                    <span>Emergency Response Monitoring</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">⚙️</span>
                    <span>System Configuration</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

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