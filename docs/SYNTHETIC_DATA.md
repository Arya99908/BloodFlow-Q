# Synthetic data and loader guide

## What is included

The first dataset is intentionally small so it is easier to read and test:

- 3 fictional blood banks (`Bank A`, `Bank B`, `Bank C`)
- 3 fictional hospitals (`Hospital 1`, `Hospital 2`, `Hospital 3`)
- 4 group labels (`O`, `A`, `B`, `AB`)
- 9 route rows: one for every bank/hospital pair, including one blocked route
- 16 compatibility rows: one for every donor/recipient group pair

Every file is marked `"synthetic": true`. Names, identifiers, inventory,
demand, urgency weights, travel time, distance, and transport-cost points are
fictional examples. They are not observations about a real blood bank, hospital,
route, patient, or delivery.

## File formats

### `data/blood_banks.json`

The top-level `blood_groups` list declares the supported labels. Each bank has
a unique machine id, a display name, a location id, and an `inventory` object.
Every bank must include one non-negative whole-number inventory count for each
declared group. Whole-number counts model indivisible units in this initial
example.

### `data/hospitals.json`

Each hospital has a unique id, display name, and location id. Its `demand` is a
list with one row per supported group. A demand row has a non-negative whole
number of units, an urgency category (`low`, `medium`, `high`, or `critical`), and a
positive `priority_weight`.

Urgency labels and weights are synthetic optimizer inputs only. The current
objective treats `high` and `critical` as critical operational categories and uses that row's priority
weight in the critical-shortage term; all categories also count in total unmet
demand. The weights are not clinical triage values or medical recommendations.
The loader checks that each value has the right type and range; it does not
claim that the example weights are meaningful.

### `data/routes.json`

Each row connects one bank id (`source`) to one hospital id (`destination`) and
provides non-negative `travel_time_minutes`, non-negative `distance_km`,
non-negative `transport_cost`, and a `status` of `available` or `blocked`.
Transport cost uses the explicitly synthetic unit `synthetic_cost_points`.
There must be exactly one row for each bank/hospital pair. A blocked route is
kept in the data so a future model can explain why it is excluded; it is not
silently dropped by the loader.

### `data/compatibility.json`

`rules` is a complete machine-readable table. Each row names a
`donor_group`, `recipient_group`, and boolean `allowed`. The `component_model`
and `compatibility_scope` fields make clear that the example is an
ABO-only red-cell modeling assumption. Every pair appears exactly once.

## Compatibility safety note

The table is deliberately simplified and is included only to exercise an
operational optimization data format. It covers ABO labels alone; it omits RhD,
other blood-group antigens and antibodies, product-specific details, patient
testing, crossmatching, and other transfusion-service requirements. It is not
a complete clinical transfusion compatibility system and must not be used to
select or issue a product for a person.

Before any real-world use, compatibility rules would have to be reviewed and
approved against authoritative transfusion guidance and the requirements of
qualified transfusion professionals. The [Australian Red Cross Lifeblood
matching blood groups reference](https://www.lifeblood.com.au/patients-recipients/blood-plasma-platelets/blood-for-transfusion/matching-blood-groups)
shows that product type and RhD matter, and its red-cell section says
pre-transfusion testing is required. This project does not implement that full
guidance; the reference is provided to underline the limits of an ABO-only
prototype table, not to endorse this dataset for care.

## Loading and validation

Run this command from the repository root:

```text
python -m backend.data_loader
```

The loader uses only Python's standard library. Its default path points to this
project's `data/` folder, so it works even if Python is launched from another
current directory. Code can also call `load_data(path_to_folder)` to load a
temporary or alternate dataset.

Validation is intentionally strict. `backend/data_loader.py` checks each JSON
file's shape, and `backend/data_validation.py` checks relationships between
records. The loader runs both layers before returning data; callers can also
use `validate_data(data)` to recheck a modified in-memory dataset.

The validator rejects malformed JSON, missing files,
missing or unexpected fields, duplicate ids or pairs, invalid numeric values,
unknown references, inconsistent group lists, missing routes, incomplete
compatibility tables, and data not explicitly marked synthetic. Errors identify
the file and record/field. The loader never guesses a missing value, ignores a
bad row, or silently repairs input. It returns ordinary dictionaries in the
same shape as the JSON files, so the data stays inspectable for a beginner.

Inventory and demand must be non-negative whole numbers. Route time, distance,
and cost must be finite, non-negative numbers. Urgency must be `low`, `medium`,
or `high`. Invalid references use field paths in error messages, for example
`routes.routes[0].destination: unknown hospital id 'hospital_missing'`.

## Important design choices

- **Stable ids differ from display names:** `bank_a` is used in route references
  while `Bank A` is for people reading the file. This avoids using display text
  as a join key.
- **Location ids are labels only:** no real coordinates or addresses are
  included. Route estimates are supplied directly as fictional values.
- **Units must be whole numbers:** Python booleans are specifically rejected as
  inventory/demand counts even though Python treats `True` as the number `1`.
- **Strict keys catch typos:** an unexpected field such as `travle_time` causes
  a clear validation error instead of being ignored.
- **Complete route and compatibility tables remove ambiguity:** a missing
  route is an error rather than an assumed blocked or available connection;
  every group pair has an explicit `true` or `false` rule.
- **No optimization is performed:** this loader checks and returns input data;
  it does not allocate units or implement QUBO/QAOA.
