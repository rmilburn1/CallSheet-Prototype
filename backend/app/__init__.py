import logging
import os
from logging.handlers import RotatingFileHandler
from fastapi import FastAPI
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from config import Config
from flask_mail import Mail
from fastapi.middleware.cors import CORSMiddleware

# Initialize FastAPI app
app = FastAPI(title="Cast and Crew Search")

origins = [
    "http://localhost:5173",
    "localhost:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Configure logging
if not os.path.exists('logs'):
    os.mkdir('logs')
file_handler = RotatingFileHandler('logs/main.log', maxBytes=10240, backupCount=10)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'))
file_handler.setLevel(logging.INFO)

logger = logging.getLogger("cast_crew")
logger.setLevel(logging.INFO)
logger.addHandler(file_handler)
logger.info('Cast and Crew Search startup')

# Database setup
DATABASE_URL = Config.SQLALCHEMY_DATABASE_URI
if DATABASE_URL.startswith('sqlite'):
    # For sqlite, use check_same_thread=False
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=1800,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Import models to create tables
from app.models import Base
Base.metadata.create_all(bind=engine)

# Setup templates
templates = Jinja2Templates(directory="app/templates")

# Email configuration (using Flask-Mail for compatibility)
from flask import Flask as FlaskApp
flask_app = FlaskApp(__name__)
flask_app.config['MAIL_SERVER'] = 'smtp.gmail.com'
flask_app.config['MAIL_PORT'] = 465
flask_app.config['MAIL_USERNAME'] = 'cs205testingfall23@gmail.com'
flask_app.config['MAIL_PASSWORD'] = 'rdts ytre umge ayks'
flask_app.config['MAIL_USE_TLS'] = False
flask_app.config['MAIL_USE_SSL'] = True
mail = Mail(flask_app)

# Mount static files if they exist
import os.path
if os.path.exists("app/static"):
    app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from app import routes, models
