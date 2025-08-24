# utils/security.py
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from cryptography.fernet import Fernet
from passlib.context import CryptContext
from jose import jwt, JWTError
from dotenv import load_dotenv

load_dotenv()

# ----- Fernet (PII encryption) -----
FERNET_KEY = os.getenv("FERNET_KEY")
if not FERNET_KEY:
    raise RuntimeError("FERNET_KEY missing from environment variables")
try:
    fernet = Fernet(FERNET_KEY.encode())
except Exception as e:
    raise RuntimeError(f"Invalid FERNET_KEY: {e}") from e


def encrypt_data(plain_text: Optional[str]) -> Optional[str]:
    """
    Encrypt a plain string using Fernet. Returns None if input is None.
    """
    if plain_text is None:
        return None
    return fernet.encrypt(plain_text.encode()).decode()


def decrypt_data(cipher_text: Optional[str]) -> Optional[str]:
    """
    Decrypt a Fernet-encrypted string. Returns None if input is falsy.
    Raises an exception if decryption fails.
    """
    if not cipher_text:
        return None
    return fernet.decrypt(cipher_text.encode()).decode()


# ----- Password hashing (bcrypt via passlib) -----
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """
    Hash a plaintext password using bcrypt.
    """
    if password is None:
        raise ValueError("password must not be None")
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against a bcrypt hash.
    """
    if plain_password is None or hashed_password is None:
        return False
    return pwd_context.verify(plain_password, hashed_password)


# ----- JWT helpers -----
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET missing from environment variables")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
try:
    JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
except ValueError:
    JWT_EXPIRE_MINUTES = 60


def create_access_token(
    subject: str,
    extra_claims: Optional[Dict[str, Any]] = None,
    expires_minutes: Optional[int] = None,
) -> str:
    if not subject:
        raise ValueError("subject is required to create a token")

    to_encode: Dict[str, Any] = {"sub": subject}
    if extra_claims:
        for k, v in extra_claims.items():
            if k in ("sub", "exp"):
                continue
            to_encode[k] = v

    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes or JWT_EXPIRE_MINUTES)
    to_encode["exp"] = expire
    # jose.jwt will convert datetime -> int (unix) automatically
    token = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a JWT token. Returns the payload dict on success.
    Raises jose.JWTError (or its subclasses) on failure (expired, invalid, etc).
    """
    if not token:
        raise JWTError("Token is required")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if "sub" not in payload:
            raise JWTError("Token payload missing 'sub' claim")
        return payload
    except JWTError as exc:
        
        raise exc
