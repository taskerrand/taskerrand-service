# Taskerrand Backend

FastAPI backend for the Taskerrand platform.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
python main.py
```

Or using uvicorn directly:
```bash
uvicorn main:app --reload
```

## Database

The backend now targets **MySQL** (compatible with XAMPP/MariaDB) by default using the connection string `mysql+pymysql://root:@localhost/taskerrand_db`.

1. Import `mysql_schema.sql` into phpMyAdmin (or run via the MySQL client) to create the `taskerrand_db` schema and tables.
2. If your MySQL root user has a password or you prefer a different database/user, update the `DATABASE_URL` environment variable accordingly:

```bash
set DATABASE_URL=mysql+pymysql://username:password@localhost/taskerrand_db
```

Other SQLAlchemy-compatible databases (SQLite, PostgreSQL, etc.) still work—just point `DATABASE_URL` to the appropriate URI.

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Authentication

The API uses Firebase ID tokens for authentication. Include the token in the Authorization header:
```
Authorization: Bearer <firebase_id_token>
```

## Environment Variables

- `DATABASE_URL`: Database connection string (default: mysql+pymysql://root:@localhost/taskerrand_db)

