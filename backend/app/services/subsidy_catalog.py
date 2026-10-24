"""Illustrative subsidy and vendor catalog for the GoSolar demo."""
from typing import Any


SUBSIDIES: list[dict[str, Any]] = [
    {
        "id": "pm-surya-ghar", "name": "PM Surya Ghar: Muft Bijli Yojana",
        "provider": "Central Government", "kind": "residential", "eligibility": ["Residential Only"],
        "perks": ["Central rooftop assistance", "Net-metering pathway"], "illustrative": False,
    },
    {
        "id": "state-top-up", "name": "State Solar Incentive (illustrative)",
        "provider": "State / DISCOM", "kind": "residential", "eligibility": ["Selected states", "Residential"],
        "perks": ["Potential state top-up", "Subject to current state policy"], "illustrative": True,
    },
    {
        "id": "pm-kusum", "name": "PM-KUSUM Components A/C (illustrative)",
        "provider": "Central + State", "kind": "agricultural", "eligibility": ["Agrarian feeder"],
        "perks": ["Agricultural solar support", "Feeder-specific eligibility"], "illustrative": True,
    },
    {
        "id": "rwa-aggregate", "name": "Housing Society Common Facilities (illustrative)",
        "provider": "Central / State programs", "kind": "rwa", "eligibility": ["RWA Compatible", "Common facilities"],
        "perks": ["Aggregated capacity assessment", "Up to 500 kW demo band"], "illustrative": True,
    },
]

VENDORS: list[dict[str, Any]] = [
    {"id": "tata-cleanmax", "name": "Tata Power Solar / CleanMax Premier", "tier": "Tier 1 Certified", "price_per_kw": 58000, "rating": 4.9, "installs": "1,200+ rooftop installs", "specs": "Tier-1 bifacial N-Type panels, micro-inverters, 10-year free O&M, 25-year panel warranty", "turnaround_days": 14},
    {"id": "waaree-eco", "name": "Waaree Energies Eco-Smart", "tier": "Value / Standard", "price_per_kw": 48000, "rating": 4.7, "installs": "850+ installs", "specs": "Mono-PERC modules, string inverter, 5-year free O&M, 25-year performance warranty", "turnaround_days": 20},
    {"id": "adani-loom-fast", "name": "Adani Solar Express / Loom Solar Fast-Track", "tier": "Speed & Budget Pick", "price_per_kw": 44000, "rating": 4.5, "installs": "600+ installs", "specs": "Grid-tie inverter, standard panels, 2-year warranty, DISCOM liaison", "turnaround_days": 10},
]


def central_subsidy(capacity_kw: float) -> int:
    return round(min(capacity_kw, 2) * 30_000 + min(max(capacity_kw - 2, 0), 1) * 18_000)


def estimate_subsidy(scheme_id: str, capacity_kw: float, state: str, consumer_group: str = "residential") -> int:
    if scheme_id == "pm-surya-ghar":
        return central_subsidy(capacity_kw) if consumer_group == "residential" else 0
    if scheme_id == "state-top-up":
        if consumer_group != "residential":
            return 0
        # Clearly illustrative: never presented as a guaranteed state entitlement.
        return (15_000 if state.casefold() == "gujarat" else 10_000) if capacity_kw >= 1 else 0
    if scheme_id == "pm-kusum":
        return round(capacity_kw * 60_000 * 0.6) if consumer_group == "agricultural" else 0
    if scheme_id == "rwa-aggregate":
        return round(min(capacity_kw, 500) * 18_000) if consumer_group == "rwa" else 0
    return 0
