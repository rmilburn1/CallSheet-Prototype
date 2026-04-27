from fastapi import Depends, Form, Request, status, HTTPException, Header, Query
from fastapi.responses import JSONResponse, RedirectResponse
from flask import jsonify
from sqlalchemy.orm import Session
from sqlalchemy import String, cast, func, or_
from pydantic import BaseModel, Field

from app import app, mail
from app.models import User, Project, Role, Skill, UserToSkill, UserToProjectToRole
from app.dependencies import get_current_user, get_db, get_optional_user
from flask_mail import Message


def normalize_identifier(value: str | int | None) -> str:
    return str(value).strip().lower() if value is not None else ""


def owner_lookup_keys(*values: str | int | None) -> list[str]:
    keys: list[str] = []
    for value in values:
        if value is None:
            continue
        key = str(value).strip().lower()
        if key and key not in keys:
            keys.append(key)
    return keys


def serialize_user(user: User | None) -> dict[str, str]:
    if user is None:
        return {
            "USERNAME": "",
            "FIRST_NAME": "",
            "LAST_NAME": "",
            "FULL_NAME": "",
            "EMAIL": "",
        }

    full_name = " ".join(part for part in [user.first_name, user.last_name] if part).strip()
    return {
        "USERNAME": user.username or "",
        "FIRST_NAME": user.first_name or "",
        "LAST_NAME": user.last_name or "",
        "FULL_NAME": full_name,
        "EMAIL": user.email or "",
    }


def find_user_by_identifier(db: Session, identifier: str | None) -> User | None:
    normalized = normalize_identifier(identifier)
    if not normalized:
        return None

    return db.query(User).filter(
        or_(
            func.lower(User.username) == normalized,
            func.lower(User.email) == normalized,
            func.lower(cast(User.id, String)) == normalized,
        )
    ).first()


def ensure_clerk_user(
    db: Session,
    *,
    username: str | None,
    email: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
) -> User:
    normalized_username = normalize_identifier(username)
    normalized_email = normalize_identifier(email)
    user = find_user_by_identifier(db, normalized_username) or find_user_by_identifier(db, normalized_email)

    if user is None:
        user = User()
        db.add(user)

    if normalized_username:
        user.username = normalized_username
    elif not user.username:
        user.username = normalized_email or "unknown"

    if normalized_email:
        user.email = normalized_email
    elif not user.email:
        user.email = normalized_username or ""

    if first_name is not None:
        user.first_name = first_name.strip().upper() or None
    if last_name is not None:
        user.last_name = last_name.strip().upper() or None

    db.commit()
    db.refresh(user)
    return user


def find_project_creator(db: Session, project: Project) -> User | None:
    return find_user_by_identifier(db, project.user_id)


def serialize_project(project: Project, db: Session) -> dict[str, str | list[str]]:
    creator = find_project_creator(db, project)
    roles_needed = db.query(Role.title).join(
        UserToProjectToRole, Role.id == UserToProjectToRole.role_id
    ).filter(
        UserToProjectToRole.project_id == project.id
    ).order_by(Role.title.asc()).all()

    creator_data = serialize_user(creator)
    owner_label = creator_data["USERNAME"] or normalize_identifier(project.user_id)

    return {
        "ID": str(project.id),
        "NAME": project.name,
        "DATES": project.filming_dates,
        "DESCRIPTION": project.description,
        "USER_ID": owner_label,
        "CREATOR_USERNAME": creator_data["USERNAME"],
        "CREATOR_FULL_NAME": creator_data["FULL_NAME"],
        "CREATOR_EMAIL": creator_data["EMAIL"],
        "ROLES": [title for (title,) in roles_needed],
    }


class CreateProjectRequest(BaseModel):
    NAME: str
    DATES: str
    DESCRIPTION: str
    USER_ID: str | None = None
    OWNER_USERNAME: str | None = None
    OWNER_EMAIL: str | None = None
    OWNER_FIRST_NAME: str | None = None
    OWNER_LAST_NAME: str | None = None
    ROLE_IDS: list[int] = Field(default_factory=list)


