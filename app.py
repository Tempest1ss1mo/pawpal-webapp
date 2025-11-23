from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_cors import CORS
import os
from datetime import datetime
import logging
import requests
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['DEBUG'] = os.environ.get('FLASK_DEBUG', 'True') == 'True'

# Enable CORS for microservice communication
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Microservice URLs - Updated for Sprint 2
USER_SERVICE_URL = os.environ.get('USER_SERVICE_URL', 'http://localhost:3001')
COMPOSITE_SERVICE_URL = os.environ.get('COMPOSITE_SERVICE_URL', 'http://localhost:3002')

# Legacy URLs for compatibility
WALKING_SERVICE_URL = os.environ.get('WALKING_SERVICE_URL', 'http://localhost:5002')
REVIEW_SERVICE_URL = os.environ.get('REVIEW_SERVICE_URL', 'http://localhost:5003')

# Routes
@app.route('/')
def index():
    """Main application page"""
    logger.info('Serving index page')
    return render_template('index.html')

@app.route('/api/health')
def health():
    """Health check endpoint"""
    # Check composite service health
    composite_status = 'unknown'
    try:
        response = requests.get(f'{COMPOSITE_SERVICE_URL}/health', timeout=2)
        if response.status_code == 200:
            composite_status = 'healthy'
    except:
        composite_status = 'unavailable'
    
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'pawpal-web-app',
        'dependencies': {
            'composite_service': composite_status
        }
    })

# User Management Routes (via Composite Service)
@app.route('/api/login', methods=['POST'])
def login():
    """Handle user login - connects to User Service via Composite"""
    data = request.json
    logger.info(f"Login attempt for user: {data.get('email')}")
    
    try:
        # In real implementation, this would authenticate via User Service
        # For now, we'll validate against User Service
        response = requests.get(f'{USER_SERVICE_URL}/api/users', 
                               params={'email': data.get('email')})
        
        if response.status_code == 200:
            users = response.json().get('data', [])
            if users and len(users) > 0:
                session['user'] = users[0]
                return jsonify({
                    'status': 'success',
                    'message': 'Login successful',
                    'user': users[0]
                })
        
        return jsonify({
            'status': 'error',
            'message': 'Invalid credentials'
        }), 401
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Login service unavailable'
        }), 503

@app.route('/api/signup', methods=['POST'])
def signup():
    """Handle user registration - connects to User Service"""
    data = request.json
    logger.info(f"Signup attempt - Type: {data.get('accountType')}")
    
    try:
        # Create user via User Service
        user_data = {
            'name': data.get('name'),
            'email': data.get('email'),
            'role': data.get('accountType', 'owner'),
            'phone': data.get('phone'),
            'location': data.get('location')
        }
        
        response = requests.post(f'{USER_SERVICE_URL}/api/users', json=user_data)
        
        if response.status_code in [200, 201]:
            return jsonify({
                'status': 'success',
                'message': 'Account created successfully',
                'data': response.json()
            })
        else:
            return jsonify({
                'status': 'error',
                'message': response.json().get('message', 'Failed to create account')
            }), response.status_code
            
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Signup service unavailable'
        }), 503

@app.route('/api/pets', methods=['GET', 'POST'])
def pets():
    """Handle pet management via Composite Service"""
    if request.method == 'POST':
        data = request.json
        logger.info(f"Adding new pet: {data.get('name')}")
        
        try:
            # Use composite service for foreign key validation
            pet_data = {
                'owner_id': session.get('user', {}).get('id', 1),  # Default to 1 for demo
                'name': data.get('name'),
                'breed': data.get('breed'),
                'age': int(data.get('ageYears', 0)),
                'size': data.get('size', 'medium'),
                'temperament': data.get('temperament', ''),
                'energy_level': 'medium',
                'is_friendly_with_other_dogs': True,
                'is_friendly_with_children': True
            }
            
            # Create dog with foreign key validation via composite service
            response = requests.post(f'{COMPOSITE_SERVICE_URL}/api/composite/dogs', 
                                    json=pet_data)
            
            if response.status_code in [200, 201]:
                return jsonify({
                    'status': 'success',
                    'message': 'Pet added successfully',
                    'data': response.json()
                })
            else:
                error_msg = response.json().get('message', 'Failed to add pet')
                return jsonify({
                    'status': 'error',
                    'message': error_msg
                }), response.status_code
                
        except Exception as e:
            logger.error(f"Add pet error: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': 'Failed to add pet'
            }), 503
    else:
        # GET pets - use composite service for aggregated data
        try:
            user_id = session.get('user', {}).get('id', 1)
            response = requests.get(f'{COMPOSITE_SERVICE_URL}/api/composite/users/{user_id}/dogs')
            
            if response.status_code == 200:
                result = response.json()
                pets_data = result.get('data', {}).get('dogs', [])
                
                # Transform to match frontend expectations
                pets_formatted = [{
                    'id': pet.get('id'),
                    'name': pet.get('name'),
                    'type': 'dog',
                    'breed': pet.get('breed', 'Mixed breed')
                } for pet in pets_data]
                
                return jsonify({
                    'pets': pets_formatted
                })
            else:
                return jsonify({'pets': []})
                
        except Exception as e:
            logger.error(f"Get pets error: {str(e)}")
            return jsonify({'pets': []})

