from sqlalchemy import Column, Integer, String, ForeignKey, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from werkzeug.security import check_password_hash, generate_password_hash

Base = declarative_base()


class User(Base):
    __tablename__ = "user"
    
    id = Column(Integer, primary_key=True)
    first_name = Column(String(64), index=True)
    last_name = Column(String(64), index=True)
    username = Column(String(64), index=True)
    pronouns = Column(String(64), index=True)
    email = Column(String(64), index=True)
    phone = Column(Integer(), index=True)
    major = Column(String(64), index=True)
    minor = Column(String(64), index=True)
    grad_year = Column(Integer(), index=True)
    password_hash = Column(String(128))

    def __repr__(self):
        return f'<User {self.first_name}>'

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def set_username(self, email):
        self.username = email.split("@")[0]

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Project(Base):
    __tablename__ = "project"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(64), index=True)
    filming_dates = Column(String(120), index=True)
    description = Column(String())
    user_id = Column(String(128), index=True)
    # user_id = Column(Integer, ForeignKey('user.id))

    def __repr__(self):
        return f'<Project {self.name}>'


class Role(Base):
    __tablename__ = "role"
    
    id = Column(Integer, primary_key=True)
    title = Column(String(128), index=True)

    def __repr__(self):
        return f'<Role {self.title}>'


class Skill(Base):
    __tablename__ = "skill"
    
    id = Column(Integer, primary_key=True)
    title = Column(String(128), index=True)

    def __repr__(self):
        return f'<Skill {self.title}>'


class UserToSkill(Base):
    __tablename__ = "user_to_skill"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'))
    skill_id = Column(Integer, ForeignKey('skill.id'))

    def __repr__(self):
        return f'<User ID: {self.user_id} and Skill ID: {self.skill_id}>'


class UserToProjectToRole(Base):
    __tablename__ = "user_to_project_to_role"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'))
    project_id = Column(Integer, ForeignKey('project.id'))
    role_id = Column(Integer, ForeignKey('role.id'))

    def __repr__(self):
        return f'<User ID: {self.user_id}, Project ID: {self.project_id} and Role ID: {self.role_id}>'

