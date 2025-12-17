import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";
import { api } from "./api.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let map;
let markers = []; // markers per location index
let geocoderCache = {}; // Cache for geocoding results
let activeLocationIndex = 0; // which location input is currently being edited
const urlParams = new URLSearchParams(window.location.search);
const editTaskId = urlParams.get('id');
const editMode = (urlParams.get('edit') === '1' || urlParams.get('edit') === 'true');
let pendingMarkerCoords = null;

// Check authentication
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "./index.html";
        return;
    }
    
    const usernameEl = document.getElementById("username");
    const profileEl = document.getElementById("profile");
    
    if (usernameEl) {
        usernameEl.textContent = user.displayName || user.email;
    }
    
    if (profileEl) {
        profileEl.src = user.photoURL || "";
    }
    
    // Initialize map after DOM is ready
    setTimeout(initMap, 100);
    // Check if we're editing an existing task and load it
    setTimeout(() => {
        if (editMode && editTaskId) {
            checkEditMode();
        }
    }, 300);
    
    loadNotifications();
});

async function checkEditMode() {
    try {
        const me = await api.getCurrentUser();
        if (!me) return;
        if (!editMode || !editTaskId) return;

        const task = await api.getTask(editTaskId);
        if (!task) return;

        // Only allow the poster to edit (basic guard)
        if (String(task.poster_id) !== String(me.id)) {
            alert('You are not authorized to edit this task.');
            window.location.href = './dashboard.html';
            return;
        }

        // Pre-fill form
        document.getElementById('title').value = task.title || '';
        document.getElementById('description').value = task.description || '';
        document.getElementById('payment').value = task.payment || '';
        document.getElementById('contact_number').value = task.contact_number || '';
        if (task.schedule) {
            const d = new Date(task.schedule);
            // format to YYYY-MM-DDThh:mm for datetime-local
            const offset = d.getTimezoneOffset();
            const local = new Date(d.getTime() - (offset*60000));
            document.getElementById('schedule').value = local.toISOString().slice(0,16);
        }
        // If server provides `locations` array, populate all locations, otherwise preserve backward-compatible single fields
        if (task.locations && Array.isArray(task.locations) && task.locations.length > 0) {
            // populate first location
            const first = task.locations[0];
            if (first.address) document.getElementById('location_address').value = first.address;
            if (first.lat) document.getElementById('location_lat').value = first.lat;
            if (first.lng) document.getElementById('location_lng').value = first.lng;

            // create additional location inputs for others
            for (let i = 1; i < task.locations.length; i++) {
                const loc = task.locations[i];
                const idx = createLocationInput();
                const addrEl = document.querySelector(`#locations-container .location-item[data-index='${idx}'] input[type='text']`);
                const latEl = document.getElementById(`location_lat_${idx}`);
                const lngEl = document.getElementById(`location_lng_${idx}`);
                if (addrEl && loc.address) addrEl.value = loc.address;
                if (latEl && loc.lat) latEl.value = loc.lat;
                if (lngEl && loc.lng) lngEl.value = loc.lng;
                // place markers if map present
                if (map && loc.lat && loc.lng) {
                    ensureMarkerForIndex(idx, [parseFloat(loc.lat), parseFloat(loc.lng)]);
                }
            }

            toggleAddButtonIfNeeded();
            setActiveLocationIndex(0);
        } else {
            if (task.location_address) document.getElementById('location_address').value = task.location_address;
            if (task.location_lat) document.getElementById('location_lat').value = task.location_lat;
            if (task.location_lng) document.getElementById('location_lng').value = task.location_lng;

            // If editing with existing location, show add button if appropriate
            if (task.location_address || task.location_lat || task.location_lng) {
                toggleAddButtonIfNeeded();
                setActiveLocationIndex(0);
            }
        }

        // Update UI: change button text and cancel link
        const submitBtn = document.querySelector('.post-task-buttons-container .btn-primary');
        if (submitBtn) submitBtn.textContent = 'Update Task';

        const cancelLink = document.querySelector('.post-task-buttons-container .btn-outline');
        if (cancelLink) cancelLink.href = `./task-detail.html?id=${editTaskId}`;

        // If map already initialized, place markers for locations
        if (task.locations && Array.isArray(task.locations) && task.locations.length > 0) {
            // apply all locations to map or store for later
            task.locations.forEach((loc, i) => {
                const lat = parseFloat(loc.lat);
                const lng = parseFloat(loc.lng);
                if (!isNaN(lat) && !isNaN(lng)) {
                    if (map) {
                        ensureMarkerForIndex(i, [lat, lng]);
                        if (i === 0) {
                            map.setView([lat, lng], 15);
                        }
                        updateLocationFromMarker(i, [lat, lng]);
                    } else {
                        // push to pending list
                        if (!Array.isArray(pendingMarkerCoords)) pendingMarkerCoords = [];
                        pendingMarkerCoords.push({ index: i, lat, lng });
                    }
                }
            });
        } else if (task.location_lat && task.location_lng) {
            const lat = parseFloat(task.location_lat);
            const lng = parseFloat(task.location_lng);
            if (map) {
                map.setView([lat, lng], 15);
                ensureMarkerForIndex(0, [lat, lng]);
                updateLocationFromMarker(0, [lat, lng]);
            } else {
                // store for later
                pendingMarkerCoords = { index: 0, lat: parseFloat(task.location_lat), lng: parseFloat(task.location_lng) };
            }
        }

    } catch (error) {
        console.error('Error loading task for edit:', error);
    }
}

