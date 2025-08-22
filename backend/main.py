from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from twilio.rest import Client
import random, os
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

# Load env variables
load_dotenv()

app = FastAPI()

origins = [
    "http://localhost:3000",  # React app
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,   # domains allowed
    allow_credentials=True,
    allow_methods=["*"],     # allow all HTTP methods
    allow_headers=["*"],     # allow all headers
)
# Twilio setup
account_sid = os.getenv("TWILIO_ACCOUNT_SID")
auth_token = os.getenv("TWILIO_AUTH_TOKEN")
twilio_number = os.getenv("TWILIO_PHONE_NUMBER")

client = Client(account_sid, auth_token)

# Temporary OTP storage (use DB/Redis in production)
otp_storage = {}

class RegisterRequest(BaseModel):
    mobile: str

class VerifyRequest(BaseModel):
    mobile: str
    otp: str

@app.post("/send_otp")
def send_otp(data: RegisterRequest):
    mobile = data.mobile
    otp = str(random.randint(100000, 999999))
    otp_storage[mobile] = otp

    try:
        message = client.messages.create(
            body=f"Your ERS OTP is: {otp}",
            from_=twilio_number,
            to="+916305205840"
        )
        return {"message": "OTP sent successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/verify_otp")
def verify_otp(data: VerifyRequest):
    mobile, otp = data.mobile, data.otp
    if otp_storage.get(mobile) == otp:
       
        otp_storage.pop(mobile)
        return {"message": "OTP verified successfully"}
    else:
        raise HTTPException(status_code=400, detail="Invalid OTP")
