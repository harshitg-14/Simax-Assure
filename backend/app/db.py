import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SQLITE_DEFAULT = f"sqlite:///{os.path.join(BASE_DIR, 'simax_assure.db')}"

DATABASE_URL = os.getenv("DATABASE_URL", _SQLITE_DEFAULT)

# SQLite needs check_same_thread=False; PostgreSQL does not accept it
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
