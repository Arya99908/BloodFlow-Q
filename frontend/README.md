# BloodFlow-Q frontend

React and Vite dashboard for the synthetic BloodFlow-Q logistics prototype.
All backend requests live in `src/services/api.js`; page components use that
service instead of making network requests directly.

## Run locally

1. Start the FastAPI backend from the project root:

   ```sh
   .venv/bin/uvicorn backend.main:app --reload
   ```

2. In `frontend/`, install dependencies and start Vite:

   ```sh
   npm install
   npm run dev
   ```

3. Open `http://localhost:5173`. The default API URL is
   `http://127.0.0.1:8000`. To change it, copy `.env.example` to `.env.local`,
   edit `VITE_API_BASE_URL`, and restart Vite.

## Data display notes

The backend is the source of truth. Pages show an API loading state, API error,
empty state, or returned data. Dashboard totals are direct sums of scenario
fields. Current unmet demand stays unavailable until an optimization result
has been recorded by the running backend process.

The bundled scenario uses generic ABO labels (`O`, `A`, `B`, `AB`). The Blood
Banks page displays those labels as returned and does not present them as
Rh-specific groups such as `O-` or `O+`.

This interface is for synthetic aggregate logistics experiments only. It is
not a clinical decision tool, and its simplified compatibility labels are not
transfusion guidance.
