let selectedAccountType = 'owner';
let selectedPetType = 'dog';
let selectedPetSex = 'male';
let selectedSchedule = 'onetime';
let selectedTime = '4pm-6pm';
let selectedRating = 0;
let currentUser = null;
let selectedPets = [];
let selectedWalkerId = null;

// API Base URL (will be set based on environment)
const API_BASE_URL = window.location.origin + '/api';

// Page Navigation
function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // Load page-specific data
    if (pageId === 'profile') {
        loadPets();
        loadUserProfile();
    } else if (pageId === 'bookings') {
        loadBookings();
    } else if (pageId === 'services') {
        loadPetsForBooking();
    } else if (pageId === 'demo') {
        loadDemoData();
    }
}

// Tab Navigation
function showTab(tabElement, tabId) {
    const tabs = tabElement.parentElement.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    tabElement.classList.add('active');
    
    const contents = tabElement.parentElement.parentElement.querySelectorAll('.tab-content');
    contents.forEach(content => content.style.display = 'none');
    const targetContent = document.getElementById(tabId);
    if (targetContent) {
        targetContent.style.display = 'block';
    }
}

// Modal Functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Selection Functions
function selectAccountType(element, type) {
    document.querySelectorAll('#signup .radio-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    selectedAccountType = type;
}

function selectSchedule(element, type) {
    element.parentElement.querySelectorAll('.schedule-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    selectedSchedule = type;
}

function selectPetType(element, type) {
    element.parentElement.querySelectorAll('.radio-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    selectedPetType = type;
}

function selectPetSex(element, sex) {
    element.parentElement.querySelectorAll('.radio-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    selectedPetSex = sex;
}

function setRating(stars) {
    selectedRating = stars;
    const ratingStars = document.getElementById('ratingStars');
    if (ratingStars) {
        const spans = ratingStars.querySelectorAll('span');
        spans.forEach((span, index) => {
            span.style.opacity = index < stars ? '1' : '0.3';
        });
    }
}

// API Functions
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'API call failed');
        }
        
        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Login Form Handler
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const result = await apiCall('/login', 'POST', { email, password });
        console.log('Login successful:', result);
        currentUser = result.user;
        alert('Login successful!');
        showPage('profile');
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
});

// Signup Form Handler
document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        accountType: selectedAccountType,
        name: document.getElementById('signupName').value,
        email: document.getElementById('signupEmail').value,
        password: document.getElementById('signupPassword').value,
        location: document.getElementById('signupLocation').value
    };
    
    try {
        const result = await apiCall('/signup', 'POST', data);
        console.log('Signup successful:', result);
        alert('Account created successfully!');
        showPage('login');
    } catch (error) {
        alert('Signup failed: ' + error.message);
    }
});

// Add Pet Form Handler
document.getElementById('addPetForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        type: selectedPetType,
        name: document.getElementById('petName').value,
        breed: document.getElementById('petBreed').value,
        weight: document.getElementById('petWeight').value,
        ageYears: document.getElementById('petAgeYears').value,
        ageMonths: document.getElementById('petAgeMonths').value,
        sex: selectedPetSex,
        size: document.getElementById('petWeight').value < 25 ? 'small' : 
               document.getElementById('petWeight').value < 60 ? 'medium' : 'large'
    };
    
    try {
        const result = await apiCall('/pets', 'POST', data);
        console.log('Pet added:', result);
        alert('Pet added successfully!');
        closeModal('addPetModal');
        loadPets();
    } catch (error) {
        alert('Failed to add pet: ' + error.message);
    }
});

// Booking Form Handler
document.getElementById('bookingForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const date = document.getElementById('bookingDate').value;
    const address = document.getElementById('bookingAddress').value;
    
    if (selectedPets.length === 0) {
        alert('Please select at least one pet');
        return;
    }
    
    // Store booking info for the next page
    sessionStorage.setItem('bookingInfo', JSON.stringify({
        schedule: selectedSchedule,
        pets: selectedPets,
        date: date,
        time: selectedTime,
        address: address
    }));
    
    // Load walkers
    await loadWalkers(date, selectedTime);
    showPage('walkers');
});

// Review Form Handler
document.getElementById('reviewForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        rating: selectedRating,
        review: document.getElementById('reviewText').value,
        walkerId: selectedWalkerId
    };
    
    try {
        const result = await apiCall('/reviews', 'POST', data);
        console.log('Review submitted:', result);
        alert('Review submitted successfully!');
        closeModal('reviewModal');
        loadBookings();
    } catch (error) {
        alert('Failed to submit review: ' + error.message);
    }
});

