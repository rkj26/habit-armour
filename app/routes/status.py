import socket
from fastapi import APIRouter, Depends
from sqlmodel import Session
from app.database import get_session
from app.pillars.status import compute_status, set_test_lock

router = APIRouter(prefix="/api", tags=["Status"])

def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

@router.get("/status")
async def get_status(session: Session = Depends(get_session)):
    return await compute_status(session)

@router.post("/test-lock")
def trigger_test_lock():
    set_test_lock(15)
    return {"success": True, "message": "Test lock triggered. It will lock the device for 15 seconds."}

@router.get("/ip")
def get_ip():
    return {"ip": get_local_ip()}
