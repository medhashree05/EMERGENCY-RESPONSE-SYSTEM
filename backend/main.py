# main.py
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from twilio.rest import Client
import os, random, time

from database import SessionLocal, engine
from models.user import Base, User
from utils.security import encrypt_data, hash_password, verify_password, create_access_token, decode_access_token

load_dotenv()

# create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ERS Auth API")

# CORS - add your frontend origins
origins = ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Twilio client (read from env)
TW_SID = os.getenv("TWILIO_ACCOUNT_SID")
TW_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TW_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
if not all([TW_SID, TW_TOKEN, TW_NUMBER]):
    # allow continuing if Twilio not configured; but sending will fail
    client = None
else:
    client = Client(TW_SID, TW_TOKEN)

# In-memory OTP and pending store (for demonstration only)
otp_storage = {}
pending_users = {}

# DB dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic models
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

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    rememberMe: bool | None = False

# OTP endpoint
@app.post("/send_otp")
def send_otp(user: UserCreate):
    current_time = time.time()
    phone = user.phone.strip()
    # Enforce 60s cooldown
    stored = otp_storage.get(phone)
    if stored:
        elapsed = current_time - stored["timestamp"]
        if elapsed < 60:
            raise HTTPException(status_code=429, detail=f"Please wait {int(60-elapsed)} seconds before requesting another OTP")

    otp = str(random.randint(100000, 999999))
    otp_storage[phone] = {"otp": otp, "timestamp": current_time}
    pending_users[phone] = user.dict()

    # Send via Twilio if configured
    if client:
        try:
            message = client.messages.create(
                body=f"Your ERS OTP is: {otp}",
                from_=TW_NUMBER,
                to=f"+91{phone}"
            )
        except Exception as e:
            # Log and raise
            raise HTTPException(status_code=500, detail=f"Failed to send OTP: {str(e)}")

    return {"message": "OTP generated and (attempted) to send", "phone": phone}

# Verify OTP and register
@app.post("/verify_otp")
def verify_otp(data: VerifyRequest, db: Session = Depends(get_db)):
    mobile = data.mobile.strip()
    otp_data = otp_storage.get(mobile)
    if not otp_data:
        raise HTTPException(status_code=400, detail="No OTP found for this number")

    if time.time() - otp_data["timestamp"] > 300:
        otp_storage.pop(mobile, None)
        pending_users.pop(mobile, None)
        raise HTTPException(status_code=400, detail="OTP expired")

    if otp_data["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    # OTP valid: register user
    user_data = pending_users.pop(mobile, None)
    otp_storage.pop(mobile, None)
    if not user_data:
        raise HTTPException(status_code=400, detail="No pending user data for this number")

    # Check if email exists
    email = user_data["email"].strip().lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with that email already exists")

    hashed_pw = hash_password(user_data["password"])
    db_user = User(
        first_name=user_data["first_name"],
        last_name=user_data["last_name"],
        email=email,
        phone=encrypt_data(user_data["phone"]),
        password_hash=hashed_pw,
        primary_emergency_contact=user_data["primary_emergency_contact"],
        primary_emergency_phone=encrypt_data(user_data["primary_emergency_phone"]),
        primary_emergency_relation=user_data["primary_emergency_relation"],
        secondary_emergency_contact=user_data.get("secondary_emergency_contact"),
        secondary_emergency_phone=encrypt_data(user_data["secondary_emergency_phone"]) if user_data.get("secondary_emergency_phone") else None,
        secondary_emergency_relation=user_data.get("secondary_emergency_relation"),
        street_address=encrypt_data(user_data["street_address"]),
        city=encrypt_data(user_data["city"]) if user_data.get("city") else None,
        state=encrypt_data(user_data["state"]) if user_data.get("state") else None,
        zip_code=encrypt_data(user_data["zip_code"]) if user_data.get("zip_code") else None,
        medical_conditions=user_data.get("medical_conditions"),
        agree_to_terms=user_data["agree_to_terms"],
        agree_to_emergency_sharing=user_data["agree_to_emergency_sharing"],
        emergency_calls=0
    )

    try:
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")

    return {"message": "User registered", "user_id": db_user.user_id}

# Login endpoint (issues JWT)
@app.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    expires_minutes = 60 if not payload.rememberMe else 60 * 24 * 7
    token = create_access_token(subject=str(user.user_id), extra_claims={"email": user.email}, expires_minutes=expires_minutes)
    return {"access_token": token, "expires_in": expires_minutes * 60}

# Protected route to fetch current user
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

@app.get("/me")
def me(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub"))
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": f"{user.first_name} {user.last_name}"
    }
