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
  const [userProfile, setUserProfile] = useState(null);
  const [showRouteMapModal, setShowRouteMapModal] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState([]);
const [selectedDestination, setSelectedDestination] = useState(null);
const [routeData, setRouteData] = useState(null);
const [isSearching, setIsSearching] = useState(false);
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
  const fetchLocationData = async () => {
  try {
    setLoading(true);
    
    // Fetch saved locations
    const locationsRes = await fetch("http://localhost:8000/locations", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const locationsData = await locationsRes.json();
    if (!locationsRes.ok) throw new Error(locationsData.error || "Failed to fetch locations");

    // Fetch user profile (which contains home address)
    const profileRes = await fetch("http://localhost:8000/profile/me", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const profileData = await profileRes.json();
    if (!profileRes.ok) throw new Error(profileData.error || "Failed to fetch profile");

    // Set saved locations
    setSavedLocations(locationsData.locations || []);
    
    // Set user profile
    setUserProfile(profileData);
    
    // Create home location from profile if it exists and has coordinates
    if (profileData.address && profileData.latitude && profileData.longitude) {
      const homeLocation = {
        id: 'home',
        name: 'Home',
        address: profileData.address,
        latitude: profileData.latitude,
        longitude: profileData.longitude
      };
      
      // Add home to saved locations if it's not already there
      const hasHome = locationsData.locations.some(loc => loc.id === 'home');
      if (!hasHome) {
        setSavedLocations(prev => [homeLocation, ...prev]);
      }
    }
    
  } catch (err) {
    console.error("Error fetching location data:", err);
  } finally {
    setLoading(false);
  }
};
  const handleSetEmergencyLocation = async (location) => {
  try {
    setLoading(true);
    let latitude = location.latitude;
    let longitude = location.longitude;

    // Handle different coordinate formats
    if (typeof latitude === 'string') latitude = parseFloat(latitude);
    if (typeof longitude === 'string') longitude = parseFloat(longitude);

    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
      if (!location.address) {
        alert('Address is required to set emergency location');
        return;
      }

      try {
        console.log('Geocoding address:', location.address);
        const coordinates = await geocodeAddress(location.address);
        latitude = coordinates.latitude;
        longitude = coordinates.longitude;
        
        alert('Coordinates found for this location!');
      } catch (geocodeError) {
        alert('Could not find coordinates for this address. Please check the address or add coordinates manually.');
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
    
    alert(`${location.name} has been set as your emergency location!`);
    
  } catch (error) {
    console.error('Error setting emergency location:', error);
    alert('Failed to set emergency location. Please try again.');
  } finally {
    setLoading(false);
  }
};

// If home coordinates are missing, try to geocode the home address automatically
const geocodeHomeAddress = async () => {
  if (userProfile && userProfile.address && (!userProfile.latitude || !userProfile.longitude)) {
    try {
      console.log('Attempting to geocode home address:', userProfile.address);
      const coordinates = await geocodeAddress(userProfile.address);
      
      // Update user profile with coordinates
      const res = await fetch("http://localhost:8000/profile/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          latitude: coordinates.latitude,
          longitude: coordinates.longitude
        }),
      });

      if (res.ok) {
        console.log('Home address coordinates updated successfully');
        fetchLocationData(); // Refresh data
      }
    } catch (error) {
      console.log('Could not geocode home address:', error.message);
    }
  }
};


useEffect(() => {
  if (userProfile) {
    geocodeHomeAddress();
  }
}, [userProfile]);

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
      fetchLocationData();
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
      fetchLocationData();
    } catch (err) {
      console.error("Error deleting location:", err);
      alert("❌ Failed to delete location");
    }
  };

  // Handle route search
  const searchLocations = async (query) => {
  if (!query || query.length < 3) {
    setSearchResults([]);
    return;
  }

  try {
    setIsSearching(true);
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=IN&limit=5&addressdetails=1`
    );
    
    const data = await response.json();
    
    const results = data.map(item => ({
      id: item.place_id,
      name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type,
      address: item.display_name
    }));
    
    setSearchResults(results);
  } catch (error) {
    console.error('Search error:', error);
    setSearchResults([]);
  } finally {
    setIsSearching(false);
  }
};

// Get route using OpenRouteService or OSRM
const getRoute = async (fromLat, fromLng, toLat, toLng) => {
  try {
    // Using OSRM (Open Source Routing Machine) - free routing service
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`
    );
    
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        coordinates: route.geometry.coordinates.map(coord => [coord[1], coord[0]]), // Convert to [lat, lng]
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry
      };
    }
    
    throw new Error('No route found');
  } catch (error) {
    console.error('Routing error:', error);
    throw error;
  }
};

// Handle destination selection and route calculation
const handleDestinationSelect = async (destination) => {
  if (!currentLocation) {
    alert('Please enable location services first');
    return;
  }

  try {
    setSelectedDestination(destination);
    
    // Calculate route
    const route = await getRoute(
      currentLocation.lat,
      currentLocation.lng,
      destination.lat,
      destination.lng
    );
    
    setRouteData(route);
  } catch (error) {
    alert('Failed to calculate route: ' + error.message);
  }
};

