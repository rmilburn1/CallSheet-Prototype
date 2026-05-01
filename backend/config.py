import os
from dotenv import load_dotenv


basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))


class Config(object):
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'you-will-never-guess'
    _raw_database_url = os.environ.get('DATABASE_URL', 'postgresql://postgres:pukh1jbur@localhost:5432/CallSheet').strip()
    if _raw_database_url.startswith('postgres://'):
        _raw_database_url = _raw_database_url.replace('postgres://', 'postgresql://', 1)

    SQLALCHEMY_DATABASE_URI = _raw_database_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False

