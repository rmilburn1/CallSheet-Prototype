# CallSheet
## By Baneet Pukhrambam & Ray Milburn

# What is CallSheet?
CallSheet was designed to assist students at Ithaca College's Roy H. Park School of Communications in the production of their student films. Many students in the film program expressed frustration in putting together a crew for their short films and TV projects. CallSheet is our solution. CallSheet is an online database where Ithaca College students can find open roles on film sets or find students to fill roles on their own sets.

# Architecture
Our back-end was built using FastAPI with a SQLAlchemy database. Our front-end is a React web app compiled with Vite.

# Instructions
## To launch from terminal
1. Open two terminals: one for the front-end and one for the back-end
2. CD into frontend and backend in the respective terminals
3. **To launch front-end:**
    1. `npm install`
    2. `npm run dev`
5. **To launch back-end:**
    1. `source "{path for /.venv/bin/activate}"`
    2. `uvicorn main:app`