// Initialize Leaflet Map
function initMap() {
    const defaultLocation = [40.7128, -74.0060]; // New York default [lat, lng]
    
    // Create map
    map = L.map('map').setView(defaultLocation, 13);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Try to get user's current location and center view; do NOT create a marker automatically
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = [position.coords.latitude, position.coords.longitude];
                map.setView(userLocation, 15);
            },
            () => {
                console.log("Geolocation not available");
            }
        );
    }
    
    // Add click listener to map - update only the active location
    map.on('click', (e) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        ensureMarkerForIndex(activeLocationIndex, [lat, lng]);
        updateLocationFromMarker(activeLocationIndex, [lat, lng]);
    });
    
    // Address search functionality
    const addressInput = document.getElementById("location_address");
    let searchTimeout;
    addressInput.addEventListener('focus', () => setActiveLocationIndex(0));

    addressInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length > 3) {
            searchTimeout = setTimeout(() => {
                searchAddress(query, 0);
            }, 500); // Debounce search
        }
        // If user types an address, expose add button only when there is some content
        toggleAddButtonIfNeeded();
    });

    // Handle Enter key on address input
    addressInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = addressInput.value.trim();
            if (query) {
                searchAddress(query, 0);
            }
        }
    });

    // Add 'Add another location' button behavior
    const addLocationBtn = document.getElementById('add-location-btn');
    if (addLocationBtn) {
        addLocationBtn.addEventListener('click', () => {
            const newIndex = createLocationInput();
            setActiveLocationIndex(newIndex);
            // focus new address field
            const el = document.querySelector(`#locations-container .location-item[data-index='${newIndex}'] input[type='text']`);
            if (el) el.focus();
        });
    }

    // Apply pending marker coords if we loaded edit data before map init
    applyPendingMarker();
}

