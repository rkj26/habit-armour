from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.database import get_session
from app.models.config import AppConfigModel
from app.pillars.status import get_effective_config

router = APIRouter(prefix="/api/config", tags=["Config"])

@router.get("")
def get_config(session: Session = Depends(get_session)):
    cfg = get_effective_config(session)
    return cfg.dict()

@router.post("")
def update_config(payload: Dict[str, Any], session: Session = Depends(get_session)):
    cfg = get_effective_config(session)
    for k, v in payload.items():
        if hasattr(cfg, k):
            setattr(cfg, k, v)
    session.add(cfg)
    session.commit()
    session.refresh(cfg)
    return {"success": True, "config": cfg.dict()}
