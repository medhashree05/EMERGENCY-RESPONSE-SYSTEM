import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient' // <-- adjust path
import './Login.css'

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    userType: 'user', // Default to user
    rememberMe: false,
  })
  const navigate = useNavigate()

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

  const handleSubmit = async (e) => {
    e.preventDefault()

    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          userType: formData.userType,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        alert(
          `${
            formData.userType === 'admin' ? 'Admin' : 'User'
          } login successful! Welcome back.`
        )
        localStorage.setItem('user', JSON.stringify(data.user))
        localStorage.setItem('token', data.token)
        localStorage.setItem(
          'userType',
          data.user.userType || formData.userType
        )

        // Navigate based on user type
        if (data.user.userType === 'admin' || formData.userType === 'admin') {
          navigate('/admin-dashboard') // Navigate to admin dashboard
        } else {
          navigate('/') // Navigate to user dashboard
        }
      } else {
        setErrors({ general: data.error || 'Invalid credentials' })
      }
    } catch (err) {
      console.error('Login error:', err)
      setErrors({ general: 'Something went wrong. Please try again.' })
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
                <p>Sign in to access your emergency response dashboard</p>
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
                    placeholder="Enter your email address"
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
                    placeholder="Enter your password"
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

                  <button
                    type="button"
                    className="forgot-password-btn"
                    onClick={() => setShowForgotPassword(true)}
                  >
                    Forgot Password?
                  </button>
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

              <div className="register-link">
                <p>
                  Don't have an account?{' '}
                  <button onClick={handleGoToRegister} className="link-btn">
                    Create one here
                  </button>
                </p>
              </div>
            </div>

            {/* Quick Access - Only show for user type */}
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

            {/* Admin Info - Only show for admin type */}
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

        {/* Forgot Password Modal */}
        {showForgotPassword && (
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