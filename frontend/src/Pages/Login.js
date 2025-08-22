import React, { useState } from 'react';
import {useNavigate} from 'react-router-dom';
import './Login.css';

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const navigate = useNavigate();

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Required field validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else {
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      console.log('Login data:', formData);
      alert('Login successful! Welcome back.');
      
      // Reset form
      setFormData({
        email: '',
        password: '',
        rememberMe: false
      });
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ general: 'Invalid email or password. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (!forgotEmail.trim()) {
      alert('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotEmail)) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Password reset requested for:', forgotEmail);
      alert('Password reset instructions have been sent to your email.');
      
      setShowForgotPassword(false);
      setForgotEmail('');
    } catch (error) {
      console.error('Password reset error:', error);
      alert('Failed to send reset email. Please try again.');
    }
  };

  const handleBackToHome = () => {
    // Add navigation logic here
    console.log('Back to home clicked');
    navigate('/');
  };
   const handleTextChat = () => {
  navigate('/chat');
   };

  const handleGoToRegister = () => {
    // Add navigation logic here
    console.log('Go to register clicked');
    navigate('/register');
  };

  const handleQuickAccess = (type) => {
    console.log(`Quick access: ${type}`);
    // Add quick access logic here
  };

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
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={errors.email ? 'error' : ''}
                    placeholder="Enter your email address"
                    autoComplete="email"
                  />
                  {errors.email && <span className="error-message">{errors.email}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={errors.password ? 'error' : ''}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  {errors.password && <span className="error-message">{errors.password}</span>}
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
                    'Sign In'
                  )}
                </button>
              </form>

              <div className="register-link">
                <p>Don't have an account? <button onClick={handleGoToRegister} className="link-btn">Create one here</button></p>
              </div>
            </div>

            {/* Quick Access */}
            <div className="quick-access">
              <h3>Emergency Quick Access</h3>
              <p>For immediate emergencies, you can access these services without logging in:</p>
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
          </div>
        </div>

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="modal-overlay" onClick={() => setShowForgotPassword(false)}>
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
                <p>Enter your email address and we'll send you instructions to reset your password.</p>
                
                <form onSubmit={handleForgotPasswordSubmit}>
                  <div className="form-group">
                    <label htmlFor="forgotEmail">Email Address</label>
                    <input
                      type="email"
                      id="forgotEmail"
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
  );
}

export default Login;