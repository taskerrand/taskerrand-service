# Quick Setup Guide

## Prerequisites
- Python 3.8+
- Google account for Firebase Authentication (no payment required)

## Step 1: Backend Setup

1. Navigate to backend folder:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Prepare MySQL (XAMPP):
   - Start MySQL from XAMPP Control Panel.
   - In phpMyAdmin, create a database named `taskerrand_db`.
   - Import `backend/mysql_schema.sql`.
   - If you use a custom MySQL password, set the `DATABASE_URL` env var to `mysql+pymysql://username:password@localhost/taskerrand_db`.

5. Start the server:
```bash
python main.py
```

Backend will run on `http://localhost:8000`

## Step 2: Frontend Setup

1. Update configuration (if needed):
   - Open `frontend/config.js`
   - Update `API_URL` if backend is not on localhost:8000
   - **Note**: Maps use Leaflet.js with OpenStreetMap - no API key needed!

2. Serve the frontend:
```bash
cd frontend
python -m http.server 8080
```

5. Open browser:
   - Navigate to `http://localhost:8080`
   - Or open `index.html` directly

## Step 3: Firebase Setup (Already Configured)

The Firebase configuration is already set up in the code. If you need to change it:
- Update `frontend/config.js` with your Firebase config
- Update `backend/auth.py` with your Firebase API key

## Step 4: Admin Access

To make a user an admin, you can:
1. Manually update the database: Set `is_admin=True` for the user
2. Or modify the admin check in `backend/main.py` to use your email domain

## Testing

1. Start backend: `cd backend && python main.py`
2. Start frontend server: `cd frontend && python -m http.server 8080`
3. Open `http://localhost:8080` in browser
4. Sign in with Google
5. Post a task, browse tasks, accept tasks, etc.

## Troubleshooting

### Backend won't start
- Check Python version: `python --version` (need 3.8+)
- Check if dependencies are installed: `pip list`
- Check if port 8000 is available

### Frontend can't connect to backend
- Check if backend is running
- Check `API_URL` in `frontend/config.js`
- Check browser console for CORS errors

### Maps not loading
- Check your internet connection (Leaflet loads maps from OpenStreetMap)
- Check browser console for any errors
- Ensure Leaflet CSS and JS are loading properly

### Authentication not working
- Check Firebase configuration
- Check browser console for Firebase errors
- Verify Firebase project has Google Sign-In enabled

