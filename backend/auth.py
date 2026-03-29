# backend/auth.py
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, validator
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
import re, os

router = APIRouter(prefix="/auth", tags=["auth"])

# ── Config ──
SECRET_KEY    = os.getenv("JWT_SECRET", "optha-super-secret-change-in-production-2025")
ALGORITHM     = "HS256"
ACCESS_EXPIRE  = 60 * 24 * 7   # 7 days (minutes)
REFRESH_EXPIRE = 60 * 24 * 30  # 30 days (minutes)

pwd_ctx  = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# ── In-memory DB (replace with real DB) ──
USERS_DB = {}

# ── Schemas ──
class RegisterRequest(BaseModel):
    email:    str
    password: str
    name:     Optional[str] = None

    @validator("email")
    def email_valid(cls, v):
        if not re.match(r"[^@]+@[^@]+\.[^@]+", v.lower()):
            raise ValueError("Invalid email format")
        return v.lower().strip()

    @validator("password")
    def password_strong(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

class LoginRequest(BaseModel):
    email:       str
    password:    str
    remember_me: bool = False

    @validator("email")
    def email_lower(cls, v):
        return v.lower().strip()

class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    user:          dict

class ProfileUpdateRequest(BaseModel):
    phone:       Optional[str] = None
    age:         Optional[int] = None
    dateOfBirth: Optional[str] = None
    bloodGroup:  Optional[str] = None
    occupation:  Optional[str] = None
    city:        Optional[str] = None
    state:       Optional[str] = None
    country:     Optional[str] = None

# ── Helpers ──
def hash_password(password: str) -> str:
    return pwd_ctx.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def create_token(data: dict, expires_minutes: int) -> str:
    payload = {**data, "exp": datetime.utcnow() + timedelta(minutes=expires_minutes)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

def get_user_safe(email: str) -> Optional[dict]:
    user = USERS_DB.get(email)
    if not user:
        return None
    return {
        "id":              user["id"],
        "email":           user["email"],
        "name":            user.get("name", ""),
        "profileComplete": user.get("profile_complete", False),
        "picture":         user.get("picture"),
        "provider":        user.get("provider", "email"),
        "phone":           user.get("phone"),
        "bloodGroup":      user.get("bloodGroup"),
        "age":             user.get("age"),
        "occupation":      user.get("occupation"),
        "location":        user.get("location"),
    }

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token expired or invalid")
    email = payload.get("sub")
    if not email or email not in USERS_DB:
        raise HTTPException(status_code=401, detail="User not found")
    return get_user_safe(email)

# ── Routes ──

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest):
    if body.email in USERS_DB:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists. Please sign in."
        )

    user_id = f"usr_{len(USERS_DB) + 1:06d}"
    USERS_DB[body.email] = {
        "id":               user_id,
        "email":            body.email,
        "name":             body.name or body.email.split("@")[0],
        "password_hash":    hash_password(body.password),
        "provider":         "email",
        "profile_complete": False,
        "created_at":       datetime.utcnow().isoformat(),
    }

    access  = create_token({"sub": body.email, "type": "access"},  ACCESS_EXPIRE)
    refresh = create_token({"sub": body.email, "type": "refresh"}, REFRESH_EXPIRE)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=get_user_safe(body.email)
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    user = USERS_DB.get(body.email)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="No account found with this email. Please sign up first."
        )

    if user.get("provider") != "email":
        raise HTTPException(
            status_code=400,
            detail=f"This account uses {user['provider']} sign-in. Please use that method."
        )

    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=401,
            detail="Incorrect password. Please try again."
        )

    expires = ACCESS_EXPIRE if body.remember_me else 60 * 24  # 24h default
    access  = create_token({"sub": body.email, "type": "access"},  expires)
    refresh = create_token({"sub": body.email, "type": "refresh"}, REFRESH_EXPIRE)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=get_user_safe(body.email)
    )


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.post("/oauth")
async def oauth_login(body: dict):
    """Handle Google / Apple OAuth tokens"""
    email    = body.get("email", "").lower().strip()
    name     = body.get("name", "")
    picture  = body.get("picture", "")
    provider = body.get("provider", "google")
    sub      = body.get("sub", "")

    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    if email not in USERS_DB:
        USERS_DB[email] = {
            "id":               f"usr_{len(USERS_DB) + 1:06d}",
            "email":            email,
            "name":             name,
            "provider":         provider,
            "sub":              sub,
            "picture":          picture,
            "profile_complete": False,
            "created_at":       datetime.utcnow().isoformat(),
        }
    else:
        USERS_DB[email]["picture"] = picture or USERS_DB[email].get("picture")
        USERS_DB[email]["name"]    = name or USERS_DB[email].get("name")

    access  = create_token({"sub": email, "type": "access"},  ACCESS_EXPIRE)
    refresh = create_token({"sub": email, "type": "refresh"}, REFRESH_EXPIRE)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=get_user_safe(email)
    )


@router.put("/profile")
async def update_profile(
    body: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    email = current_user["email"]
    user  = USERS_DB[email]

    if body.phone:       user["phone"]       = body.phone
    if body.age:         user["age"]         = body.age
    if body.dateOfBirth: user["dateOfBirth"] = body.dateOfBirth
    if body.bloodGroup:  user["bloodGroup"]  = body.bloodGroup
    if body.occupation:  user["occupation"]  = body.occupation
    if body.city or body.country:
        user["location"] = {
            "city":    body.city,
            "state":   body.state,
            "country": body.country,
        }

    user["profile_complete"] = True

    access  = create_token({"sub": email, "type": "access"},  ACCESS_EXPIRE)
    refresh = create_token({"sub": email, "type": "refresh"}, REFRESH_EXPIRE)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=get_user_safe(email)
    )


@router.post("/refresh")
async def refresh_token(body: dict):
    token   = body.get("refresh_token", "")
    payload = decode_token(token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    email = payload.get("sub")
    if not email or email not in USERS_DB:
        raise HTTPException(status_code=401, detail="User not found")
    access  = create_token({"sub": email, "type": "access"},  ACCESS_EXPIRE)
    refresh = create_token({"sub": email, "type": "refresh"}, REFRESH_EXPIRE)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=get_user_safe(email)
    )


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    # JWT logout is client-side; use Redis token blacklist for real invalidation
    return {"message": "Logged out successfully"}