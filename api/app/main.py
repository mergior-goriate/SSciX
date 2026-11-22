from fastapi import APIRouter, Depends, FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text

from . import academic, admin, analytics, auth, blog, commerce, messages, network, profiles

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
v1.include_router(commerce.public)
v1.include_router(blog.public)
members = APIRouter(dependencies=[Depends(auth.require_member)])


@members.get("/session", status_code=204)
def session_status():
    return Response(status_code=204)


members.include_router(profiles.router)
members.include_router(network.router)
members.include_router(academic.router)
members.include_router(commerce.members)
members.include_router(messages.router)
members.include_router(admin.router)
members.include_router(blog.members)
members.include_router(blog.editorial)
members.include_router(admin.report_router)
members.include_router(analytics.events)
members.include_router(analytics.router)
v1.include_router(members)
app.include_router(v1)