# Walking service routes (placeholder for now)
@app.route('/api/walkers', methods=['GET'])
def get_walkers():
    """Get available walkers - uses User Service"""
    date = request.args.get('date')
    time = request.args.get('time')
    logger.info(f"Fetching walkers for {date} at {time}")
    
    try:
        # Get walkers from User Service
        response = requests.get(f'{USER_SERVICE_URL}/api/users', 
                               params={'role': 'walker'})
        
        if response.status_code == 200:
            walkers = response.json().get('data', [])
            
            # Format for frontend
            walkers_formatted = [{
                'id': walker.get('id'),
                'name': walker.get('name'),
                'rating': walker.get('rating', 4.5),
                'reviews': walker.get('total_reviews', 0),
                'price': 25  # Default price
            } for walker in walkers[:5]]  # Limit to 5 for demo
            
            return jsonify({
                'walkers': walkers_formatted
            })
        else:
            return jsonify({'walkers': []})
            
    except Exception as e:
        logger.error(f"Get walkers error: {str(e)}")
        return jsonify({'walkers': []})

@app.route('/api/bookings', methods=['GET', 'POST'])
def bookings():
    """Handle booking management - placeholder"""
    if request.method == 'POST':
        data = request.json
        logger.info(f"Creating booking for walker: {data.get('walkerId')}")
        
        return jsonify({
            'status': 'success',
            'message': 'Booking created (demo mode)'
        })
    else:
        # Return sample bookings
        return jsonify({
            'upcoming': [],
            'past': []
        })

# Review routes (placeholder)
@app.route('/api/reviews', methods=['GET', 'POST'])
def reviews():
    """Handle review management - placeholder"""
    if request.method == 'POST':
        data = request.json
        logger.info(f"Creating review - Rating: {data.get('rating')}")
        
        return jsonify({
            'status': 'success',
            'message': 'Review submitted (demo mode)'
        })
    else:
        return jsonify({
            'reviews': []
        })

# Composite Service Demo Routes
@app.route('/api/demo/composite-stats')
def demo_composite_stats():
    """Demonstrate composite service aggregation"""
    try:
        response = requests.get(f'{COMPOSITE_SERVICE_URL}/api/composite/stats')
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({'error': 'Failed to get stats'}), response.status_code
    except Exception as e:
        logger.error(f"Stats error: {str(e)}")
        return jsonify({'error': 'Composite service unavailable'}), 503

@app.route('/api/demo/user-complete/<int:user_id>')
def demo_user_complete(user_id):
    """Demonstrate parallel execution in composite service"""
    try:
        response = requests.get(f'{COMPOSITE_SERVICE_URL}/api/composite/users/{user_id}/complete')
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({'error': 'Failed to get user data'}), response.status_code
    except Exception as e:
        logger.error(f"User complete error: {str(e)}")
        return jsonify({'error': 'Composite service unavailable'}), 503

@app.route('/api/demo/cascade-delete/<int:user_id>', methods=['DELETE'])
def demo_cascade_delete(user_id):
    """Demonstrate cascade delete in composite service"""
    try:
        response = requests.delete(f'{COMPOSITE_SERVICE_URL}/api/composite/users/{user_id}')
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({'error': 'Failed to delete user'}), response.status_code
    except Exception as e:
        logger.error(f"Cascade delete error: {str(e)}")
        return jsonify({'error': 'Composite service unavailable'}), 503

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    logger.error(f"Internal error: {error}")
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"Starting PawPal Web App on port {port}")
    logger.info(f"User Service URL: {USER_SERVICE_URL}")
    logger.info(f"Composite Service URL: {COMPOSITE_SERVICE_URL}")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=app.config['DEBUG']
    )
