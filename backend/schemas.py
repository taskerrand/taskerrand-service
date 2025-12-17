from pydantic import BaseModel, EmailStr
from typing import Optional
from typing import List
from datetime import datetime

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    photo_url: Optional[str] = None
    phone: Optional[str] = None


class UserCreate(UserBase):
    firebase_uid: str


class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    address: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None

    class Config:
        from_attributes = True


class UserProfileResponse(BaseModel):
    id: int
    firebase_uid: str
    email: str
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    address: Optional[str] = None
    contact_number: Optional[str] = None
    photo_url: Optional[str] = None
    phone: Optional[str] = None
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True





class UserResponse(UserBase):
    id: int
    firebase_uid: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    address: Optional[str] = None
    contact_number: Optional[str] = None
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Feedback Schemas
class FeedbackBase(BaseModel):
    rating: int
    comment: Optional[str] = None


class FeedbackCreate(FeedbackBase):
    task_id: int
    seeker_id: int


class FeedbackResponse(FeedbackBase):
    id: int
    task_id: int
    poster_id: int
    seeker_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Task Schemas
class TaskBase(BaseModel):
    title: str
    description: str
    payment: float
    contact_number: Optional[str] = None
    location_lat: float
    location_lng: float
    location_address: Optional[str] = None
    schedule: Optional[datetime] = None


# Location schemas
class TaskLocationIn(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None
    idx: Optional[int] = None


class TaskLocationResponse(BaseModel):
    id: int
    lat: float
    lng: float
    address: Optional[str] = None
    idx: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TaskCreate(TaskBase):
    # New: allow submitting multiple locations as an ordered list
    locations: Optional[List[TaskLocationIn]] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    payment: Optional[float] = None
    contact_number: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    location_address: Optional[str] = None
    schedule: Optional[datetime] = None
    status: Optional[str] = None
    # Allow updating locations
    locations: Optional[List[TaskLocationIn]] = None


class TaskResponse(TaskBase):
    id: int
    status: str
    poster_id: int
    seeker_id: Optional[int] = None
    seeker: Optional[UserResponse] = None
    proof_image: Optional[str] = None
    report_count: Optional[int] = 0
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    feedback: Optional[FeedbackResponse] = None
    locations: Optional[List[TaskLocationResponse]] = None

    class Config:
        from_attributes = True


# Message Schemas
class MessageBase(BaseModel):
    content: str


class MessageCreate(MessageBase):
    task_id: int


class MessageResponse(MessageBase):
    id: int
    task_id: int
    sender_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Task Report Schemas
class TaskReportBase(BaseModel):
    report_type: str
    description: Optional[str] = None


class TaskReportCreate(TaskReportBase):
    task_id: int


class TaskReportResponse(TaskReportBase):
    id: int
    task_id: int
    reporter_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Notification Schemas
class NotificationBase(BaseModel):
    task_id: Optional[int] = None
    title: str
    message: str
    notif_type: str


class NotificationResponse(NotificationBase):
    id: int
    user_id: int
    seen: bool
    created_at: datetime

    class Config:
        from_attributes = True
