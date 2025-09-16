import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import './Location.css';

function Location() {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [savedLocations, setSavedLocations] = useState([]);
  const [sharing, setSharing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showSendLocationModal, setShowSendLocationModal] = useState(false);
  const [routePincode, setRoutePincode] = useState('');
  const [selectedContact, setSelectedContact] = useState('');
  const [routeLoading, setRouteLoading] = useState(false);
  const [sendingLocation, setSendingLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: '',
    address: '',
    lat: '',
    lng: ''
  });
  const navigate = useNavigate();

  // Custom hook to fly map when location updates
  function FlyToCurrentLocation({ location }) {
    const map = useMap();
    useEffect(() => {
      if (location) {
        map.flyTo([location.lat, location.lng], 15);
      }
    }, [location, map]);
    return null;
  }
  const cleanAddressAdvanced = (address) => {
  if (!address) return address;
  
  const parts = address.split(',').map(part => part.trim());
  const uniqueParts = [];
  const seenParts = new Set();
  
  for (const part of parts) {
    const normalizedPart = part.toLowerCase().replace(/\s+/g, ' ');
    
    if (!seenParts.has(normalizedPart)) {
      seenParts.add(normalizedPart);
      uniqueParts.push(part);
    }
  }
  
  return uniqueParts.join(', ');
};
  // Geocoding function
  const geocodeAddress = async (address) => {
    console.log('Geocoding address:', address);
    
    const pincodeMatch = address.match(/(\d{6})/);
    
    if (pincodeMatch) {
      const pincode = pincodeMatch[1];
      console.log('Found pincode:', pincode);
      
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${pincode}&countrycodes=IN&limit=1`
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
          console.log('✅ Found coordinates using pincode:', pincode);
          return {
            latitude: parseFloat(data[0].lat),
            longitude: parseFloat(data[0].lon)
          };
        }
      } catch (error) {
        console.log('❌ Pincode geocoding failed, trying full address');
      }
    }
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=IN&limit=1`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        console.log('✅ Found coordinates using full address');
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon)
        };
      }
    } catch (error) {
      console.error('Full address geocoding failed:', error);
    }
    
    throw new Error('Address not found');
  };

  // Fetch saved locations
  const fetchSavedLocations = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://localhost:8000/locations", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch locations");

      setSavedLocations(data.locations || []);
    } catch (err) {
      console.error("Error fetching saved locations:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle setting emergency location using existing update_location route
  const handleSetEmergencyLocation = async (location) => {
    try {
      setLoading(true);
      let latitude = location.latitude;
      let longitude = location.longitude;

      if (!latitude || !longitude || latitude === '' || longitude === '') {
        if (!location.address) {
          alert('❌ Address is required to set emergency location');
          return;
        }

        try {
          console.log('Geocoding address:', location.address);
          const coordinates = await geocodeAddress(location.address);
          latitude = coordinates.latitude;
          longitude = coordinates.longitude;
          
          alert('✅ Coordinates found for this location!');
        } catch (geocodeError) {
          alert('❌ Could not find coordinates for this address. Please check the address or add coordinates manually.');
          return;
        }
      }

      const res = await fetch("http://localhost:8000/update_location", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          latitude: latitude,
          longitude: longitude,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set emergency location");
      
      alert(`✅ ${location.name} has been set as your emergency location!`);
      
    } catch (error) {
      console.error('Error setting emergency location:', error);
      alert('❌ Failed to set emergency location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Add new location
  const handleAddLocation = async (e) => {
    e.preventDefault();
    
    if (!newLocation.name || !newLocation.address) {
      alert('Please fill name and address fields');
      return;
    }

    try {
      const payload = {
        name: newLocation.name,
        address: newLocation.address
      };

      if (newLocation.lat && newLocation.lng) {
        payload.latitude = parseFloat(newLocation.lat);
        payload.longitude = parseFloat(newLocation.lng);
      }

      const res = await fetch("http://localhost:8000/locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add location");

      alert("✅ Location added successfully!");
      setShowAddLocationModal(false);
      setNewLocation({ name: '', address: '', lat: '', lng: '' });
      fetchSavedLocations();
    } catch (err) {
      console.error("Error adding location:", err);
      alert("❌ Failed to add location");
    }
  };

  // Delete location
  const handleDeleteLocation = async (locationId) => {
    if (locationId === 'home') {
      alert('Cannot delete home address. Update it through your profile.');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this location?')) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:8000/locations/${locationId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete location");

      alert("✅ Location deleted successfully!");
      fetchSavedLocations();
    } catch (err) {
      console.error("Error deleting location:", err);
      alert("❌ Failed to delete location");
    }
  };

  // Handle route search
  const handleRouteSearch = async () => {
    if (!routePincode || routePincode.length !== 6) {
      alert('Please enter a valid 6-digit pincode');
      return;
    }

    if (!currentLocation) {
      alert('Please enable location services first');
      return;
    }

    try {
      setRouteLoading(true);
      const res = await fetch("http://localhost:8000/route/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          fromLat: currentLocation.lat,
          fromLng: currentLocation.lng,
          toPincode: routePincode
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get route");

      // Open route in Google Maps
      const googleMapsUrl = `https://www.google.com/maps/dir/${currentLocation.lat},${currentLocation.lng}/${data.destination.lat},${data.destination.lng}`;
      window.open(googleMapsUrl, '_blank');
      
      setShowRouteModal(false);
      setRoutePincode('');
    } catch (error) {
      console.error('Error getting route:', error);
      alert('❌ Failed to get route. Please try again.');
    } finally {
      setRouteLoading(false);
    }
  };

  // Handle sending location via SMS
  const handleSendLocation = async () => {
    if (!selectedContact) {
      alert('Please select a contact');
      return;
    }

    if (!currentLocation) {
      alert('Please enable location services first');
      return;
    }

    try {
      setSendingLocation(true);
      const res = await fetch("http://localhost:8000/location/send-sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          contactId: selectedContact,
          latitude: currentLocation.lat,
          longitude: currentLocation.lng
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send location");

      alert(`✅ Location sent to ${data.contactName} via SMS!`);
      setShowSendLocationModal(false);
      setSelectedContact('');
    } catch (error) {
      console.error('Error sending location:', error);
      alert('❌ Failed to send location. Please try again.');
    } finally {
      setSendingLocation(false);
    }
  };

  // Use current location for new location form
  const useCurrentLocationForForm = () => {
    if (currentLocation) {
      setNewLocation(prev => ({
        ...prev,
        lat: currentLocation.lat.toString(),
        lng: currentLocation.lng.toString()
      }));
    } else {
      alert('Please enable location first');
    }
  };

  const handleEnableLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation(coords);
          setLocationEnabled(true);
        },
        () => {
          alert('Location access denied. Please enable location services.');
        }
      );
    }
  };

  const handleShareLocation = async () => {
    if (!currentLocation) return;

    setSharing(true);
    try {
      const res = await fetch("http://localhost:8000/update_location", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error updating location");

      alert("✅ Location updated successfully!");
      console.log("Updated user:", data.user);
    } catch (err) {
      console.error("Error:", err);
      alert("❌ Failed to update location");
    } finally {
      setSharing(false);
    }
  };

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await fetch("http://localhost:8000/profile/me", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Failed to fetch contacts");

        const contacts = [];

        if (data.primary_emergency_contact && data.primary_emergency_phone) {
          contacts.push({
            id: 1,
            name: data.primary_emergency_contact,
            phone: data.primary_emergency_phone,
            relationship: data.primary_emergency_relation || "Primary",
          });
        }

        if (data.secondary_emergency_contact && data.secondary_emergency_phone) {
          contacts.push({
            id: 2,
            name: data.secondary_emergency_contact,
            phone: data.secondary_emergency_phone,
            relationship: data.secondary_emergency_relation || "Secondary",
          });
        }

        setEmergencyContacts(contacts);
      } catch (err) {
        console.error("Error fetching emergency contacts:", err);
      }
    };

    fetchContacts();
    fetchSavedLocations();
  }, []);

  const handleEmergencyCall = async (contact) => {  // Accept contact parameter
  try {
    const res = await fetch("http://localhost:8000/emergency/call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        contactId: contact.id  // Send which contact to call (1 or 2)
      }),
    });

    const data = await res.json();
    if (data.success) {
      alert(`Calling ${contact.name}... (Call SID: ${data.sid})`);
    } else {
      alert("Failed: " + data.error);
    }
  } catch (err) {
    console.error("Error:", err);
    alert("Error making call");
  }
};

  // Leaflet icons
  const homeIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/25/25694.png',
    iconSize: [32, 32],
  });

  const workIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1077/1077976.png',
    iconSize: [32, 32],
  });

  const userIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/149/149060.png',
    iconSize: [32, 32],
  });

  // Get appropriate icon based on location name
  const getLocationIcon = (locationName) => {
    if (locationName.toLowerCase().includes('home')) return homeIcon;
    if (locationName.toLowerCase().includes('work') || locationName.toLowerCase().includes('office')) return workIcon;
    return workIcon;
  };

  // Filter locations that have coordinates for map display
  const locationsWithCoordinates = savedLocations.filter(
    loc => loc.latitude != null && loc.longitude != null && 
           loc.latitude !== '' && loc.longitude !== ''
  );

  return (
    <div className="location-page">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="logo-section">
              <div className="logo"><span className="shield-icon">🛡️</span></div>
              <div className="logo-text">
                <h1>Emergency Response System</h1>
                <p>Location Services</p>
              </div>
            </div>
            <div className="header-actions">
              <button className="back-btn" onClick={() => navigate('/')}>← Back to Home</button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="navigation">
        <div className="container">
          <div className="nav-links">
            <button className="nav-link" onClick={() => navigate('/')}>Emergency</button>
            <button className="nav-link" onClick={() => navigate('/profile')}>Profile</button>
            <button className="nav-link active">Location</button>
            <button className="nav-link" onClick={() => navigate('/dashboard')}>Dashboard</button>
        
          </div>
        </div>
      </nav>

      {/* Add Location Modal */}
      {showAddLocationModal && (
        <div className="modal-overlay" onClick={() => setShowAddLocationModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Location</h3>
            <form onSubmit={handleAddLocation}>
              <div className="form-group">
                <label>Location Name:</label>
                <input
                  type="text"
                  value={newLocation.name}
                  onChange={(e) => setNewLocation({...newLocation, name: e.target.value})}
                  placeholder="e.g., Home, Work, Hospital"
                  required
                />
              </div>
              <div className="form-group">
                <label>Address:</label>
                <input
                  type="text"
                  value={newLocation.address}
                  onChange={(e) => setNewLocation({...newLocation, address: e.target.value})}
                  placeholder="Full address"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Latitude (optional):</label>
                  <input
                    type="number"
                    step="any"
                    value={newLocation.lat}
                    onChange={(e) => setNewLocation({...newLocation, lat: e.target.value})}
                    placeholder="e.g., 40.7128"
                  />
                </div>
                <div className="form-group">
                  <label>Longitude (optional):</label>
                  <input
                    type="number"
                    step="any"
                    value={newLocation.lng}
                    onChange={(e) => setNewLocation({...newLocation, lng: e.target.value})}
                    placeholder="e.g., -74.0060"
                  />
                </div>
              </div>
              <button type="button" onClick={useCurrentLocationForForm} className="use-current-btn">
                Use Current Location
              </button>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowAddLocationModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Add Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Route Search Modal */}
      {showRouteModal && (
        <div className="modal-overlay" onClick={() => setShowRouteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>🗺️ Search Route to Location</h3>
            <div className="form-group">
              <label>Enter destination pincode:</label>
              <input
                type="text"
                value={routePincode}
                onChange={(e) => setRoutePincode(e.target.value)}
                placeholder="e.g., 560001"
                maxLength={6}
                pattern="\d{6}"
              />
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowRouteModal(false)} className="cancel-btn">
                Cancel
              </button>
              <button 
                onClick={handleRouteSearch} 
                disabled={routeLoading}
                className="submit-btn"
              >
                {routeLoading ? 'Searching...' : 'Get Route'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Location Modal */}
      {showSendLocationModal && (
        <div className="modal-overlay" onClick={() => setShowSendLocationModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>📱 Send Location via SMS</h3>
            <div className="form-group">
              <label>Select contact:</label>
              <select 
                value={selectedContact} 
                onChange={(e) => setSelectedContact(e.target.value)}
              >
                <option value="">-- Select Contact --</option>
                {emergencyContacts.map(contact => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name} ({contact.relationship})
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowSendLocationModal(false)} className="cancel-btn">
                Cancel
              </button>
              <button 
                onClick={handleSendLocation} 
                disabled={sendingLocation}
                className="submit-btn"
              >
                {sendingLocation ? 'Sending...' : 'Send Location'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="main-content">
        <div className="container">
          <h2>Location Services</h2>

          {/* Location Status */}
          <section className="location-status">
            <div className="status-card">
              <h3>Location Status</h3>
              <p className={locationEnabled ? 'enabled' : 'disabled'}>
                {locationEnabled ? 'Location Enabled' : 'Location Disabled'}
              </p>
              {!locationEnabled ? (
                <button className='contact' onClick={handleEnableLocation}>Enable Location</button>
              ) : (
                <button onClick={handleShareLocation} disabled={sharing}>
                  {sharing ? 'Sharing...' : 'Share Location'}
                </button>
              )}
            </div>
          </section>

          {/* Map */}
          <section className="map-section">
            <h3>Live Map</h3>
            <MapContainer
              center={[40.7128, -74.0060]}
              zoom={13}
              scrollWheelZoom
              style={{ height: '400px', width: '100%', borderRadius: '10px' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />

              {/* Saved Locations - Only show locations with coordinates */}
              {locationsWithCoordinates.map(loc => (
                <Marker
                  key={loc.id}
                  position={[parseFloat(loc.latitude), parseFloat(loc.longitude)]}
                  icon={getLocationIcon(loc.name)}
                >
                  <Popup>
                    <b>{loc.name}</b><br />{loc.address}
                  </Popup>
                </Marker>
              ))}

              {/* Current Location */}
              {currentLocation && (
                <>
                  <Marker position={[currentLocation.lat, currentLocation.lng]} icon={userIcon}>
                    <Popup>📍 You are here</Popup>
                  </Marker>
                  <FlyToCurrentLocation location={currentLocation} />
                </>
              )}
            </MapContainer>
          </section>

          <section className="saved-locations">
            <h3>Saved Locations</h3>
            {loading ? (
              <p>Loading locations...</p>
            ) : (
              <div className="locations-grid">
                {savedLocations.map(location => (
                  <div key={location.id} className="location-card">
                    <div className="location-header">
                      <span className="location-icon">📍</span>
                      <h4>{location.name}</h4>
                      {!location.latitude && !location.longitude && (
                        <small style={{ color: '#f39c12' }}>(No coordinates)</small>
                      )}
                    </div>
                    <p className="location-address">{location.address}</p>
                    <div className="location-actions">
                      <button 
                        className="location-btn"
                        onClick={() => handleSetEmergencyLocation(location)}
                        disabled={loading}
                      >
                        {loading ? 'Setting...' : 'Set as Emergency Location'}
                      </button>
                      {location.id !== 'home' && (
                        <button 
                          className="delete-btn" 
                          onClick={() => handleDeleteLocation(location.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="location-card add-location" onClick={() => setShowAddLocationModal(true)}>
                  <div className="add-location-content">
                    <span className="add-icon">➕</span>
                    <h4>Add New Location</h4>
                    <p>Save important locations for quick access</p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Emergency Contacts */}
          <section className="emergency-contacts">
            <h3>Emergency Contacts</h3>
            <div className="contacts-grid">
              {emergencyContacts.map(contact => (
                <div key={contact.id} className="contact-card">
                  <h4>{contact.name}</h4>
                  <p>{contact.relationship}</p>
                  <p>{contact.phone}</p>
                  <button className='call-btn' onClick={() => handleEmergencyCall(contact)}>📞 Call</button>
                </div>
              ))}
            </div>
          </section>
          
          <section className="quick-actions">
            <h3>Location Actions</h3>
            <div className="quick-actions-grid">
              <button 
                className="quick-action-btn"
                onClick={() => setShowRouteModal(true)}
              >
                🗺️ View Route to Location
              </button>
              <button 
                className="quick-action-btn"
                onClick={() => setShowSendLocationModal(true)}
              >
                📱 Send Location to Contact
              </button>
            </div>
          </section>
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <p>© {new Date().getFullYear()} Emergency Response System | All Rights Reserved</p>
            <p className="footer-subtitle">Location services powered by secure GPS technology</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Location;