// Load Pets
async function loadPets() {
    try {
        const result = await apiCall('/pets');
        const petsList = document.getElementById('petsList');
        
        if (petsList) {
            petsList.innerHTML = result.pets.map(pet => `
                <div class="pet-card">
                    <div class="pet-header">
                        <div class="pet-avatar">${pet.type === 'dog' ? '🐕' : '🐈'}</div>
                        <div class="pet-details">
                            <h3>${pet.name}</h3>
                            <div class="pet-info">
                                <span>${pet.type === 'dog' ? 'Dog' : 'Cat'}</span>
                                <span>•</span>
                                <span>${pet.breed || 'Mixed breed'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load pets:', error);
    }
}

// Load User Profile
async function loadUserProfile() {
    try {
        // If we have a current user, show their info
        if (currentUser) {
            const infoTab = document.getElementById('info-tab');
            if (infoTab) {
                infoTab.innerHTML = `
                    <div class="form-container">
                        <div class="form-group">
                            <label>Full Name</label>
                            <input type="text" value="${currentUser.name || 'User'}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" value="${currentUser.email || 'user@example.com'}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Role</label>
                            <input type="text" value="${currentUser.role || 'owner'}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Location</label>
                            <input type="text" value="${currentUser.location || 'Not set'}" readonly>
                        </div>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Failed to load user profile:', error);
    }
}

// Load Pets for Booking
async function loadPetsForBooking() {
    try {
        const result = await apiCall('/pets');
        const petsSelection = document.getElementById('petsSelection');
        
        if (petsSelection) {
            petsSelection.innerHTML = result.pets.map(pet => `
                <div class="radio-option" onclick="togglePetSelection(this, ${pet.id})">
                    <div>${pet.type === 'dog' ? '🐕' : '🐈'} ${pet.name}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load pets:', error);
    }
}

// Toggle Pet Selection
function togglePetSelection(element, petId) {
    element.classList.toggle('selected');
    
    if (element.classList.contains('selected')) {
        if (!selectedPets.includes(petId)) {
            selectedPets.push(petId);
        }
    } else {
        selectedPets = selectedPets.filter(id => id !== petId);
    }
}

// Load Walkers
async function loadWalkers(date, time) {
    try {
        const result = await apiCall(`/walkers?date=${date}&time=${time}`);
        const walkersList = document.getElementById('walkersList');
        const bookingInfo = document.getElementById('bookingInfo');
        
        if (bookingInfo) {
            bookingInfo.textContent = `${date}, ${time}`;
        }
        
        if (walkersList) {
            walkersList.innerHTML = result.walkers.map(walker => `
                <div class="walker-card" onclick="selectWalker(${walker.id})">
                    <div class="walker-avatar">👤</div>
                    <div class="walker-info">
                        <h3>${walker.name}</h3>
                        <div class="rating">
                            <span class="stars">⭐ ${walker.rating}</span>
                            <span>• ${walker.reviews} reviews</span>
                        </div>
                    </div>
                    <div class="walker-price">
                        <small>from</small><br>
                        $${walker.price}<br>
                        <small>per walk</small>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load walkers:', error);
        alert('Failed to load walkers');
    }
}

// Select Walker
async function selectWalker(walkerId) {
    selectedWalkerId = walkerId;
    const bookingInfo = JSON.parse(sessionStorage.getItem('bookingInfo') || '{}');
    
    const data = {
        ...bookingInfo,
        walkerId: walkerId
    };
    
    try {
        const result = await apiCall('/bookings', 'POST', data);
        console.log('Booking created:', result);
        alert('Booking created successfully!');
        showPage('bookings');
    } catch (error) {
        alert('Failed to create booking: ' + error.message);
    }
}

// Load Bookings
async function loadBookings() {
    try {
        const result = await apiCall('/bookings');
        
        const upcomingBookings = document.getElementById('upcomingBookings');
        const pastBookings = document.getElementById('pastBookings');
        
        if (upcomingBookings) {
            upcomingBookings.innerHTML = `
                <div class="pet-card">
                    <h3>Dog Walking - Oct 20, 2025</h3>
                    <p>Walker: Elizabeth M.</p>
                    <p>Time: 4pm-6pm</p>
                    <p>Pet: Max</p>
                    <p>Status: Confirmed</p>
                </div>
            `;
        }
        
        if (pastBookings) {
            pastBookings.innerHTML = `
                <div class="pet-card">
                    <h3>Dog Walking - Oct 15, 2025</h3>
                    <p>Walker: Ana P.</p>
                    <p>Time: 2pm-4pm</p>
                    <p>Pet: Max</p>
                    <button class="btn" onclick="showModal('reviewModal')">Leave Review</button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load bookings:', error);
    }
}

// Load Demo Data for Sprint 2
async function loadDemoData() {
    try {
        // Load composite service stats
        const statsResult = await apiCall('/demo/composite-stats');
        const statsDiv = document.getElementById('compositeStats');
        if (statsDiv) {
            statsDiv.innerHTML = `
                <h3>Composite Service Statistics</h3>
                <pre>${JSON.stringify(statsResult, null, 2)}</pre>
            `;
        }
    } catch (error) {
        console.error('Failed to load demo data:', error);
    }
}

// Time slot selection
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('time-slot')) {
        e.target.parentElement.querySelectorAll('.time-slot').forEach(slot => slot.classList.remove('selected'));
        e.target.classList.add('selected');
        selectedTime = e.target.textContent;
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('PawPal Web Application Initialized');
    console.log('Sprint 2 - Composite Microservice Integration');
    console.log('Features:');
    console.log('- Foreign key validation via Composite Service');
    console.log('- Parallel execution for user/dogs fetching');
    console.log('- Cascade delete operations');
    console.log('- Aggregated statistics');
    
    // Set today's date as minimum for booking
    const bookingDate = document.getElementById('bookingDate');
    if (bookingDate) {
        const today = new Date().toISOString().split('T')[0];
        bookingDate.min = today;
    }
    
    // Check service health
    fetch('/api/health')
        .then(res => res.json())
        .then(data => {
            console.log('Health check:', data);
            if (data.dependencies && data.dependencies.composite_service === 'healthy') {
                console.log('✅ Composite Service is available');
            } else {
                console.warn('⚠️ Composite Service may be unavailable');
            }
        })
        .catch(err => console.error('Health check failed:', err));
});
