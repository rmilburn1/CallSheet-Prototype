# Frontend Docker

## Build

```bash
docker build -f frontend/Dockerfile -t callsheet-frontend .
```

## Run

```bash
docker run --rm -p 5173:5173 \
  --env-file ./frontend/.env \
  -e VITE_API_BASE_URL=http://localhost:8000 \
  callsheet-frontend
```

## Notes

- The frontend requires `VITE_CLERK_PUBLISHABLE_KEY`.
- `VITE_API_BASE_URL` should point to the backend from the browser's perspective.
- The included compose file sets `VITE_API_BASE_URL` automatically.