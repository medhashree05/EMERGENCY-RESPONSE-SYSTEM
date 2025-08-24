# models/user.py
from sqlalchemy import Column, Integer, String, Boolean, LargeBinary, TIMESTAMP, Text, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.dialects.postgresql import UUID
import uuid

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    # Using UUID for primary key (Supabase default)
    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(Text, nullable=False)
    password_hash = Column(String(255), nullable=False)
    
    primary_emergency_contact = Column(String(255), nullable=False)
    primary_emergency_phone = Column(Text, nullable=False)
    primary_emergency_relation = Column(String(100), nullable=False)
    
    secondary_emergency_contact = Column(String(255), nullable=True)
    secondary_emergency_phone = Column(Text, nullable=True)
    secondary_emergency_relation = Column(String(100), nullable=True)
    
    street_address = Column(Text, nullable=False)
    city = Column(Text, nullable=False)          
    state = Column(Text, nullable=False)         
    zip_code = Column(Text, nullable=False)
    
    medical_conditions = Column(Text, nullable=True)
    agree_to_terms = Column(Boolean, default=False, nullable=False)
    agree_to_emergency_sharing = Column(Boolean, default=False, nullable=False)
    
    emergency_calls = Column(Integer, default=0, nullable=False)
    
    # Supabase automatically adds created_at and updated_at timestamps
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)