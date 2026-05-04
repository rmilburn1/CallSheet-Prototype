# Backend Docker

## Build

```bash
docker build -f backend/Dockerfile -t callsheet-backend .
```

## Run

```bash
docker run --rm -p 8000:8000 \
  -e DATABASE_URL=SQLALCHEMY_DATABASE_URL \
  -v callsheet_backend_db:/app/data \
  -v "$(pwd)/backend/logs:/app/logs" \
  callsheet-backend
```

## Notes

- The backend expects `DATABASE_URL` or `SQLALCHEMY_DATABASE_URL`.
- The included compose file uses SQLite by default for local development.
- If you want to point at Postgres, override `DATABASE_URL` at runtime.