// Create a new location input group, returns its index
function createLocationInput(prefill = {}) {
    const container = document.getElementById('locations-container');
    if (!container) return 0;

    // compute next index
    const existing = container.querySelectorAll('.location-item');
    const index = existing.length;

    const item = document.createElement('div');
    item.className = 'location-item';
    item.setAttribute('data-index', index);

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search for address or click on map';
    input.setAttribute('data-index', index);
    input.id = `location_address_${index}`;

    const latInput = document.createElement('input');
    latInput.type = 'hidden';
    latInput.id = `location_lat_${index}`;
    latInput.setAttribute('data-index', index);
    latInput.name = `location_lat_extra[]`;

    const lngInput = document.createElement('input');
    lngInput.type = 'hidden';
    lngInput.id = `location_lng_${index}`;
    lngInput.setAttribute('data-index', index);
    lngInput.name = `location_lng_extra[]`;

    // Optional remove button for extra locations
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-danger';
    removeBtn.style.marginLeft = '8px';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
        // remove marker if exists
        if (markers[index]) {
            map.removeLayer(markers[index]);
            delete markers[index];
        }
        container.removeChild(item);
        // if removed last active, set active to 0
        setActiveLocationIndex(Math.max(0, index - 1));
    });

    input.addEventListener('focus', () => setActiveLocationIndex(index));
    input.addEventListener('input', (e) => {
        // debounce search
        clearTimeout(input._searchTimeout);
        const q = e.target.value.trim();
        if (q.length > 3) {
            input._searchTimeout = setTimeout(() => searchAddress(q, index), 500);
        }
        toggleAddButtonIfNeeded();
    });
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const q = input.value.trim();
            if (q) searchAddress(q, index);
        }
    });

    item.appendChild(input);
    item.appendChild(latInput);
    item.appendChild(lngInput);
    if (index > 0) item.appendChild(removeBtn);

    container.appendChild(item);

    return index;
}

function setActiveLocationIndex(index) {
    activeLocationIndex = index;
    // add active class to selected input container
    document.querySelectorAll('#locations-container .location-item').forEach(el => {
        el.classList.toggle('active', Number(el.getAttribute('data-index')) === index);
    });
}

function toggleAddButtonIfNeeded() {
    const addBtn = document.getElementById('add-location-btn');
    if (!addBtn) return;
    // show add button if any existing location has lat/lng or non-empty address
    const items = document.querySelectorAll('#locations-container .location-item');
    let show = false;
    items.forEach((it) => {
        const idx = it.getAttribute('data-index');
        const addr = it.querySelector(`input[type='text'][data-index='${idx}']`);
        const lat = it.querySelector(`input[id^='location_lat'][data-index='${idx}']`) || it.querySelector(`#location_lat`);
        const lng = it.querySelector(`input[id^='location_lng'][data-index='${idx}']`) || it.querySelector(`#location_lng`);
        if ((lat && lat.value) || (addr && addr.value && addr.value.trim() !== '')) show = true;
    });
    addBtn.style.display = show ? 'inline-block' : 'none';
}

// If we had pending marker coords from edit mode, apply them after map initialization
function applyPendingMarker() {
    if (!map || !pendingMarkerCoords) return;
    // If single object
    if (!Array.isArray(pendingMarkerCoords)) {
        const { index, lat, lng } = pendingMarkerCoords;
        map.setView([lat, lng], 15);
        ensureMarkerForIndex(index, [lat, lng]);
        updateLocationFromMarker(index, [lat, lng]);
        pendingMarkerCoords = null;
        return;
    }
    // If array of coords
    pendingMarkerCoords.forEach((p, i) => {
        ensureMarkerForIndex(p.index, [p.lat, p.lng]);
        updateLocationFromMarker(p.index, [p.lat, p.lng]);
        if (i === 0) map.setView([p.lat, p.lng], 15);
    });
    pendingMarkerCoords = null;
}

// Ensure a marker exists for the given location index and optionally set its position
function ensureMarkerForIndex(index, position) {
    if (!markers[index]) {
        markers[index] = L.marker(position || [0,0], { draggable: true }).addTo(map);
        markers[index].on('dragend', (e) => {
            const p = markers[index].getLatLng();
            updateLocationFromMarker(index, [p.lat, p.lng]);
        });
    } else if (position) {
        markers[index].setLatLng(position);
    }
}

