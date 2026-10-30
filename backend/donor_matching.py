"""Privacy-minimizing donor suggestion rules.

This module only ranks volunteer records for a coordination request. It does
not decide medical eligibility, confirm compatibility, or create a blood unit.
The deliberately conservative group filter is exact label equality; an
authorized blood service must make all clinical compatibility decisions.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal


@dataclass(frozen=True)
class DonorCandidate:
    """Minimum fields needed for a private, approximate donor suggestion."""

    donor_id: str
    blood_group: str
    city: str
    approximate_location: str
    availability: Literal["available", "temporarily_unavailable", "do_not_contact"]
    request_consent: bool
    share_contact_consent: bool
    approximate_distance_km: float | None = None
    declined_request_ids: frozenset[str] = frozenset()
    contacted_request_ids: frozenset[str] = frozenset()


@dataclass(frozen=True)
class EmergencyNeed:
    """A hospital's aggregate logistics request; contains no patient data."""

    request_id: str
    blood_group: str
    component: str
    units: int
    urgency: Literal["routine", "urgent", "critical"]
    required_by: datetime
    city: str
    approximate_location: str


@dataclass(frozen=True)
class DonorSuggestion:
    """A limited suggestion record; it never includes donor contact details."""

    donor_id: str
    approximate_location: str
    approximate_distance_km: float | None
    reason: str
    medical_eligibility_confirmed: Literal[False] = False


SUPPORTED_BLOOD_GROUPS = frozenset({"A+", "B+", "AB+", "O+"})


_URGENCY_ORDER = {"critical": 0, "urgent": 1, "routine": 2}


def request_priority_key(need: EmergencyNeed) -> tuple[int, datetime]:
    """Sort requests by urgency first, then by their required-by time."""

    return (_URGENCY_ORDER[need.urgency], need.required_by)


def match_donors(
    need: EmergencyNeed,
    donors: list[DonorCandidate],
    *,
    maximum_suggestions: int = 10,
    maximum_distance_km: float | None = None,
) -> list[DonorSuggestion]:
    """Return consented, self-reported candidates without exposing PII.

    Exact configured blood-group equality is intentionally used as a screening
    label, not as a clinical compatibility rule. Approximate area and distance
    are used only to order coordination suggestions. A donor is not counted as
    inventory, and a match does not mean the donor can safely donate.
    """

    if maximum_suggestions < 1:
        raise ValueError("maximum_suggestions must be at least 1")
    if maximum_distance_km is not None and maximum_distance_km < 0:
        raise ValueError("maximum_distance_km must be non-negative")

    if need.blood_group not in SUPPORTED_BLOOD_GROUPS:
        return []

    candidates: list[DonorCandidate] = []
    seen: set[str] = set()
    for donor in donors:
        if donor.donor_id in seen:
            continue
        seen.add(donor.donor_id)
        if donor.blood_group != need.blood_group:
            continue
        if donor.availability != "available" or not donor.request_consent:
            continue
        if need.request_id in donor.declined_request_ids:
            continue
        if need.request_id in donor.contacted_request_ids:
            continue
        if maximum_distance_km is not None and (
            donor.approximate_distance_km is None
            or donor.approximate_distance_km > maximum_distance_km
        ):
            continue
        candidates.append(donor)

    # Same city and approximate area are simple, explainable ordering hints.
    # They do not create or imply a live route or travel-time estimate.
    candidates.sort(
        key=lambda donor: (
            donor.city.casefold() != need.city.casefold(),
            donor.approximate_location.casefold() != need.approximate_location.casefold(),
            donor.approximate_distance_km is None,
            donor.approximate_distance_km if donor.approximate_distance_km is not None else float("inf"),
            donor.donor_id,
        )
    )
    output = []
    for donor in candidates[:maximum_suggestions]:
        area_note = (
            "same approximate area"
            if donor.approximate_location.casefold() == need.approximate_location.casefold()
            else "city-level location only"
        )
        output.append(
            DonorSuggestion(
                donor_id=donor.donor_id,
                approximate_location=donor.approximate_location,
                approximate_distance_km=donor.approximate_distance_km,
                reason=(
                    f"Declared group label matches the request; {area_note}; "
                    "self-reported available; request consent is recorded. "
                    "Authorized personnel must confirm all requirements."
                ),
            )
        )
    return output
