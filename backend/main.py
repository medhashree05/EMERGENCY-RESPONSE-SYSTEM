from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from models.user import Base, User
from utils.security import encrypt_data, hash_password
 
import os, random, time
from dotenv import load_dotenv
from twilio.rest import Client
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# Supabase PostgreSQL connection
DATABASE_URL = os.getenv("SUPABASE_DATABASE_URL")

if not DATABASE_URL: 
    raise ValueError("SUPABASE_DATABASE_URL environment variable is not set")

# Enhanced connection configuration for Supabase
engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True,
    pool_recycle=300,
    pool_timeout=20,
    max_overflow=0,
    echo=False  # Set to True for SQL debugging
)

SessionLocal = sessionmaker(bind=engine)
app = FastAPI()
# Test database connection first
@app.on_event("startup")
async def startup_event():
    try:
        # Test connection
        with engine.connect() as connection:
            connection.execute("SELECT 1")
        print("✅ Database connection successful")
        
        # Create tables
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created/verified successfully")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("Please check your SUPABASE_DATABASE_URL in the .env file")
        raise

# FastAPI app


origins = ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Twilio setup
account_sid = os.getenv("TWILIO_ACCOUNT_SID")
auth_token = os.getenv("TWILIO_AUTH_TOKEN")
twilio_number = os.getenv("TWILIO_PHONE_NUMBER")
client = Client(account_sid, auth_token)

otp_storage = {}        
pending_users = {}      


# Models
class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    password: str
    primary_emergency_contact: str
    primary_emergency_phone: str
    primary_emergency_relation: str
    secondary_emergency_contact: str | None = None
    secondary_emergency_phone: str | None = None
    secondary_emergency_relation: str | None = None
    street_address: str
    city: str 
    state: str 
    zip_code: str 
    medical_conditions: str | None = None
    agree_to_terms: bool
    agree_to_emergency_sharing: bool


class VerifyRequest(BaseModel):
    mobile: str
    otp: str


# Test database connection endpoint
@app.get("/test_db")
def test_database():
    try:
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        return {"status": "success", "message": "Database connection working"}
    except Exception as e:
        return {"status": "error", "message": f"Database connection failed: {str(e)}"}


# Send OTP with cooldown
@app.post("/send_otp")
def send_otp(user: UserCreate):
    current_time = time.time()
    
    # Check if already sent & enforce 60s cooldown
    if user.phone in otp_storage:
        elapsed = current_time - otp_storage[user.phone]["timestamp"]
        if elapsed < 60:
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {int(60 - elapsed)} seconds before requesting another OTP"
            )

    # Generate new OTP
    otp = str(random.randint(100000, 999999))
    otp_storage[user.phone] = {"otp": otp, "timestamp": current_time}
    pending_users[user.phone] = user.dict()

    try:
        message = client.messages.create(
            body=f"Your ERS OTP is: {otp}",
            from_=twilio_number,
            to=f"+91{user.phone}"  # Must be in +91xxxxxxxxxx format
        )
        return {"message": "OTP sent successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Verify OTP and register user
@app.post("/verify_otp")
def verify_otp(data: VerifyRequest):
    mobile, otp = data.mobile, data.otp
    otp_data = otp_storage.get(mobile)

    if not otp_data:
        raise HTTPException(status_code=400, detail="No OTP found for this number")

    # Expire OTP after 5 minutes
    if time.time() - otp_data["timestamp"] > 300:
        otp_storage.pop(mobile, None)
        pending_users.pop(mobile, None)
        raise HTTPException(status_code=400, detail="OTP expired, please request a new one")

    # Validate OTP
    if otp_data["otp"] == otp:
        otp_storage.pop(mobile, None)

        # Get pending user data
        user_data = pending_users.pop(mobile, None)
        if not user_data:
            raise HTTPException(status_code=400, detail="No user data found for this number")

        db = SessionLocal()
        try:
            hashed_password = hash_password(user_data["password"])
            db_user = User(
                first_name=user_data["first_name"],
                last_name=user_data["last_name"],
                email=user_data["email"],
                phone=encrypt_data(user_data["phone"]),
                password_hash=hashed_password,
                primary_emergency_contact=user_data["primary_emergency_contact"],
                primary_emergency_phone=encrypt_data(user_data["primary_emergency_phone"]),
                primary_emergency_relation=user_data["primary_emergency_relation"],
                secondary_emergency_contact=user_data["secondary_emergency_contact"],
                secondary_emergency_phone=encrypt_data(user_data["secondary_emergency_phone"]) if user_data["secondary_emergency_phone"] else None,
                secondary_emergency_relation=user_data["secondary_emergency_relation"],
                street_address=encrypt_data(user_data["street_address"]),
                city=encrypt_data(user_data["city"]),   # Fixed: removed unnecessary if check
                state=encrypt_data(user_data["state"]), # Fixed: removed unnecessary if check 
                zip_code=encrypt_data(user_data["zip_code"]), # Fixed: removed unnecessary if check
                medical_conditions=user_data["medical_conditions"],
                agree_to_terms=user_data["agree_to_terms"],
                agree_to_emergency_sharing=user_data["agree_to_emergency_sharing"],
                emergency_calls=0   
            )

            db.add(db_user)
            db.commit()
            db.refresh(db_user)
            return {"message": "OTP verified & user registered", "user_id": db_user.user_id}
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))
        finally:
            db.close()
    else:
        raise HTTPException(status_code=400, detail="Invalid OTP")