class SyncClerkUserRequest(BaseModel):
    USERNAME: str | None = None
    EMAIL: str | None = None
    FIRST_NAME: str | None = None
    LAST_NAME: str | None = None
    FULL_NAME: str | None = None


class ProfileResponse(BaseModel):
    USERNAME: str
    FIRST_NAME: str
    LAST_NAME: str
    FULL_NAME: str
    EMAIL: str
    PROJECTS: list[dict[str, str | list[str]]]


def split_full_name(full_name: str | None) -> tuple[str | None, str | None]:
    cleaned = (full_name or "").strip()
    if not cleaned:
        return None, None

    parts = cleaned.split()
    if len(parts) == 1:
        return parts[0], None
    return parts[0], " ".join(parts[1:])


def can_manage_project(project: Project, current_user: User) -> bool:
    return normalize_identifier(project.user_id) in owner_lookup_keys(
        current_user.username,
        current_user.email,
        current_user.id,
    )


@app.post("/api/clerk/sync-user", response_class=JSONResponse)
async def api_sync_clerk_user(
    payload: SyncClerkUserRequest,
    db: Session = Depends(get_db)
):
    normalized_username = normalize_identifier(payload.USERNAME)
    normalized_email = normalize_identifier(payload.EMAIL)

    if not normalized_username and normalized_email:
        normalized_username = normalized_email.split("@")[0]

    first_name = (payload.FIRST_NAME or "").strip() or None
    last_name = (payload.LAST_NAME or "").strip() or None
    if not first_name and not last_name:
        split_first, split_last = split_full_name(payload.FULL_NAME)
        first_name = split_first
        last_name = split_last

    if not normalized_username and not normalized_email:
        raise HTTPException(status_code=400, detail="USERNAME or EMAIL is required")

    user = ensure_clerk_user(
        db,
        username=normalized_username,
        email=normalized_email,
        first_name=first_name,
        last_name=last_name,
    )

    return JSONResponse({"user": serialize_user(user)})


@app.get("/api/roles", response_class=JSONResponse)
async def api_roles(db: Session = Depends(get_db)):
    roles = db.query(Role).order_by(Role.title.asc()).all()
    return JSONResponse({
        "roles": [
            {"ID": str(role.id), "TITLE": role.title}
            for role in roles
        ]
    })


@app.get("/api/projects", response_class=JSONResponse)
async def api_projects(
    search: str = "",
    search_type: str = "project",
    db: Session = Depends(get_db)
):
    projects_query = db.query(Project)
    search_term = search.strip()
    if search_term:
        wildcard = f"%{search_term}%"
        if search_type == "profile":
            matching_users = db.query(User).filter(
                or_(
                    User.username.ilike(wildcard),
                    User.first_name.ilike(wildcard),
                    User.last_name.ilike(wildcard),
                    User.email.ilike(wildcard),
                )
            ).all()
            owner_keys = owner_lookup_keys(*(user.username for user in matching_users), *(user.id for user in matching_users))
            owner_keys.extend(owner_lookup_keys(*(user.email for user in matching_users)))

            if owner_keys:
                projects_query = projects_query.filter(func.lower(cast(Project.user_id, String)).in_(owner_keys))
            else:
                projects_query = projects_query.filter(Project.id == -1)
        elif search_type == "roles":
            projects_query = db.query(Project).join(
                UserToProjectToRole, UserToProjectToRole.project_id == Project.id
            ).join(
                Role, Role.id == UserToProjectToRole.role_id
            ).filter(
                Role.title.ilike(wildcard)
            ).distinct()
        else:
            projects_query = projects_query.filter(
                Project.name.ilike(wildcard)
                | Project.description.ilike(wildcard)
                | Project.filming_dates.ilike(wildcard)
            )

    projects = projects_query.order_by(Project.id.asc()).all()
    return JSONResponse({"projects": [serialize_project(project, db) for project in projects]})


