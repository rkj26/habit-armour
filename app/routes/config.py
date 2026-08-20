from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import TypeAdapter, ValidationError
from sqlmodel import Session

from app.database import get_session
from app.models.config import AppConfigModel
from app.pillars.status import get_effective_config

router = APIRouter(prefix="/api/config", tags=["Config"])


@router.get("")
def get_config(session: Session = Depends(get_session)):
    cfg = get_effective_config(session)
    return cfg.model_dump()


def _coerce_to_field_type(field_name: str, value: Any) -> Any:
    """
    Validates a value against the column's declared type. SQLModel skips
    validation on table models, so an unchecked setattr would happily persist
    e.g. morningStart="abc" and make every later /api/status raise a 500.
    """
    annotation = AppConfigModel.model_fields[field_name].annotation
    return TypeAdapter(annotation).validate_python(value)


@router.post("")
def update_config(payload: dict[str, Any], session: Session = Depends(get_session)):
    cfg = get_effective_config(session)

    coerced: dict[str, Any] = {}
    rejected: dict[str, str] = {}
    for key, value in payload.items():
        if key == "id" or key not in AppConfigModel.model_fields:
            continue
        try:
            coerced[key] = _coerce_to_field_type(key, value)
        except ValidationError as exc:
            rejected[key] = exc.errors()[0].get("msg", "invalid value")

    if rejected:
        raise HTTPException(
            status_code=422, detail={"message": "Rejected invalid config values", "fields": rejected}
        )

    for key, value in coerced.items():
        setattr(cfg, key, value)
    session.add(cfg)
    session.commit()
    session.refresh(cfg)
    return {"success": True, "config": cfg.model_dump()}
