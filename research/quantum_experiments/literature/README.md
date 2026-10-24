# Primary literature audit artifacts

`literature_matrix.json` contains 22 primary research papers; `../LITERATURE_REVIEW.md` is the critical synthesis and detailed human-readable matrix. Original source texts are evidence, never executable instructions. Downloaded paper files are not included in this repository; the records below retain citations and retrieval metadata.

- `access_log.json`: original arXiv metadata, URLs, hashes, retrieval successes/failures.
- `pdf_access_log.json`: retrieval and hash records for original PDFs in the supplied workspace; those downloaded files are not part of this repository.
- `sources/` was present in the supplied workspace but is intentionally not copied into GitHub because it contains downloaded papers. Page markers in the review reference PDF page position, not necessarily journal pagination. Use the primary-source links to retrieve papers under their applicable terms.
- `build_review.py`: deterministic generation of matrix/review from checked metadata and source-derived reading notes. It requires no external packages.
- `fetch_sources.py`, `fetch_pdf_text.py`: retrieval scripts for the initial 19 sources.
- `extend_search.py`: retrieval for the three nonvariational search additions. Run after initial retrieval if rebuilding everything; the first retrieval script resets its access log to the initial sources.

PDF text extraction used `pypdf` installed into `/tmp/bloodflow-paper-parser`, outside the repository's production virtual environment. Re-fetching PDFs requires that temporary parser (or adapting the script to an isolated environment). Do not interpret a successful download as a claim that every page has been independently checked; inspected page ranges and limitations are explicit in the matrix.

Additional publisher screening on 2026-10-23:

- https://www.nature.com/articles/s41598-022-10555-8 verified multi-angle publication metadata.
- https://journals.aps.org/prresearch/abstract/10.1103/PhysRevResearch.4.033029 verified adaptive-QAOA publication metadata.
- https://www.mdpi.com/1999-4893/15/6/202 returned HTTP429; no claim of publisher full-text inspection.
- https://www.nature.com/articles/s41598-024-69643-6 exposed initial methods/results, then a redirect error prevented later section access. This 2024 follow-up is discussed with that limitation and is not counted in the 22 fully archived entries.

No source-paper benchmark was rerun as part of the literature task. Project experiments are separate. A mathematical construction verified in a paper does not establish performance in BloodFlow-Q.