@app.post("/api/projects", response_class=JSONResponse, status_code=status.HTTP_201_CREATED)
async def api_create_project(
    project_data: CreateProjectRequest,
    db: Session = Depends(get_db)
):
    owner_username = normalize_identifier(project_data.OWNER_USERNAME or project_data.USER_ID)
    owner_email = normalize_identifier(project_data.OWNER_EMAIL)
    if not owner_username and owner_email:
        owner_username = owner_email.split("@")[0]

    owner_user = ensure_clerk_user(
        db,
        username=owner_username,
        email=owner_email,
        first_name=project_data.OWNER_FIRST_NAME,
        last_name=project_data.OWNER_LAST_NAME,
    )

    project = Project(
        name=project_data.NAME.strip().upper(),
        filming_dates=project_data.DATES.strip(),
        description=project_data.DESCRIPTION.strip().upper(),
        user_id=owner_user.username,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    for role_id in project_data.ROLE_IDS:
        db.add(UserToProjectToRole(
            user_id=owner_user.id,
            project_id=project.id,
            role_id=role_id,
        ))
    db.commit()

    return JSONResponse(serialize_project(project, db), status_code=status.HTTP_201_CREATED)


@app.delete("/api/projects/{project_id}", response_class=JSONResponse)
async def api_delete_project(
    project_id: int,
    owner_username_query: str | None = Query(None, alias="owner_username"),
    owner_email_query: str | None = Query(None, alias="owner_email"),
    owner_username: str | None = Header(None, alias="X-Owner-Username"),
    owner_email: str | None = Header(None, alias="X-Owner-Email"),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    owner_identifiers = owner_lookup_keys(
        owner_username,
        owner_email,
        owner_username_query,
        owner_email_query,
    )
    if current_user is not None:
        owner_identifiers.extend(owner_lookup_keys(
            current_user.username,
            current_user.email,
            current_user.id,
        ))

    if owner_identifiers and normalize_identifier(project.user_id) not in owner_identifiers:
        raise HTTPException(status_code=403, detail="You can only delete your own projects")

    db.query(UserToProjectToRole).filter(UserToProjectToRole.project_id == project.id).delete(synchronize_session=False)
    db.delete(project)
    db.commit()
    return JSONResponse({"message": "Project deleted"})


@app.get("/", response_class=JSONResponse)
async def base(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    projects = db.query(Project).all()
    your_projects = db.query(Project).filter(
        func.lower(cast(Project.user_id, String)).in_(owner_lookup_keys(
            current_user.username,
            current_user.email,
            current_user.id,
        ))
    ).all()
    return ({
        "title": "Home",
        "projects": projects,
        "user": current_user,
        "your_projects": your_projects
    })


@app.get("/register", response_class=JSONResponse)
async def register_get(request: Request, db: Session = Depends(get_db)):
    user_id = request.cookies.get("user_id")
    if user_id:
        return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)
    
    skills = db.query(Skill).all()
    return ({
        "title": "Register",
        "skills": skills
    })


@app.post("/register", response_class=JSONResponse)
async def register_post(
    request: Request,
    first_name: str = Form(...),
    last_name: str = Form(...),
    pronouns: str = Form(...),
    email: str = Form(...),
    phone: int = Form(...),
    major: str = Form(...),
    minor: str = Form(default=""),
    grad_year: int = Form(...),
    password: str = Form(...),
    skills: list[int] = Form(default=[]),
    db: Session = Depends(get_db)
):
    user_id = request.cookies.get("user_id")
    if user_id:
        return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)
    
    existing_user = db.query(User).filter(User.email == email.upper()).first()
    if existing_user:
        return ({
            "title": "Register",
            "error": "User already exists."
        })
    
    new_user = User(
        first_name=first_name.upper(),
        last_name=last_name.upper(),
        pronouns=pronouns.upper(),
        email=email.upper(),
        phone=phone,
        major=major.upper(),
        minor=minor.upper(),
        grad_year=grad_year
    )
    new_user.set_password(password)
    new_user.set_username(email.upper())
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    for skill_id in skills:
        new_u2s = UserToSkill(user_id=new_user.id, skill_id=skill_id)
        db.add(new_u2s)
    db.commit()
    
    return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)


@app.get("/login", response_class=JSONResponse)
async def login_get(request: Request):
    user_id = request.cookies.get("user_id")
    if user_id:
        return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)
    
    return ({
        "title": "Sign In"
    })


