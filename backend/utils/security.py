# utils/security.py
from cryptography.fernet import Fernet
from passlib.context import CryptContext
from dotenv import load_dotenv
import os

load_dotenv()

# Generate a key only once and store it in .env
# Fernet.generate_key()
SECRET_KEY = os.getenv("FERNET_KEY").encode()  # load from .env
fernet = Fernet(SECRET_KEY)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def encrypt_data(plain_text: str) -> bytes:
    return fernet.encrypt(plain_text.encode())

def decrypt_data(cipher_text: bytes) -> str:
    return fernet.decrypt(cipher_text).decode()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)