import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

from app import app
from app.dependencies import get_db, get_current_user

@pytest.fixture
def mock_db():
    db = MagicMock()
    return db

@pytest.fixture
def mock_user():
    user = MagicMock()
    user.id = 1
    user.email = "TEST@EMAIL.COM"
    user.username = "TEST@EMAIL.COM"
    user.first_name = "TEST"
    user.last_name = "USER"
    return user

@pytest.fixture
def client(mock_db, mock_user):
    def override_get_db():
        return mock_db
    
    def override_get_current_user():
        return mock_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    client = TestClient(app)
    yield client

    app.dependency_overrides.clear()

def test_base(client, mock_user,mock_db):
    mock_db.query().all.return_value = []
    mock_db.query().filter().all.return_value = []

    response = client.get("/")

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Home"
    assert "projects" in data
    assert "your_projects" in data

def test_register_get(client, mock_db):
    mock_db.query().all.return_value = []

    response = client.get("/register")

    assert response.status_code == 200
    assert response.json()["title"] == "Register"

def test_register_post_success(client, mock_db):
    mock_db.query().filter().first.return_value = None

    response = client.post("/register", data={
        "first_name": "John",
        "last_name": "Doe",
        "pronouns": "he/him",
        "email": "john@example.com",
        "phone": 1234567890,
        "major": "CS",
        "grad_year": 2025,
        "password": "password"
    })

    assert response.status_code == 200

def test_login_post(client, mock_db):
    user = MagicMock()
    user.id = 1
    user.check_password.return_value = True

    mock_db.query().filter().first.return_value = user

    response = client.post("/login", data={
        "email": "test@email.com",
        "password": "password"
    })

    assert response.status_code == 200

def test_create_project(client, mock_db):
    mock_db.add.return_value = None

    response = client.post("/new_project", data={
        "name": "Test Project",
        "filming_dates": "2025",
        "description": "Test desc"
    })

    assert response.status_code == 200

def test_user_profile_found(client, mock_db):
    user = MagicMock()
    user.id = 1
    user.first_name = "Test"
    user.last_name = "User"

    mock_db.query().filter().first.return_value = user
    mock_db.query().filter().all.return_value = []

    response = client.get("/user/TEST")

    assert response.status_code == 200
    assert response.json()["user_name"] == "Test User"

def test_project_display(client, mock_db):
    project = MagicMock()
    project.id = 1
    project.user_id = 1
    project.name = "Test"

    mock_db.query().filter().first.side_effect = [
        project,  # project
        MagicMock()  # creator
    ]
    mock_db.query().filter().all.return_value = []

    response = client.get("/project/1")

    assert response.status_code == 200
    assert response.json()["title"] == "Test"

def test_project_search_by_name(client):
    response = client.post("/project_search", data={
        "search_by": "name",
        "project_name": "Test"
    })

    assert response.status_code == 200

def test_logout(client):
    response = client.get("/logout")
    assert response.status_code == 200

