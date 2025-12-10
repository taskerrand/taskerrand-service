from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import uvicorn
from typing import List, Optional
from datetime import datetime

from database import SessionLocal, engine, Base
from models import User, Task, Message, Feedback, TaskReport, Notification
from schemas import (
    UserCreate, UserResponse, TaskCreate, TaskUpdate, TaskResponse,
    MessageCreate, MessageResponse, FeedbackCreate, FeedbackResponse,
    TaskReportCreate, TaskReportResponse, NotificationResponse
)
from auth import verify_firebase_token, get_current_user

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Taskerrand API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Dependency to get current user
async def get_current_user_db(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    print(f"DEBUG: Received token (first 20 chars): {token[:20]}...")
    user_data = await verify_firebase_token(token)
    if not user_data:
        print("ERROR: Token verification failed")
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    
    # Get or create user in database
    user = db.query(User).filter(User.firebase_uid == user_data["uid"]).first()
    if not user:
        user = User(
            firebase_uid=user_data["uid"],
            email=user_data.get("email", ""),
            name=user_data.get("name", ""),
            photo_url=user_data.get("picture", ""),
            is_admin=user_data.get("email") == ("neowarsia@gmail.com")  # Admin check
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    return user

    return user

# Helper function to create notification
def create_notification(db: Session, user_id: int, title: str, message: str, notif_type: str, task_id: Optional[int] = None):
    notification = Notification(
        user_id=user_id,
        task_id=task_id,
        title=title,
        message=message,
        notif_type=notif_type
    )
    db.add(notification)
    db.commit()

# ==================== USER ENDPOINTS ====================

@app.get("/api/users/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user_db)):
    return current_user

@app.get("/api/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, current_user: User = Depends(get_current_user_db), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ==================== TASK ENDPOINTS ====================

@app.post("/api/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task: TaskCreate,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    db_task = Task(
        **task.dict(),
        poster_id=current_user.id,
        status="available"
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.get("/api/tasks", response_model=List[TaskResponse])
async def get_tasks(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    query = db.query(Task)
    if status_filter:
        query = query.filter(Task.status == status_filter)
    else:
        # Regular users see available tasks, admins see all
        if not current_user.is_admin:
            query = query.filter(Task.status == "available")
    return query.order_by(Task.created_at.desc()).all()


@app.get("/api/tasks/search", response_model=List[TaskResponse])
async def search_tasks(
    query: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """Search tasks by title (case-insensitive substring match).

    Regular users will only see available tasks. Admins can search across all statuses.
    """
    q = db.query(Task)
    # Apply status filter or restrict to available tasks for non-admins
    if status_filter:
        q = q.filter(Task.status == status_filter)
    else:
        if not current_user.is_admin:
            q = q.filter(Task.status == "available")

    if query:
        # Use case-insensitive match
        try:
            q = q.filter(Task.title.ilike(f"%{query}%"))
        except Exception:
            # Fallback to naive contains if ilike not supported
            q = q.filter(Task.title.contains(query))

    return q.order_by(Task.created_at.desc()).all()

@app.get("/api/tasks/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.put("/api/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    task_update: TaskUpdate,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Only poster or admin can update
    if task.poster_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to update this task")
    
    for key, value in task_update.dict(exclude_unset=True).items():
        setattr(task, key, value)
    
    db.commit()
    db.refresh(task)
    return task

@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Only poster or admin can delete
    if task.poster_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this task")
    
    # Delete any notifications referencing this task first to avoid FK constraint issues
    try:
        db.query(Notification).filter(Notification.task_id == task_id).delete(synchronize_session=False)
    except Exception:
        # If deletion of notifications fails for any reason, log and continue
        pass
    
    db.delete(task)
    db.commit()
    return None

@app.post("/api/tasks/{task_id}/accept", response_model=TaskResponse)
async def accept_task(
    task_id: int,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.status != "available":
        raise HTTPException(status_code=400, detail="Task is not available")
    
    if task.poster_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot accept your own task")
    
    task.status = "ongoing"
    task.seeker_id = current_user.id
    task.accepted_at = datetime.utcnow()
    
    db.commit()
    db.refresh(task)
    
    # Notify poster
    create_notification(
        db, 
        task.poster_id, 
        "Task Accepted", 
        f"Your task '{task.title}' has been accepted by {current_user.name or current_user.email}.", 
        "task_update", 
        task.id
    )
    
    return task

@app.post("/api/tasks/{task_id}/complete", response_model=TaskResponse)
async def complete_task(
    task_id: int,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.status != "ongoing":
        raise HTTPException(status_code=400, detail="Task is not ongoing")
    
    # Only seeker can mark as complete
    if task.seeker_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the seeker can mark task as complete")
    
    task.status = "pending_confirmation"
    
    db.commit()
    db.refresh(task)
    
    # Notify poster
    create_notification(
        db, 
        task.poster_id, 
        "Task Completed", 
        f"Your task '{task.title}' has been marked as completed. Please confirm.", 
        "task_update", 
        task.id
    )
    
    return task

@app.post("/api/tasks/{task_id}/confirm", response_model=TaskResponse)
async def confirm_task(
    task_id: int,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.status != "pending_confirmation":
        raise HTTPException(status_code=400, detail="Task is not pending confirmation")
    
    # Only poster can confirm
    if task.poster_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the poster can confirm task completion")
    
    task.status = "completed"
    task.completed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(task)
    
    # Notify seeker
    if task.seeker_id:
        create_notification(
            db, 
            task.seeker_id, 
            "Task Confirmed", 
            f"The completion of task '{task.title}' has been confirmed. Payment should be released.", 
            "task_update", 
            task.id
        )
    
    return task

@app.post("/api/tasks/{task_id}/cancel", response_model=TaskResponse)
async def cancel_task(
    task_id: int,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Only poster can cancel available tasks, both can cancel ongoing
    if task.status == "available":
        if task.poster_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the poster can cancel available tasks")
        # Poster cancelling an available task: mark as cancelled
        task.status = "cancelled"
        task.seeker_id = None
        task.accepted_at = None
    elif task.status == "ongoing":
        if task.poster_id != current_user.id and task.seeker_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this task")
        # If the seeker cancels an ongoing task, make it available again for others.
        # If the poster cancels an ongoing task, mark it as cancelled.
        if current_user.id == task.seeker_id and task.poster_id != task.seeker_id:
            task.status = "available"
        else:
            task.status = "cancelled"
        task.seeker_id = None
        task.accepted_at = None
    else:
        raise HTTPException(status_code=400, detail="Cannot cancel task in current status")
    
    db.commit()
    db.refresh(task)
    
    # Notify other party if applicable
    if task.status == "cancelled":
        if current_user.id == task.poster_id and task.seeker_id:
            create_notification(
                db, 
                task.seeker_id, 
                "Task Cancelled", 
                f"The task '{task.title}' has been cancelled by the poster.", 
                "task_update", 
                task.id
            )
        elif current_user.id == task.seeker_id and task.poster_id:
             create_notification(
                db, 
                task.poster_id, 
                "Task Cancelled", 
                f"The task '{task.title}' has been cancelled by the seeker.", 
                "task_update", 
                task.id
            )

    return task

@app.get("/api/users/me/tasks", response_model=List[TaskResponse])
async def get_my_tasks(
    task_type: Optional[str] = None,  # "posted" or "accepted"
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    if task_type == "posted":
        return db.query(Task).filter(Task.poster_id == current_user.id).order_by(Task.created_at.desc()).all()
    elif task_type == "accepted":
        return db.query(Task).filter(Task.seeker_id == current_user.id).order_by(Task.created_at.desc()).all()
    else:
        # Return all tasks user is involved in
        return db.query(Task).filter(
            (Task.poster_id == current_user.id) | (Task.seeker_id == current_user.id)
        ).order_by(Task.created_at.desc()).all()

# ==================== MESSAGE ENDPOINTS ====================

@app.post("/api/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_message(
    message: MessageCreate,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    # Verify user is part of the task
    task = db.query(Task).filter(Task.id == message.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.poster_id != current_user.id and task.seeker_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to send message for this task")
    
    db_message = Message(
        **message.dict(),
        sender_id=current_user.id
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    
    # Notify recipient
    recipient_id = task.poster_id if current_user.id == task.seeker_id else task.seeker_id
    if recipient_id:
        create_notification(
            db, 
            recipient_id, 
            "New Message", 
            f"You have a new message regarding task '{task.title}'.", 
            "message", 
            task.id
        )
    
    return db_message

@app.get("/api/tasks/{task_id}/messages", response_model=List[MessageResponse])
async def get_task_messages(
    task_id: int,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    # Verify user is part of the task
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.poster_id != current_user.id and task.seeker_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view messages for this task")
    
    return db.query(Message).filter(Message.task_id == task_id).order_by(Message.created_at.asc()).all()

# ==================== FEEDBACK ENDPOINTS ====================

@app.post("/api/feedback", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def create_feedback(
    feedback: FeedbackCreate,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    # Verify task is completed and user is the poster
    task = db.query(Task).filter(Task.id == feedback.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.status != "completed":
        raise HTTPException(status_code=400, detail="Can only leave feedback on completed tasks")
    
    if task.poster_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the poster can leave feedback")
    
    if task.seeker_id != feedback.seeker_id:
        raise HTTPException(status_code=400, detail="Invalid seeker for this task")
    
    # Check if feedback already exists
    existing = db.query(Feedback).filter(
        Feedback.task_id == feedback.task_id,
        Feedback.poster_id == current_user.id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Feedback already provided for this task")
    
    db_feedback = Feedback(
        **feedback.dict(),
        poster_id=current_user.id
    )
    db.add(db_feedback)
    db.commit()
    db.refresh(db_feedback)
    return db_feedback

@app.get("/api/users/{user_id}/feedback", response_model=List[FeedbackResponse])
async def get_user_feedback(
    user_id: int,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    return db.query(Feedback).filter(Feedback.seeker_id == user_id).order_by(Feedback.created_at.desc()).all()

# ==================== ADMIN ENDPOINTS ====================

@app.get("/api/admin/users", response_model=List[UserResponse])
async def get_all_users(
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return db.query(User).all()

@app.get("/api/admin/tasks", response_model=List[TaskResponse])
async def get_all_tasks(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = db.query(Task)
    if status_filter:
        query = query.filter(Task.status == status_filter)
    return query.order_by(Task.created_at.desc()).all()

@app.delete("/api/admin/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Delete any notifications referencing this task first to avoid FK constraint issues
    try:
        db.query(Notification).filter(Notification.task_id == task_id).delete(synchronize_session=False)
    except Exception:
        # If deletion of notifications fails for any reason, log and continue
        pass
    
    # Delete any reports related to this task to avoid FK constraint issues
    try:
        db.query(TaskReport).filter(TaskReport.task_id == task_id).delete(synchronize_session=False)
    except Exception:
        # If deletion of reports fails for any reason, continue to attempt deleting the task
        pass

    db.delete(task)
    db.commit()
    return None

# ==================== TASK REPORT ENDPOINTS ====================

@app.post("/api/reports", response_model=TaskReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    report: TaskReportCreate,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    # Verify task exists
    task = db.query(Task).filter(Task.id == report.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Create report
    # Prevent users from reporting their own tasks
    if task.poster_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot report your own task")

    db_report = TaskReport(
        task_id=report.task_id,
        reporter_id=current_user.id,
        report_type=report.report_type,
        description=report.description
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


@app.get("/api/reports", response_model=List[TaskReportResponse])
async def get_reports(
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    # Only admins can view reports
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return db.query(TaskReport).order_by(TaskReport.created_at.desc()).all()


@app.get("/api/reports/{report_id}", response_model=TaskReportResponse)
async def get_report(
    report_id: int,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    # Only admins can view reports
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    report = db.query(TaskReport).filter(TaskReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return report


@app.delete("/api/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: int,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    # Only admins can delete reports
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    report = db.query(TaskReport).filter(TaskReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    db.delete(report)
    db.commit()
    return None


# ==================== NOTIFICATION ENDPOINTS ====================

@app.get("/api/notifications", response_model=List[NotificationResponse])
async def get_notifications(
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    return db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).all()

@app.put("/api/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    if notification.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    notification.seen = True
    db.commit()
    return None

@app.delete("/api/notifications/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    if notification.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(notification)
    db.commit()
    return None

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8000)