@app.post("/login", response_class=JSONResponse)
async def login_post(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    remember_me: bool = Form(default=False),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == email.upper()).first()
    if user is None or not user.check_password(password):
        return ({
            "title": "Sign In",
            "error": "Invalid email or password"
        })
    
    response = RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)
    response.set_cookie(key="user_id", value=str(user.id), max_age=2592000 if remember_me else None)
    return response


@app.get("/new_project", response_class=JSONResponse)
async def new_project_get(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    roles = db.query(Role).all()
    return ({
        "title": "Create New Project",
        "roles": roles
    })


@app.post("/new_project", response_class=JSONResponse)
async def new_project_post(
    request: Request,
    name: str = Form(...),
    filming_dates: str = Form(...),
    description: str = Form(...),
    roles_needed: list[int] = Form(default=[]),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = Project(
        name=name.upper(),
        filming_dates=filming_dates,
        description=description.upper(),
        user_id=normalize_identifier(current_user.username) or str(current_user.id)
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    
    for role_id in roles_needed:
        new_u2p2r = UserToProjectToRole(
            user_id=current_user.id,
            project_id=project.id,
            role_id=role_id
        )
        db.add(new_u2p2r)
    db.commit()
    
    return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)


@app.get("/user/{username}", response_class=JSONResponse)
async def user_profile(
    username: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(func.lower(User.username) == normalize_identifier(username)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_name = f"{user.first_name} {user.last_name}"
    projects = db.query(Project).filter(func.lower(cast(Project.user_id, String)) == normalize_identifier(user.username)).all()
    
    return ({
        "title": user_name,
        "user": user,
        "user_name": user_name,
        "project_list": projects
    })


@app.post("/user/{username}/contact", response_class=JSONResponse)
async def send_contact_message(
    username: str,
    request: Request,
    name: str = Form(...),
    email: str = Form(...),
    message: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(func.lower(User.username) == normalize_identifier(username)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    msg = Message(
        subject=f'You got a message from {email}',
        sender='cs205testingfall23@gmail.com',
        cc=[email],
        recipients=[user.email]
    )
    msg.body = message
    mail.send(msg)
    
    return ({
        "title": f"{user.first_name} {user.last_name}",
        "user": user,
        "user_name": f"{user.first_name} {user.last_name}",
        "project_list": db.query(Project).filter(Project.user_id == user.id).all(),
        "success": "Message was sent!"
    })


@app.get("/project/{project_id}", response_class=JSONResponse)
async def project_display(
    project_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    creator = find_project_creator(db, project)
    roles_needed_list = [
        title for (title,) in db.query(Role.title).join(
            UserToProjectToRole, Role.id == UserToProjectToRole.role_id
        ).filter(
            UserToProjectToRole.project_id == project.id
        ).order_by(Role.title.asc()).all()
    ]
    
    return ({
        "title": project.name,
        "creator": creator,
        "roles_needed_list": roles_needed_list,
        "project": project
    })


@app.get("/api/profile/{username}", response_class=JSONResponse)
async def api_profile(
    username: str,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(func.lower(User.username) == normalize_identifier(username)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    projects = db.query(Project).filter(
        func.lower(cast(Project.user_id, String)) == normalize_identifier(user.username)
    ).order_by(Project.id.asc()).all()

    return JSONResponse({
        "profile": serialize_user(user),
        "projects": [serialize_project(project, db) for project in projects],
    })


@app.get("/project_search", response_class=JSONResponse)
async def project_search(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    projects = db.query(Project).all()
    roles = db.query(Role).all()
    
    return ({
        "projects": projects,
        "roles": roles
    })


@app.post("/project_search", response_class=JSONResponse)
async def project_search_post(
    request: Request,
    search_by: str = Form(...),
    project_name: str = Form(default=""),
    project_role: int = Form(default=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if search_by == "name" and project_name:
        return RedirectResponse(
            url=f"/project_search_result_name/{project_name.upper()}",
            status_code=status.HTTP_302_FOUND
        )
    elif search_by == "role" and project_role:
        return RedirectResponse(
            url=f"/project_search_result_role/{project_role}",
            status_code=status.HTTP_302_FOUND
        )
    
    return RedirectResponse(url="/project_search", status_code=status.HTTP_302_FOUND)


@app.get("/project_search_result_name/{name}", response_class=JSONResponse)
async def project_search_result_name(
    name: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    projects = db.query(Project).filter(Project.name == name).all()
    
    results = []
    for project in projects:
        creator = find_project_creator(db, project)
        results.append({"project": project, "creator": creator})
    
    return ({
        "query": name,
        "results": results
    })


@app.get("/project_search_result_role/{role}", response_class=JSONResponse)
async def project_search_result_role(
    role: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role_obj = db.query(Role).filter(Role.id == role).first()
    if not role_obj:
        raise HTTPException(status_code=404, detail="Role not found")
    
    result_ids = db.query(UserToProjectToRole).filter(
        UserToProjectToRole.role_id == role
    ).all()
    
    results = []
    for result_id in result_ids:
        project = db.query(Project).filter(Project.id == result_id.project_id).first()
        if project:
            creator = find_project_creator(db, project)
            results.append({"project": project, "creator": creator})
    
    return ({
        "query": role_obj.title,
        "results": results,
        "role_title": role_obj.title
    })


@app.get("/profile_search", response_class=JSONResponse)
async def profile_search(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    skills = db.query(Skill).all()
    return ({
        "skills": skills
    })


@app.post("/profile_search", response_class=JSONResponse)
async def profile_search_post(
    request: Request,
    search_by: str = Form(...),
    profile_name: str = Form(default=""),
    profile_skill: int = Form(default=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if search_by == "name" and profile_name:
        return RedirectResponse(
            url=f"/user/{profile_name.upper()}",
            status_code=status.HTTP_302_FOUND
        )
    elif search_by == "skill" and profile_skill:
        return RedirectResponse(
            url=f"/profile_search_result_skill/{profile_skill}",
            status_code=status.HTTP_302_FOUND
        )
    
    return RedirectResponse(url="/profile_search", status_code=status.HTTP_302_FOUND)


@app.get("/profile_search_result_skill/{query}", response_class=JSONResponse)
async def profile_search_result_skill(
    query: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    skill = db.query(Skill).filter(Skill.id == query).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    
    user_to_skills = db.query(UserToSkill).filter(UserToSkill.skill_id == skill.id).all()
    user_list = []
    for u2s in user_to_skills:
        user = db.query(User).filter(User.id == u2s.user_id).first()
        if user:
            user_list.append(user.username)
    
    return ({
        "title": "Profile Search by Skill",
        "skill_title": skill.title,
        "user_list": user_list
    })


@app.get("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    response = RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)
    response.delete_cookie("user_id")
    return response

"""
@app.get("/reset_db")
async def reset_db(db: Session = Depends(get_db)):
    # Delete all data
    db.query(UserToSkill).delete()
    db.query(UserToProjectToRole).delete()
    db.query(Project).delete()
    db.query(User).delete()
    db.query(Skill).delete()
    db.query(Role).delete()
    db.commit()
    
    # Repopulate with dummy data
    skills = [
        Skill(title="DIRECTING"), Skill(title="PRODUCING"), Skill(title="SOUND"),
        Skill(title="EDITING"), Skill(title="MUSIC"), Skill(title="WRITING"),
        Skill(title="ACTING"), Skill(title="SINGING"), Skill(title="LIGHTING")
    ]
    for skill in skills:
        db.add(skill)
    
    roles = [
        Role(title="DIRECTOR"), Role(title="PRODUCER"),
        Role(title="1ST ASSISTANT DIRECTOR"), Role(title="2ND ASSISTANT DIRECTOR"),
        Role(title="ASSISTANT PRODUCER"), Role(title="DIRECTOR OF PHOTOGRAPHY"),
        Role(title="1ST ASSISTANT CAMERA"), Role(title="2ND ASSISTANT CAMERA"),
        Role(title="CAMERA OPERATOR"), Role(title="SCRIPT SUPERVISOR"),
        Role(title="PRODUCTION ASSISTANT"), Role(title="EDITOR"),
        Role(title="ASSISTANT EDITOR"), Role(title="SOUND MIXER"),
        Role(title="BOOM OPERATOR"), Role(title="PRODUCTION DESIGNER"),
        Role(title="SET PHOTOGRAPHER"), Role(title="SOCIAL MEDIA MANAGER"),
        Role(title="GAFFER"), Role(title="KEY GRIP"), Role(title="GRIP"),
        Role(title="LIGHTING TECHNICIAN"), Role(title="HAIR & MAKEUP"),
        Role(title="CHOREOGRAPHER"), Role(title="WRITER"), Role(title="COLORIST"),
        Role(title="COMPOSER"), Role(title="DIGITAL IMAGING TECHNICIAN"),
        Role(title="PROPERTY MASTER"), Role(title="CASTING DIRECTOR"),
        Role(title="LOCATION MANAGER")
    ]
    for role in roles:
        db.add(role)
    
    db.commit()
    
    projects = [
        Project(name="MANEATER", filming_dates="11/10/23", description="SUCH A GOOD FILM", user_id=1),
        Project(name="HARMONY OF HEARTS", filming_dates="12/2/23", description="SUCH A GOOD FILM", user_id=1),
        Project(name="TRUTH SEEKER", filming_dates="8/10/23", description="SUCH A GOOD FILM", user_id=1),
        Project(name="STARLIGHT DREAMS", filming_dates="7/15/23", description="A CAPTIVATING ROMANCE", user_id=1),
        Project(name="MYSTERIOUS SHADOWS", filming_dates="6/5/23", description="A THRILLING MYSTERY", user_id=1),
        Project(name="SUNSET SERENADE", filming_dates="9/20/23", description="A HEARTWARMING MUSICAL", user_id=1),
        Project(name="ETERNAL ECLIPSE", filming_dates="4/1/23", description="A DARK FANTASY EPIC", user_id=1),
        Project(name="LOST IN TIME", filming_dates="2/12/23", description="A TIME-TRAVEL ADVENTURE", user_id=1),
        Project(name="ENCHANTED GARDEN", filming_dates="10/8/23", description="A MAGICAL FAMILY FILM", user_id=1),
        Project(name="UNCHARTED WATERS", filming_dates="3/25/23", description="A HIGH-SEAS ADVENTURE", user_id=1),
        Project(name="BEYOND THE STARS", filming_dates="5/30/23", description="AN INTERGALACTIC JOURNEY", user_id=1),
        Project(name="WHISPERS IN THE WOODS", filming_dates="11/18/23", description="A HAUNTING HORROR", user_id=1),
        Project(name="CELESTIAL HARMONY", filming_dates="7/5/23", description="A SCI-FI ODYSSEY", user_id=1),
        Project(name="SERENADE UNDER THE MOON", filming_dates="1/9/23", description="A ROMANTIC COMEDY", user_id=1),
        Project(name="THE LOST KINGDOM", filming_dates="8/27/23", description="AN EPIC FANTASY QUEST", user_id=1),
        Project(name="CITY OF ILLUSIONS", filming_dates="6/18/23", description="A PSYCHOLOGICAL THRILLER", user_id=1),
        Project(name="CHASING DREAMS", filming_dates="9/12/23", description="A DRAMA OF AMBITIONS", user_id=1),
        Project(name="SECRET OF THE ORACLE", filming_dates="4/28/23", description="A MYSTICAL ADVENTURE", user_id=1),
        Project(name="STARDUST MEMORIES", filming_dates="2/5/23", description="A NOSTALGIC JOURNEY", user_id=1),
        Project(name="UNDERGROUND REBELLION", filming_dates="10/15/23", description="A DYSTOPIAN ACTION", user_id=1),
        Project(name="WHEN SHADOWS FALL", filming_dates="5/8/23", description="A SUPERNATURAL MYSTERY", user_id=1),
        Project(name="LOVE IN BLOOM", filming_dates="12/7/23", description="A ROMANTIC DRAMA", user_id=1),
        Project(name="THE TIMELESS VOYAGE", filming_dates="8/3/23", description="A TIME-TRAVEL ROMANCE", user_id=1),
    ]
    for proj in projects:
        db.add(proj)
    
    db.commit()
    
    return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)"""