// Update location fields from marker position for a particular index
async function updateLocationFromMarker(index, latlng) {
    const lat = latlng[0];
    const lng = latlng[1];

    const latEl = document.querySelector(`input[id^='location_lat'][data-index='${index}']`) || document.getElementById('location_lat');
    const lngEl = document.querySelector(`input[id^='location_lng'][data-index='${index}']`) || document.getElementById('location_lng');
    const addressEl = document.querySelector(`input[type='text'][data-index='${index}']`) || document.getElementById('location_address');

    if (latEl) latEl.value = lat;
    if (lngEl) lngEl.value = lng;

    // Reverse geocode to get address
    try {
        const address = await reverseGeocode(lat, lng);
        if (address && addressEl) {
            addressEl.value = address;
        }
    } catch (error) {
        console.error("Geocoding error:", error);
    }

    // After a location is set, enable Add Another Location button
    toggleAddButtonIfNeeded();
}

// Reverse geocode using Nominatim (OpenStreetMap)
async function reverseGeocode(lat, lng) {
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    
    if (geocoderCache[cacheKey]) {
        return geocoderCache[cacheKey];
    }
    
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'Taskerrand/1.0' // Required by Nominatim
                }
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            const address = data.display_name || `${lat}, ${lng}`;
            geocoderCache[cacheKey] = address;
            return address;
        }
    } catch (error) {
        console.error("Reverse geocoding error:", error);
    }
    
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// Search address using Nominatim (index-aware)
async function searchAddress(query, index = activeLocationIndex) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'Taskerrand/1.0' // Required by Nominatim
                }
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.length > 0) {
                // Use first result
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lng = parseFloat(result.lon);

                const addressEl = document.querySelector(`input[type='text'][data-index='${index}']`) || document.getElementById('location_address');
                const latEl = document.querySelector(`input[id^='location_lat'][data-index='${index}']`) || document.getElementById('location_lat');
                const lngEl = document.querySelector(`input[id^='location_lng'][data-index='${index}']`) || document.getElementById('location_lng');

                if (latEl) latEl.value = lat;
                if (lngEl) lngEl.value = lng;
                if (addressEl) addressEl.value = result.display_name;

                // Update map and marker for this index
                map.setView([lat, lng], 15);
                ensureMarkerForIndex(index, [lat, lng]);
            } else {
                alert("Address not found. Please try a different search term or click on the map to select a location.");
            }
        }
    } catch (error) {
        console.error("Address search error:", error);
        alert("Error searching address. Please click on the map to select a location.");
    }
}


// Form submission
/*
document.getElementById("task-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const errorDiv = document.getElementById("error-message");
    errorDiv.innerHTML = "";

    // Get raw values first
    const title = document.getElementById("title").value;
    const description = document.getElementById("description").value;
    const payment = document.getElementById("payment").value;
    const contactRaw = document.getElementById("contact_number").value;
    // Determine primary location: pick first location input that has lat/lng/address
    function getPrimaryLocation() {
        const items = document.querySelectorAll('#locations-container .location-item');
        for (const it of items) {
            const idx = it.getAttribute('data-index');
            const addr = it.querySelector(`input[type='text'][data-index='${idx}']`) || document.getElementById('location_address');
            const latEl = it.querySelector(`input[id^='location_lat'][data-index='${idx}']`) || document.getElementById('location_lat');
            const lngEl = it.querySelector(`input[id^='location_lng'][data-index='${idx}']`) || document.getElementById('location_lng');
            if (latEl && latEl.value && lngEl && lngEl.value && addr && addr.value && addr.value.trim() !== '') {
                return { lat: latEl.value, lng: lngEl.value, address: addr.value };
            }
        }
        return null;
    }

    const primaryLoc = getPrimaryLocation();
    const lat = primaryLoc ? primaryLoc.lat : '';
    const lng = primaryLoc ? primaryLoc.lng : '';
    const address = primaryLoc ? primaryLoc.address : '';
    const scheduleRaw = document.getElementById("schedule").value;

    // ------------------- REQUIRED FIELD CHECK -------------------
    if (!title || !description || !payment || !contact || !lat || !lng || !address || !scheduleRaw) {
        errorDiv.innerHTML = "<div class='error'>All fields are required</div>";
        return;
    }

    // ------------------- DATE VALIDATION -------------------
    const selectedDate = new Date(scheduleRaw);
    const now = new Date();

    if (selectedDate < now) {
        errorDiv.innerHTML = "<div class='error'>The selected schedule cannot be in the past</div>";
        return;
    }

    // ------------------- CREATE FORM DATA -------------------
    const formData = {
        title,
        description,
        payment: parseFloat(payment),
        contact_number: contact,
        location_lat: parseFloat(lat),
        location_lng: parseFloat(lng),
        location_address: address,
        schedule: selectedDate.toISOString()
    };

    // ------------------- SUBMIT DATA -------------------
    try {
        await api.createTask(formData);
        alert("Task posted successfully!");
        window.location.href = "./dashboard.html";
    } catch (error) {
        errorDiv.innerHTML = `<div class='error'>Error: ${error.message}</div>`;
    }
});
*/

