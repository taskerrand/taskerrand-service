# Taskerrand Frontend

Frontend application for the Taskerrand platform.

## Setup

1. Update `config.js` with your configuration:
   - `API_URL`: Backend API URL (default: http://localhost:8000)
   - **Note**: Maps use Leaflet.js with OpenStreetMap - no API key needed!

2. Serve the files using a local server:
   ```bash
   python -m http.server 8080
   # or
   npx serve .
   ```
   
4. Open `http://localhost:8080` in your browser

## Firebase Configuration

Make sure your Firebase project is configured with:
- Google Authentication enabled
- Correct API keys in `config.js`

## Features

- User authentication with Google Sign-In
- Task posting with map location selection
- Task browsing and acceptance
- Real-time messaging
- User dashboard with statistics
- Admin dashboard for management

