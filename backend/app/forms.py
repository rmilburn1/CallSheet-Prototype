from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, BooleanField, SubmitField, IntegerField, TextAreaField, SelectMultipleField, SelectField
from wtforms.validators import ValidationError, DataRequired, Email, EqualTo
from app.models import User

"""
class RegistrationForm(FlaskForm):
    first_name = StringField('First Name', validators=[DataRequired()])
    last_name = StringField('Last Name', validators=[DataRequired()])
    pronouns = StringField('Pronouns', validators=[DataRequired()])
    email = StringField('Email', validators=[DataRequired(), Email()])
    phone = IntegerField('Phone Number', validators=[DataRequired()])
    major = StringField('Major', validators=[DataRequired()])
    minor = StringField('Minor')
    grad_year = IntegerField('Graduation Year', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    password2 = PasswordField(
        'Repeat Password', validators=[DataRequired(), EqualTo('password')])
    skills = SelectMultipleField('Skills', coerce=int, validators=[DataRequired()])
    submit = SubmitField('Register')

    def validate_email(self, email):
        user = User.query.filter_by(email=email.data).first()
        if user is not None:
            raise ValidationError('Please use a different email address.')


class LoginForm(FlaskForm):
    email = StringField('Email ID', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    remember_me = BooleanField('Remember Me')
    submit = SubmitField('Sign In')
"""

class NewProjectForm(FlaskForm):
    name = StringField('Project Name', validators=[DataRequired()])
    filming_dates = StringField('Filming Dates', validators=[DataRequired()])
    description = TextAreaField('Description', validators=[DataRequired()])
    roles_needed = SelectMultipleField('Roles Needed', coerce=int, validators=[DataRequired()])
    submit = SubmitField('Submit')


class ProjectSearchNameForm(FlaskForm):
    project_name = StringField('Project Name')
    submit1 = SubmitField('Submit')


class ProjectSearchRoleForm(FlaskForm):
    project_role = SelectField('Project Role')
    submit2 = SubmitField('Submit')


class ProfileSearchNameForm(FlaskForm):
    profile_name = StringField('Profile Name')
    submit1 = SubmitField('Submit')


class ProfileSearchSkillForm(FlaskForm):
    profile_skill = SelectField('Profile Skill')
    submit2 = SubmitField('Submit')

"""
class ContactForm(FlaskForm):
    name = StringField(label='Name', validators=[DataRequired()])
    email = StringField('Email', validators=[DataRequired(), Email()])
    message = TextAreaField(label='Message')
    submit = SubmitField(label="Submit")
"""