# models/user.py
from sqlalchemy import Column, Integer, String, Boolean, LargeBinary, TIMESTAMP, Text, func
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String)
    last_name = Column(String)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(Text, nullable=False)
    password_hash = Column(String, nullable=False)

    primary_emergency_contact = Column(String, nullable=False)
    primary_emergency_phone = Column(Text, nullable=False)
    primary_emergency_relation = Column(String, nullable=False)

    secondary_emergency_contact = Column(String, nullable=True)
    secondary_emergency_phone = Column(Text, nullable=True)
    secondary_emergency_relation = Column(String, nullable=True)

    street_address = Column(Text, nullable=False)
    city = Column(Text, nullable=False)     
    state = Column(Text, nullable=False)    
    zip_code = Column(Text, nullable=False)

    medical_conditions = Column(Text, nullable=True)
    agree_to_terms = Column(Boolean, default=False)
    agree_to_emergency_sharing = Column(Boolean, default=False)

    emergency_calls = Column(Integer, default=0)  