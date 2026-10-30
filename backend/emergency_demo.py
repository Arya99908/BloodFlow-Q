"""Deterministic, stateless synthetic emergency coordination walkthrough.

The browser sends only allowed demo actions. The backend rebuilds state on
each call, so this works on serverless hosting without an in-memory session.
Never put donor contact details or live collection/transport events here.
"""

from __future__ import annotations

from datetime import datetime, timezone
from copy import deepcopy
from typing import Any

from backend.donor_matching import DonorCandidate, EmergencyNeed, match_donors


DEMO_REQUEST_ID = "DEMO-BFQ-4UNIT-001"
_DONORS = [
    DonorCandidate(
        donor_id="DEMO-DONOR-01", blood_group="O+", city="Demo City",
        approximate_location="North District", availability="available",
        request_consent=True, share_contact_consent=True,
        approximate_distance_km=2.4,
    ),
    DonorCandidate(
        donor_id="DEMO-DONOR-02", blood_group="O+", city="Demo City",
        approximate_location="North District", availability="available",
        request_consent=True, share_contact_consent=False,
        approximate_distance_km=4.1,
    ),
    DonorCandidate(
        donor_id="DEMO-DONOR-03", blood_group="O+", city="Demo City",
        approximate_location="West District", availability="available",
        request_consent=True, share_contact_consent=True,
        approximate_distance_km=7.8,
    ),
]


def start_demo() -> dict[str, Any]:
    """Create the fixed 4-unit / 1-stock / 3-shortfall demonstration."""

    need = EmergencyNeed(
        request_id=DEMO_REQUEST_ID, blood_group="O+", component="Red blood cells",
        units=4, urgency="critical", required_by=datetime(2030, 1, 1, tzinfo=timezone.utc),
        city="Demo City", approximate_location="North District",
    )
    suggestions = match_donors(need, _DONORS, maximum_suggestions=3)
    now = "SIMULATED · deterministic demo"
    potential_donors = [
        {
            "donor_id": item.donor_id,
            "area": item.approximate_location,
            "approximate_distance_km": item.approximate_distance_km,
            "reason": item.reason,
            "medical_eligibility_confirmed": False,
        }
        for item in suggestions
    ]
    # Contact one volunteer at a time in the synthetic example. Additional
    # suggestions enter the inbox only if the current candidate declines.
    notifications = []
    if potential_donors:
        notifications.append({
            **potential_donors[0],
            "notification_id": f"{DEMO_REQUEST_ID}:{potential_donors[0]['donor_id']}",
            "status": "contacted",
        })
    return {
        "synthetic": True,
        "simulation_label": "SIMULATED DEMO · NO REAL DONORS OR COLLECTION",
        "version": 0,
        "action_log": [],
        "request": {
            "id": DEMO_REQUEST_ID,
            "hospital": "Synthetic Hospital 1",
            "hospital_id": "DEMO-HOSPITAL-1",
            "blood_group": "O+",
            "component": "Red blood cells",
            "units_requested": 4,
            "urgency": "critical",
            "required_by": "2030-01-01T00:00:00Z",
            "location": {"city": "Demo City", "approximate_area": "North District"},
            "status": "Donor Contacted",
        },
        "inventory_check": {
            "source": "fixed synthetic demo inventory",
            "accessible_units": 1,
            "shortfall_units": 3,
            "remaining_shortfall_units": 3,
            "component": "Red blood cells",
            "status": "partial stock only; no stock fulfillment is claimed",
        },
        "donor_notifications": notifications,
        "potential_donors": potential_donors,
        "responses": [],
        "appointment": None,
        "collection": {"status": "not_confirmed", "confirmed_units": 0, "simulated": True},
        "testing": {"status": "not_confirmed", "simulated": True},
        "transport": {"status": "not_assigned", "simulated": True, "estimated_arrival": None},
        "history": [
            {"status": "Submitted", "at": now, "simulated": True},
            {"status": "Verifying Inventory", "at": now, "simulated": True},
            {"status": "Searching for Donors", "at": now, "simulated": True},
            {"status": "Donor Contacted", "at": now, "simulated": True},
        ],
        "next_actions": ["accept_donor", "decline_donor", "cancel"],
        "privacy_note": "Synthetic area labels only. No donor phone, email, exact address, or GPS is included.",
        "safety_note": "Group labels only identify candidates for coordination. Authorized professionals must assess eligibility, collection, testing, compatibility, release, and transport.",
    }


