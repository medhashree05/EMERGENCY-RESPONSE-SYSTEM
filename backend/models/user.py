# models/user.py
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, Integer, String, Boolean

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)  # stored plaintext for login
    phone = Column(String, unique=True, nullable=False)  # encrypted
    password_hash = Column(String, nullable=False)

    primary_emergency_contact = Column(String, nullable=False)
    primary_emergency_phone = Column(String, nullable=False)  # encrypted
    primary_emergency_relation = Column(String, nullable=False)

    secondary_emergency_contact = Column(String, nullable=True)
    secondary_emergency_phone = Column(String, nullable=True)  # encrypted
    secondary_emergency_relation = Column(String, nullable=True)

    street_address = Column(String, nullable=False)  # encrypted
    city = Column(String, nullable=True)             # encrypted
    state = Column(String, nullable=True)            # encrypted
    zip_code = Column(String, nullable=True)         # encrypted
    medical_conditions = Column(String, nullable=True)

    agree_to_terms = Column(Boolean, nullable=False)
    agree_to_emergency_sharing = Column(Boolean, nullable=False)
    emergency_calls = Column(Integer, default=0)
