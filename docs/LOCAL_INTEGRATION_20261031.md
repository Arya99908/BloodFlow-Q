# Local unified integration — 2026-10-31

Working checkout: `/Users/shreeshaks/Documents/BloodFlow-Q-main 3`.
Working branch: `integration/main3-unified-cleanup-2026`.

## Preservation and merge

- Original branch: `feat/visual-intelligence-observatory`, commit `6e06f50`.
- Tracked and untracked local work preserved in checkpoint `dec3c4b`.
- Fetched the requested syedafnan7-lab/BloodFlow-Q1 integration branch at `c11b97d`.
- Real two-parent merge: `7f31b94`; the upstream integration commit is an ancestor.
- Resolved reports routing in favor of the incoming research tabs, retaining the local Comparative Evidence Explorer. Preserved Quantum Execution Inspector and both sets of CSS improvements. Removed a hidden duplicate comparison component.
- Main remains untouched. No remote push or public deployment performed.

## Requested scope cleanup

- Donor profile and emergency request options now share A+, B+, AB+, O+.
- Service validation rejects unsupported labels before writes. Request lists and donor notifications filter unsupported labels; matching only accepts supported groups.
- Synthetic coordination and chatbot fixtures now use supported positive labels. Existing stored private records are never relabeled.
- Removed inferred Rh inventory/demand subdivisions from telemetry. The optimizer and reports retain their original ABO source labels and conserved totals.
- Removed the historical evaluation archive and its documentation references. Preserved request/circuit regression coverage under a neutral filename.
- Removed two obsolete captured HTTP-response archives containing superseded coordination fixtures; did not rewrite their recorded results. Git history retains the originals.
- Added a forward database migration that enforces positive-only groups for new writes without deleting historical private records. It has NOT been applied to a live Supabase database.

## Verification

- Backend: 241 tests and 21 subtests pass. Two existing SciPy COBYLA configuration warnings.
- Frontend: 83 tests pass, including positive-group write validation.
- Production build passes with the existing large-chart-chunk warning. Build URL uses a placeholder HTTPS origin for validation only; local dev uses port 8014.
- Playwright: all four new/current research tabs switch successfully; donor, emergency request, blood bank and quantum lab routes load. No page exceptions or failed local responses during the checks.
- Synthetic donor form exposes exactly four positive groups and the deterministic inbox opens successfully.
- Mobile reports viewport: 390 px, document width 390 px; screenshot retained in output/playwright.
- Scope: this verifies the merge and requested removals. It does not constitute a new scientific audit of every inherited chart or benchmark claim, or live database/RLS execution.

## Local preview

Frontend: http://127.0.0.1:5183
Backend: http://127.0.0.1:8014

Start the API with `BLOODFLOW_CORS_ORIGINS=http://127.0.0.1:5183 .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8014`.
Start the UI with `VITE_API_BASE_URL=http://127.0.0.1:8014 npm run dev --prefix frontend -- --host 127.0.0.1 --port 5183 --strictPort`.
