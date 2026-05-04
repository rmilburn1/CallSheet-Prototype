import os
from dotenv import load_dotenv


basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))


def get_database_url():
    raw_database_url = os.environ.get('SQLALCHEMY_DATABASE_URL') or os.environ.get('DATABASE_URL')
    if not raw_database_url:
        raise RuntimeError('SQLALCHEMY_DATABASE_URL must be set in backend/.env')

    raw_database_url = raw_database_url.strip()
    if raw_database_url.startswith('postgres://'):
        raw_database_url = raw_database_url.replace('postgres://', 'postgresql://', 1)

    return raw_database_url


class Config(object):
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'you-will-never-guess'
    SQLALCHEMY_DATABASE_URI = get_database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False