def apply_demo_action(
    state: dict[str, Any], action: str, donor_id: str | None = None
) -> dict[str, Any]:
    """Advance exactly one allowed demo step; reject out-of-order actions."""

    if not isinstance(state, dict) or state.get("synthetic") is not True:
        raise ValueError("demo session is missing or is not marked synthetic")
    if state.get("request", {}).get("id") != DEMO_REQUEST_ID:
        raise ValueError("demo request identifier is not recognized")
    current = deepcopy(state)
    history = current["history"]
    version = current.get("version", 0)

    def advance(status: str) -> None:
        current["request"]["status"] = status
        history.append({"status": status, "at": "SIMULATED · deterministic demo", "simulated": True})
        current["version"] = version + 1

    if action == "cancel":
        if current["request"].get("status") in {"Completed", "Cancelled"}:
            raise ValueError("a completed or cancelled request cannot be cancelled again")
        advance("Cancelled")
        current["next_actions"] = []
        current["action_log"].append({"action": action, "donor_id": donor_id})
        return current

    if action == "accept_donor" or action == "decline_donor":
        if action not in current.get("next_actions", []):
            raise ValueError("donor responses are not available at this point in the workflow")
        notification = next(
            (row for row in current["donor_notifications"] if row["donor_id"] == donor_id),
            None,
        )
        if notification is None:
            raise ValueError("select a donor notification from this synthetic request")
        if notification["status"] != "contacted":
            raise ValueError("this donor has already responded; duplicate responses are not allowed")
        response = "accepted" if action == "accept_donor" else "declined"
        notification["status"] = response
        current["responses"].append({"donor_id": donor_id, "response": response, "simulated": True})
        if response == "accepted":
            advance("Donor Accepted")
            current["next_actions"] = ["arrange_appointment", "cancel"]
            current["accepted_donor"] = {
                "donor_id": donor_id,
                "area": notification["area"],
                "contact_details_visible": False,
                "medical_eligibility_confirmed": False,
            }
        else:
            current["version"] = version + 1
            already_notified = {row["donor_id"] for row in current["donor_notifications"]}
            declined_ids = {row["donor_id"] for row in current["responses"] if row["response"] == "declined"}
            next_suggestion = next(
                (row for row in current["potential_donors"]
                 if row["donor_id"] not in already_notified and row["donor_id"] not in declined_ids),
                None,
            )
            if next_suggestion is not None:
                current["donor_notifications"].append({
                    **next_suggestion,
                    "notification_id": f"{DEMO_REQUEST_ID}:{next_suggestion['donor_id']}",
                    "status": "contacted",
                })
                current["next_actions"] = ["accept_donor", "decline_donor", "cancel"]
            else:
                advance("Searching for Donors")
                current["next_actions"] = ["cancel"]
        current["action_log"].append({"action": action, "donor_id": donor_id})
        return current

    expected = current.get("next_actions", [])
    allowed = {
        "arrange_appointment": "Collection Arranged",
        "confirm_collection": "At Authorized Blood Centre",
        "begin_testing": "Testing and Compatibility Checks",
        "confirm_testing_and_release": "Ready for Dispatch",
        "assign_transport": "Ready for Dispatch",
        "confirm_dispatch": "Dispatched",
        "confirm_receipt": "Received by Hospital",
        "complete": "Completed",
    }
    if action not in expected:
        raise ValueError("that action is not available at this point in the workflow")
    if action not in allowed:
        raise ValueError("unsupported demo action")

    if action == "arrange_appointment":
        current["appointment"] = {
            "facility": "Synthetic Licensed Blood Centre A",
            "time": "2030-01-01T10:00:00Z",
            "status": "proposed · simulated",
            "collection_team": {"status": "not assigned", "simulated": True},
        }
        current["next_actions"] = ["confirm_collection", "cancel"]
    elif action == "confirm_collection":
        current["collection"] = {"status": "confirmed · simulated", "simulated": True}
        current["request"]["status"] = "At Authorized Blood Centre"
        history.append({"status": "At Authorized Blood Centre", "at": "SIMULATED · deterministic demo", "simulated": True})
        current["next_actions"] = ["begin_testing", "cancel"]
        current["version"] = version + 1
        current["action_log"].append({"action": action, "donor_id": donor_id})
        return current
    elif action == "begin_testing":
        current["testing"] = {"status": "in progress · simulated", "simulated": True}
        current["next_actions"] = ["confirm_testing_and_release", "cancel"]
    elif action == "confirm_testing_and_release":
        # In this fixed teaching example, the synthetic centre confirms the
        # entire three-unit shortfall only after the simulated collection and
        # testing steps. This is demo state, never live inventory or a result.
        confirmed_units = current["inventory_check"]["shortfall_units"]
        current["collection"]["confirmed_units"] = confirmed_units
        current["inventory_check"]["remaining_shortfall_units"] = max(
            0, current["inventory_check"]["shortfall_units"] - confirmed_units
        )
        current["testing"] = {"status": "confirmed by synthetic demo step", "simulated": True}
        current["blood_centre_release"] = {
            "status": "authorized · simulated",
            "confirmed_units": confirmed_units,
            "simulated": True,
        }
        current["request"]["status"] = "Ready for Dispatch"
        history.append({"status": "Ready for Dispatch", "at": "SIMULATED · deterministic demo", "simulated": True})
        current["next_actions"] = ["assign_transport", "cancel"]
        current["version"] = version + 1
        current["action_log"].append({"action": action, "donor_id": donor_id})
        return current
    elif action == "assign_transport":
        current["transport"] = {
            "status": "assigned · simulated",
            "simulated": True,
            "estimated_arrival": "2030-01-01T10:25:00Z (simulated)",
        }
        current["next_actions"] = ["confirm_dispatch", "cancel"]
        current["version"] = version + 1
        current["action_log"].append({"action": action, "donor_id": donor_id})
        return current
    elif action == "confirm_dispatch":
        current["transport"]["status"] = "dispatched · simulated"
        current["request"]["status"] = "Dispatched"
        history.append({"status": "Dispatched", "at": "SIMULATED · deterministic demo", "simulated": True})
        current["next_actions"] = ["confirm_receipt", "cancel"]
        current["version"] = version + 1
        current["action_log"].append({"action": action, "donor_id": donor_id})
        return current
    elif action == "confirm_receipt":
        current["transport"]["status"] = "received · simulated"
        current["request"]["status"] = "Received by Hospital"
        history.append({"status": "Received by Hospital", "at": "SIMULATED · deterministic demo", "simulated": True})
        current["next_actions"] = ["complete", "cancel"]
        current["version"] = version + 1
        current["action_log"].append({"action": action, "donor_id": donor_id})
        return current
    elif action == "complete":
        if current["request"]["status"] != "Received by Hospital":
            raise ValueError("a request can be completed only after simulated hospital receipt")
        current["next_actions"] = []

    advance(allowed[action])
    current["action_log"].append({"action": action, "donor_id": donor_id})
    return current
