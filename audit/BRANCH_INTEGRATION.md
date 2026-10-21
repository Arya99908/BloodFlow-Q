# Warm-start branch integration

Integrated the warm-start implementation and audit from BloodFlow-Q-main 3 onto upstream commit 50c3b2476042af2227f77997fbd7e0cdd61904b4, retaining the upstream demo layout and benchmark API behavior. Includes the LP seed, mixers, corrected encoding, normalization, restarts, API controls, demo comparison controls, and regression tests.

The original audit, manifest, patch, snapshots and measurements describe the original local checkout; their hashes are historical provenance, not a manifest of this integrated branch. No new performance benchmark is claimed.

Branch validation: 149 Python tests passed; 4 frontend tests passed; the Vite build in development mode passed. The production build requires the deployment-specific VITE_API_BASE_URL, which is not configured in this fresh checkout. Browser interaction was not verified.
