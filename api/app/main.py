from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text

from . import auth, profiles

app = FastAPI(title="SSciX API", version="0.1.0", docs_url="/api/v1/docs",
              openapi_url="/api/v1/openapi.json", redoc_url=None)


@app.middleware("http")
async def protect_responses(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.exception_handler(RequestValidationError)
async def invalid_request(_request: Request, exc: RequestValidationError):
    fields = sorted({str(error["loc"][-1]) for error in exc.errors() if error["loc"]})
    return JSONResponse(status_code=422, content={
        "detail": "Verifique os campos indicados e tente novamente.",
        "fields": fields,
    })


v1 = APIRouter(prefix="/api/v1")


@v1.get("/health", tags=["estado"])
def health(db: auth.DB):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


v1.include_router(auth.router)
v1.include_router(profiles.router)
app.include_router(v1)
