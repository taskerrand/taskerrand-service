from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    posted_tasks = relationship("Task", foreign_keys="Task.poster_id", back_populates="poster")
    accepted_tasks = relationship("Task", foreign_keys="Task.seeker_id", back_populates="seeker")
    sent_messages = relationship("Message", back_populates="sender")
    given_feedback = relationship("Feedback", foreign_keys="Feedback.poster_id", back_populates="poster")
    received_feedback = relationship("Feedback", foreign_keys="Feedback.seeker_id", back_populates="seeker")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    payment = Column(Float, nullable=False)
    contact_number = Column(String, nullable=True)
    location_lat = Column(Float, nullable=False)
    location_lng = Column(Float, nullable=False)
    location_address = Column(String, nullable=True)
    schedule = Column(DateTime, nullable=True)
    status = Column(String, default="available")  # available, ongoing, pending_confirmation, completed, cancelled
    poster_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seeker_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    poster = relationship("User", foreign_keys=[poster_id], back_populates="posted_tasks")
    seeker = relationship("User", foreign_keys=[seeker_id], back_populates="accepted_tasks")
    messages = relationship("Message", back_populates="task", cascade="all, delete-orphan")
    feedback = relationship("Feedback", back_populates="task", uselist=False, cascade="all, delete-orphan")
    # Reports associated with this task; deleted when task is deleted
    reports = relationship("TaskReport", back_populates="task", cascade="all, delete-orphan")
    # Notifications referencing this task; deleted when task is deleted
    notifications = relationship("Notification", foreign_keys="Notification.task_id", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    task = relationship("Task", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages")

class Feedback(Base):
    __tablename__ = "feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False, unique=True)
    poster_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seeker_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    task = relationship("Task", back_populates="feedback")
    poster = relationship("User", foreign_keys=[poster_id], back_populates="given_feedback")
    seeker = relationship("User", foreign_keys=[seeker_id], back_populates="received_feedback")


class TaskReport(Base):
    __tablename__ = "task_reports"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    report_type = Column(String, nullable=False)  # fraudulent, illegal, inappropriate, other
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    task = relationship("Task", back_populates="reports")
    reporter = relationship("User")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    notif_type = Column(String, nullable=False) # message, task_update, system
    seen = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="notifications")
    task = relationship("Task", foreign_keys=[task_id], back_populates="notifications")
