# Third-party materials and attribution inventory

Review date: 2026-10-31. This inventory discloses detected materials; it is not proof that every copied asset has been identified or that every distribution obligation is satisfied. Do not remove upstream copyright, license or NOTICE files. This document does not relicense third-party work or assign ownership of the team’s code.

## JavaScript direct dependencies

Versions and license labels below are taken from the checked-in npm lockfile. Complete lockfile package inventory: [audit JSON](../audit/code_of_conduct_20261031/javascript_dependencies.json). Installations retain their own upstream license texts.

| Package | Locked version | Declared license |
|---|---|---|
| `@hugeicons/core-free-icons` | 4.3.5 | MIT |
| `@hugeicons/react` | 1.1.10 | MIT |
| `@radix-ui/react-tooltip` | 1.4.1 | MIT |
| `@supabase/supabase-js` | 2.117.3 | MIT |
| `@vercel/speed-insights` | 2.0.0 | Apache-2.0 |
| `echarts` | 6.1.0 | Apache-2.0 |
| `gsap` | 3.15.0 | Standard 'no charge' license: https://gsap.com/standard-license. |
| `lucide-react` | 0.468.0 | ISC |
| `motion` | 12.43.0 | MIT |
| `react` | 19.3.1 | MIT |
| `react-dom` | 19.3.1 | MIT |
| `@vitejs/plugin-react` | 4.7.0 | MIT |
| `vite` | 6.4.5 | MIT |

## Python and numerical/quantum software

The declared requirements include FastAPI, Uvicorn, Pydantic, Qiskit, Qiskit Aer, SciPy and httpx2. NumPy and other transitive packages are also used. Full installed distribution names, versions and license metadata are recorded in [the environment inventory](../audit/code_of_conduct_20261031/python_environment_licenses.json). Installed versions are not a deployment lock; retain notices for the exact distributions shipped. SciPy/NumPy distributions can include bundled components with additional notices.

## Adapted component and custom terms

- `frontend/src/components/Tooltip.jsx` explicitly adapts Skiper UI’s [Custom Tooltip (skiper101)](https://skiper-ui.com/v1/skiper101), implemented with React and Radix Tooltip and project CSS. The Reports page already includes visible attribution. The [official quick-start terms](https://skiper-ui.com/docs/quick-start) require attribution for free components; retain it.
- GSAP uses its [Standard No Charge License](https://gsap.com/community/standard-license/), not MIT. Its terms distinguish ordinary website use from prohibited competing visual-animation-builder use. BloodFlow-Q is a logistics research dashboard; preserve upstream notices and review the exact shipped license.
- Team confirmation is still required for the origin and license of any copied/adapted animation components beyond the explicitly documented Tooltip, logos, fonts, photographs and other visual assets. A familiar component name is not evidence of copying. Record actual upstream URLs and modifications where applicable; do not invent credits.

## Research and data

Research references are in [README §18](../README.md#18-references) and the repository’s literature review. Scenario JSON and documented experiments are labeled synthetic. Imported results from team repositories must remain attributed to their original contributors and tied to their raw artifacts; they are not independent third-party performance endorsements.

The repository contains cached literature under `research/quantum_experiments/literature/sources/`. Citation alone does not establish permission to redistribute full text, figures or PDFs. Check each item’s actual license or distribute a citation/link instead of that item. No bulk deletion or history rewrite was performed in this review.

## Presentation and production tools

The premium film was produced with significant OpenAI Codex/ChatGPT agent assistance using FilmCraft 0.14.0; native macOS screen capture and FFmpeg were used for source preparation and verification. Python/NumPy generated original synthetic music and sound effects. The footage shows the real synthetic application; no Google/Apple video, logo, music, voice or avatar was used. Team ownership/provenance of the BloodFlow-Q logo and permission for fonts still need confirmation. This audit does not grant rights to any asset.

See [submission disclosure](QHACK_SUBMISSION_DISCLOSURE.md) for AI assistance and the separate human-recorded-demo requirement.