// Form submission
// Prevent non-numeric/exponential characters in payment field and sanitize decimals
const paymentInput = document.getElementById('payment');
if (paymentInput) {
    paymentInput.setAttribute('inputmode', 'decimal');
    paymentInput.addEventListener('keydown', (ev) => {
        // Prevent entering exponential notation and plus/minus signs
        if (ev.key === 'e' || ev.key === 'E' || ev.key === '+' || ev.key === '-') {
            ev.preventDefault();
        }
    });
    paymentInput.addEventListener('input', (ev) => {
        let v = ev.target.value;
        // Allow only digits and decimal point
        v = v.replace(/[^0-9.]/g, '');
        // Keep only first decimal point
        const parts = v.split('.');
        if (parts.length > 2) {
            v = parts[0] + '.' + parts.slice(1).join('');
        }
        // Limit to two decimal places if present
        if (v.indexOf('.') >= 0) {
            const [intPart, decPart] = v.split('.');
            ev.target.value = intPart + '.' + (decPart ? decPart.slice(0, 2) : '');
        } else {
            ev.target.value = v;
        }
    });
}

// Enforce schedule input format: limit year to 4 digits and time to HH:MM
const scheduleInput = document.getElementById('schedule');
if (scheduleInput) {
    scheduleInput.addEventListener('input', (ev) => {
        let v = ev.target.value || '';

        // Split date and time (datetime-local uses 'T')
        const parts = v.split('T');
        const datePart = parts[0] || '';
        const timePartRaw = parts[1] || '';

        // Date part should be YYYY-MM-DD; ensure year <= 4 digits, month/day <=2
        const dateSegments = datePart.split('-');
        const year = (dateSegments[0] || '').slice(0, 4);
        const month = (dateSegments[1] || '').slice(0, 2);
        const day = (dateSegments[2] || '').slice(0, 2);

        const newDate = [year].concat(month ? [month] : [], day ? [day] : []).join('-');

        // Time part should be HH:MM (ignore seconds); limit to 5 chars
        const time = timePartRaw.slice(0, 5);

        const newValue = newDate + (time ? ('T' + time) : '');
        if (newValue !== v) {
            ev.target.value = newValue;
        }
    });

    // Sanitize pasted values into expected datetime-local format
    scheduleInput.addEventListener('paste', (ev) => {
        ev.preventDefault();
        const text = (ev.clipboardData || window.clipboardData).getData('text') || '';
        // reuse input handler logic
        const parts = text.trim().split('T');
        const datePart = parts[0] || '';
        const timePartRaw = parts[1] || '';
        const dateSegments = datePart.split('-');
        const year = (dateSegments[0] || '').slice(0, 4);
        const month = (dateSegments[1] || '').slice(0, 2);
        const day = (dateSegments[2] || '').slice(0, 2);
        const newDate = [year].concat(month ? [month] : [], day ? [day] : []).join('-');
        const time = timePartRaw.slice(0, 5);
        const newValue = newDate + (time ? ('T' + time) : '');
        scheduleInput.value = newValue;
    });
}

