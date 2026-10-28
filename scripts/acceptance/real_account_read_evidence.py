"""Union only explicitly reviewed, compatible fixed account-read receipts."""
from .real_account_a1_evidence import real_account_read_sources as a1_sources
from .real_account_a2_evidence import real_account_collection_sources as a2_sources
from .real_account_a3_evidence import real_account_overview_sources as a3_sources
from .real_account_a4_evidence import real_account_backlog_schedule_sources as a4_sources
from .real_account_a5_evidence import real_account_dashboard_sources as a5_sources
from .real_account_a6_evidence import real_account_series_sources as a6_sources
from .real_account_a7_evidence import real_account_episode_sources as a7_sources
from .qs55_account_compatibility import qs55_compatible_account_sources


def real_account_read_sources(root, catalog):
    result = {}
    for source in (a1_sources, a2_sources, a3_sources, a4_sources, a5_sources, a6_sources, a7_sources,
                   qs55_compatible_account_sources):
        for name, references in source(root, catalog).items():
            result.setdefault(name, set()).update(references)
    return result