// Custom Leaflet component for routing
function RouteMap({ currentLocation, destination, routeData }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !currentLocation || !destination) return;
    
    // Clear existing layers
    map.eachLayer((layer) => {
      if (layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });
    
    // Fit map to show both points
    const bounds = L.latLngBounds([
      [currentLocation.lat, currentLocation.lng],
      [destination.lat, destination.lng]
    ]);
    map.fitBounds(bounds, { padding: [20, 20] });
    
    // Draw route if available
    if (routeData && routeData.coordinates) {
      const routeLine = L.polyline(routeData.coordinates, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.8
      }).addTo(map);
    }
    
  }, [map, currentLocation, destination, routeData]);
  
  return null;
}
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
    fetchLocationData();
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

 const locationsWithCoordinates = savedLocations.filter(loc => {
  const lat = parseFloat(loc.latitude);
  const lng = parseFloat(loc.longitude);
  
  // Check if coordinates are valid numbers (not NaN, null, undefined, or empty string)
  return !isNaN(lat) && !isNaN(lng) && 
         lat !== 0 && lng !== 0 && // Exclude 0,0 coordinates as they're likely invalid
         Math.abs(lat) <= 90 && Math.abs(lng) <= 180; // Basic coordinate validation
})

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
          <div className="modal-content-loc" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Location</h3>
            <form onSubmit={handleAddLocation}>
              <div className="form-group-loc">
                <label>Location Name:</label>
                <input
                  type="text"
                  value={newLocation.name}
                  onChange={(e) => setNewLocation({...newLocation, name: e.target.value})}
                  placeholder="e.g., Home, Work, Hospital"
                  required
                />
              </div>
              <div className="form-group-loc">
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
                <div className="form-group-loc">
                  <label>Latitude (optional):</label>
                  <input
                    type="number"
                    step="any"
                    value={newLocation.lat}
                    onChange={(e) => setNewLocation({...newLocation, lat: e.target.value})}
                    placeholder="e.g., 40.7128"
                  />
                </div>
                <div className="form-group-loc">
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

     {showRouteMapModal && (
  <div className="modal-overlay" onClick={() => setShowRouteMapModal(false)}>
    <div className="route-modal-content" onClick={(e) => e.stopPropagation()}>
      <div className="route-modal-header">
        <h3>🗺️ Search & View Route</h3>
        <button 
          className="close-btn" 
          onClick={() => setShowRouteMapModal(false)}
        >
          ✕
        </button>
      </div>
      
      <div className="route-modal-body">
        {/* Search Section */}
        <div className="search-section">
          <div className="form-group-loc">
            <label>Search destination:</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                searchLocations(e.target.value);
              }}
              placeholder="e.g., Mumbai Central, Hospitals near me, Coffee shops"
              className="search-input"
            />
          </div>
          
          {/* Search Results */}
          {isSearching && <p>Searching...</p>}
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map(result => (
                <div 
                  key={result.id}
                  className="search-result-item"
                  onClick={() => handleDestinationSelect(result)}
                >
                  <div className="result-name">{result.name.split(',')[0]}</div>
                  <div className="result-address">{result.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Route Information */}
        {selectedDestination && (
          <div className="route-info">
            <h4>Route to: {selectedDestination.name.split(',')[0]}</h4>
            {routeData && (
              <div className="route-stats">
                <span>Distance: {(routeData.distance / 1000).toFixed(2)} km</span>
                <span>Duration: {Math.round(routeData.duration / 60)} min</span>
              </div>
            )}
          </div>
        )}
        
        {/* Map Section */}
        <div className="route-map-container">
          {currentLocation ? (
            <MapContainer
              center={[currentLocation.lat, currentLocation.lng]}
              zoom={13}
              style={{ height: '400px', width: '100%', borderRadius: '8px' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              
              {/* Current Location Marker */}
              <Marker 
                position={[currentLocation.lat, currentLocation.lng]} 
                icon={userIcon}
              >
                <Popup>📍 Your Location</Popup>
              </Marker>
              
              {/* Destination Marker */}
              {selectedDestination && (
                <Marker 
                  position={[selectedDestination.lat, selectedDestination.lng]}
                  icon={workIcon}
                >
                  <Popup>🎯 {selectedDestination.name.split(',')[0]}</Popup>
                </Marker>
              )}
              
              {/* Route Component */}
              {selectedDestination && (
                <RouteMap 
                  currentLocation={currentLocation}
                  destination={selectedDestination}
                  routeData={routeData}
                />
              )}
            </MapContainer>
          ) : (
            <div className="no-location-msg">
              Please enable location services to view routes
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        {selectedDestination && (
          <div className="route-actions">
            <button 
              className="action-btn secondary"
              onClick={() => {
                const googleMapsUrl = `https://www.google.com/maps/dir/${currentLocation.lat},${currentLocation.lng}/${selectedDestination.lat},${selectedDestination.lng}`;
                window.open(googleMapsUrl, '_blank');
              }}
            >
              Open in Google Maps
            </button>
            <button 
              className="action-btn primary"
              onClick={() => {
                // Add destination to saved locations
                setNewLocation({
                  name: selectedDestination.name.split(',')[0],
                  address: selectedDestination.name,
                  lat: selectedDestination.lat.toString(),
                  lng: selectedDestination.lng.toString()
                });
                setShowRouteMapModal(false);
                setShowAddLocationModal(true);
              }}
            >
              Save Location
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
)}

      {/* Send Location Modal */}
      {showSendLocationModal && (
        <div className="modal-overlay" onClick={() => setShowSendLocationModal(false)}>
          <div className="modal-content-loc" onClick={(e) => e.stopPropagation()}>
            <h3>📱 Send Location via SMS</h3>
            <div className="form-group-loc">
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
  onClick={() => setShowRouteMapModal(true)}
>
  🗺️ Search & View Routes
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