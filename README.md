# Taskerrand - Web-Based Errand Posting and Hiring System

A comprehensive web-based platform that allows users to post, find, and accept short-term errands or community tasks. Built with HTML/CSS/JavaScript for the frontend and Python FastAPI for the backend.

## Features

- **User Authentication**: Google Sign-In via Firebase Authentication
- **Task Management**: Create, edit, delete, and manage errand posts
- **Task Discovery**: Browse and accept available errands
- **Real-time Messaging**: Built-in chat system for task communication
- **Location Services**: Leaflet.js with OpenStreetMap for location selection and display (completely free, no API key required)
- **User Dashboard**: Track posted, accepted, and completed tasks with statistics
- **Admin Dashboard**: Monitor all activities, manage users and tasks
- **Feedback System**: Rate and review task completion

## Technology Stack

### Frontend
- HTML5, CSS3, JavaScript (ES6+)
- Firebase Authentication (Google Sign-In)
- Leaflet.js with OpenStreetMap (free, no API key required)

### Backend
- Python 3.8+
- FastAPI
- SQLAlchemy (ORM)
- MySQL (XAMPP-ready) via PyMySQL driver

## Setup Instructions

### Prerequisites
- Python 3.8 or higher
- Node.js (optional, for development)
- Google account for Firebase Authentication (no payment required)

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Provision MySQL:
   - Start Apache + MySQL from XAMPP.
   - Open phpMyAdmin and create a database named `taskerrand_db`.
   - Import `backend/mysql_schema.sql` to create all tables.

5. (Optional) If you use a custom MySQL user/password, set `DATABASE_URL` before running:
```bash
set DATABASE_URL=mysql+pymysql://username:password@localhost/taskerrand_db
```

6. Run the backend server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Update the configuration in `config.js`:
   - Set your `API_URL` (default: `http://localhost:8000`)
   - Add your Google Maps API key to `GOOGLE_MAPS_API_KEY`

3. Update Google Maps API key in HTML files:
   - Replace `YOUR_GOOGLE_MAPS_API_KEY` in:
     - `post-task.html`
     - `task-detail.html`

4. Serve the frontend using a local server:
   - Using Python: `python -m http.server 8080`
   - Using Node.js: `npx serve .`
   - Or use any static file server

5. Open `index.html` in your browser or navigate to `http://localhost:8080`

### Firebase Configuration

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Google Authentication
3. Copy your Firebase config to `frontend/config.js`

### Map Integration

The project uses **Leaflet.js** with **OpenStreetMap**, which is completely free and requires no API key or payment information. The maps are automatically loaded from CDN, so no additional setup is needed!

### Admin Access

To grant admin access to a user, update the user's email in the database to end with `@admin.taskerrand.com`, or modify the admin check logic in `backend/main.py`:

```python
is_admin=user_data.get("email", "").endswith("@admin.taskerrand.com")
```

Alternatively, you can manually set `is_admin=True` in the database for specific users.

## Project Structure

```
TaskerrandBeta/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── database.py          # Database configuration
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   ├── auth.py              # Authentication utilities
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── index.html           # Login page
│   ├── dashboard.html       # User dashboard
│   ├── post-task.html        # Task posting page
│   ├── browse-tasks.html    # Task browsing page
│   ├── task-detail.html     # Task details page
│   ├── admin-dashboard.html # Admin dashboard
│   ├── script.js            # Login logic
│   ├── dashboard.js         # Dashboard logic
│   ├── post-task.js         # Task posting logic
│   ├── browse-tasks.js      # Task browsing logic
│   ├── task-detail.js       # Task detail logic
│   ├── admin-dashboard.js   # Admin dashboard logic
│   ├── api.js               # API client
│   ├── config.js            # Configuration
│   └── style.css            # Styles
└── README.md
```

## API Endpoints

### User Endpoints
- `GET /api/users/me` - Get current user
- `GET /api/users/{user_id}` - Get user by ID

### Task Endpoints
- `GET /api/tasks` - Get all tasks (filtered by status)
- `GET /api/tasks/{task_id}` - Get task by ID
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/{task_id}` - Update task
- `DELETE /api/tasks/{task_id}` - Delete task
- `POST /api/tasks/{task_id}/accept` - Accept a task
- `POST /api/tasks/{task_id}/complete` - Mark task as complete
- `POST /api/tasks/{task_id}/confirm` - Confirm task completion
- `POST /api/tasks/{task_id}/cancel` - Cancel task
- `GET /api/users/me/tasks` - Get user's tasks

### Message Endpoints
- `GET /api/tasks/{task_id}/messages` - Get task messages
- `POST /api/messages` - Send message

### Feedback Endpoints
- `POST /api/feedback` - Create feedback
- `GET /api/users/{user_id}/feedback` - Get user feedback

### Admin Endpoints
- `GET /api/admin/users` - Get all users
- `GET /api/admin/tasks` - Get all tasks
- `DELETE /api/admin/tasks/{task_id}` - Delete task (admin)

## Database Schema

- **users**: User accounts with Firebase UID
- **tasks**: Errand posts with location, payment, status
- **messages**: Chat messages between poster and seeker
- **feedback**: Ratings and comments for completed tasks

## Deployment

### Backend
- Deploy to services like Heroku, Railway, or DigitalOcean
- Use PostgreSQL for production database
- Set environment variables for database URL

### Frontend
- Deploy to Netlify, Vercel, or any static hosting service
- Update `API_URL` in `config.js` to point to your backend
- Ensure CORS is properly configured

## Security Notes

- Firebase tokens are verified on the backend
- Admin routes require admin privileges
- Users can only modify their own tasks
- CORS is configured for development (restrict in production)

## License

This project is for educational purposes.

## Support

For issues or questions, please refer to the project documentation or contact the development team.