document.getElementById("task-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const errorDiv = document.getElementById("error-message");
    errorDiv.innerHTML = "";
    errorDiv.classList.remove("error-shake", "active");

    // Fields
    const title = document.getElementById("title").value;
    const description = document.getElementById("description").value;
    const payment = document.getElementById("payment").value;
    const contactRaw = document.getElementById("contact_number").value;
    // Determine primary location: pick first location input that has lat/lng/address
    function getPrimaryLocation() {
        const items = document.querySelectorAll('#locations-container .location-item');
        for (const it of items) {
            const idx = it.getAttribute('data-index');
            const addr = it.querySelector(`input[type='text'][data-index='${idx}']`) || document.getElementById('location_address');
            const latEl = it.querySelector(`input[id^='location_lat'][data-index='${idx}']`) || document.getElementById('location_lat');
            const lngEl = it.querySelector(`input[id^='location_lng'][data-index='${idx}']`) || document.getElementById('location_lng');
            if (latEl && latEl.value && lngEl && lngEl.value && addr && addr.value && addr.value.trim() !== '') {
                return { lat: latEl.value, lng: lngEl.value, address: addr.value };
            }
        }
        return null;
    }

    const primaryLoc = getPrimaryLocation();
    const lat = primaryLoc ? primaryLoc.lat : '';
    const lng = primaryLoc ? primaryLoc.lng : '';
    const address = primaryLoc ? primaryLoc.address : '';
    const scheduleRaw = document.getElementById("schedule").value;

    function showError(msg) {
        errorDiv.innerHTML = msg;
        errorDiv.classList.add("active");
        
        // Restart animation
        errorDiv.classList.remove("error-shake");
        void errorDiv.offsetWidth;
        errorDiv.classList.add("error-shake");
    }

    // Required fields
    if (!title || !description || !payment || !contactRaw || !lat || !lng || !address || !scheduleRaw) {
        showError("<div class='error'>All fields are required</div>");
        return;
    }

    // Digits only
    const contact = contactRaw.replace(/\D/g, '');
    if (contact !== contactRaw) {
        showError("<div class='error'>Contact number must contain digits only.</div>");
        return;
    }

    if (contact.length < 7) {
        showError("<div class='error'>Please enter a valid contact number (at least 7 digits).</div>");
        return;
    }

    // Date validation: enforce exact datetime-local format with 4-digit year
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/.test(scheduleRaw)) {
        showError("<div class='error'>Please use a valid date and time with a 4-digit year (YYYY-MM-DDTHH:MM).</div>");
        return;
    }

    const selectedDate = new Date(scheduleRaw);
    const now = new Date();

    if (isNaN(selectedDate.getTime())) {
        showError("<div class='error'>The provided schedule is invalid. Please pick a valid date and time.</div>");
        return;
    }

    if (selectedDate < now) {
        showError("<div class='error'>The selected date and time cannot be in the past</div>");
        return;
    }

    // collect all locations from the UI
    const locations = [];
    const items = document.querySelectorAll('#locations-container .location-item');
    items.forEach((it) => {
        const idx = it.getAttribute('data-index');
        const addrEl = it.querySelector(`input[type='text'][data-index='${idx}']`) || document.getElementById('location_address');
        const latEl = it.querySelector(`input[id^='location_lat'][data-index='${idx}']`) || document.getElementById('location_lat');
        const lngEl = it.querySelector(`input[id^='location_lng'][data-index='${idx}']`) || document.getElementById('location_lng');
        if (latEl && latEl.value && lngEl && lngEl.value && addrEl && addrEl.value && addrEl.value.trim() !== '') {
            locations.push({ lat: parseFloat(latEl.value), lng: parseFloat(lngEl.value), address: addrEl.value.trim() });
        }
    });

    const formData = {
        title,
        description,
        payment: parseFloat(payment),
        contact_number: contact,
        // keep single primary fields for backward compatibility
        location_lat: parseFloat(lat),
        location_lng: parseFloat(lng),
        location_address: address,
        // new: send all locations (may be empty)
        locations,
        schedule: selectedDate.toISOString()
    };

    try {
        if (editMode && editTaskId) {
            await api.updateTask(editTaskId, formData);
            alert("Task updated successfully!");
            window.location.href = `./task-detail.html?id=${editTaskId}`;
        } else {
            await api.createTask(formData);
            alert("Task posted successfully!");
            window.location.href = "./dashboard.html";
        }
    } catch (error) {
        showError(`<div class='error'>Error: ${error.message}</div>`);
    }
});




// Logout
const logoutBtn = document.getElementById("google-logout-btn-id");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => {
            window.location.href = "./index.html";
        });
    });
}

// Notification Logic
async function loadNotifications() {
    function formatNotificationDate(dateStr) {
        if (!dateStr) return '';
        if (/[Zz]|[+\-]\d{2}:\d{2}$/.test(dateStr)) return new Date(dateStr).toLocaleString();
        try { return new Date(dateStr + 'Z').toLocaleString(); } catch (e) { return new Date(dateStr).toLocaleString(); }
    }
    try {
        const notifications = await api.getNotifications();
        const notificationList = document.getElementById("notification-list");
        const notificationBadge = document.getElementById("notification-badge");

        if (!notificationList) return;

        // Update badge
        const unreadCount = notifications.filter(n => !n.seen).length;
        if (notificationBadge) {
            notificationBadge.textContent = unreadCount;
            notificationBadge.style.display = unreadCount > 0 ? "block" : "none";
        }

        if (notifications.length === 0) {
            notificationList.innerHTML = '<div class="notification-empty">No notifications</div>';
            return;
        }

        notificationList.innerHTML = notifications.map(n => `
            <div class="notification-item ${n.seen ? '' : 'unread'}">
                <div class="notification-title">${n.title}</div>
                <div class="notification-message">${n.message}</div>
                <div class="notification-time">${formatNotificationDate(n.created_at)}</div>
                <div class="notification-actions" onclick="event.stopPropagation();">
                    ${n.task_id ? `<button class="notification-view-btn" onclick="handleNotificationView(${n.id}, ${n.task_id}, ${n.seen}, event)">View</button>` : ''}
                    <button class="notification-delete-btn" onclick="handleNotificationDelete(${n.id}, event)">Delete</button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error("Error loading notifications:", error);
    }
}

window.handleNotificationView = async function (notificationId, taskId, seen, event) {
    try {
        // Mark as read if not already read
        if (!seen) {
            await api.markNotificationRead(notificationId);
        }

        // Close the notification dropdown
        const dropdown = document.getElementById("notification-dropdown");
        if (dropdown) {
            dropdown.classList.remove("show");
        }

        // Check if Ctrl or Cmd key was pressed
        if (event.ctrlKey || event.metaKey) {
            // Open in new tab
            window.open(`./task-detail.html?id=${taskId}`, '_blank');
        } else {
            // Navigate in current tab
            window.location.href = `./task-detail.html?id=${taskId}`;
        }
    } catch (error) {
        console.error("Error handling notification view:", error);
    }
};

window.handleNotificationDelete = async function (notificationId, event) {
    try {
        event.stopPropagation();
        
        // Delete the notification
        await api.deleteNotification(notificationId);
        
        // Reload notifications to reflect the deletion
        loadNotifications();
    } catch (error) {
        console.error("Error deleting notification:", error);
    }
};

// Notification bell event listener
document.addEventListener("DOMContentLoaded", () => {
    const bell = document.getElementById("notification-bell");
    const dropdown = document.getElementById("notification-dropdown");

    if (bell && dropdown) {
        bell.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("show");
        });

        // Close dropdown when clicking outside
        window.addEventListener("click", () => {
            if (dropdown.classList.contains("show")) {
                dropdown.classList.remove("show");
            }
        });

        dropdown.addEventListener("click", (e) => {
            e.stopPropagation();
        });
    }
});

