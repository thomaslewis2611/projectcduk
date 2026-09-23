"""Interval merging utilities.

Provides :func:`merge_intervals`, which collapses a sequence of integer
``(start, end)`` pairs into a sorted list of disjoint intervals whose
overlapping or touching members have been combined.

Only the Python standard library is used.
"""

from __future__ import annotations

from typing import List, Sequence, Tuple

Interval = Tuple[int, int]


def merge_intervals(
    intervals: Sequence[Interval], *, merge_touching: bool = True
) -> List[Interval]:
    """Merge overlapping integer intervals.

    Each input interval is an ``(start, end)`` pair of integers where
    ``start <= end`` (a zero-length interval with ``start == end`` is
    permitted and represents a single point on the number line).

    Two intervals are merged when they *overlap* (share at least one
    point). When ``merge_touching`` is true (the default) intervals that
    merely *touch* — the end of one equals the start of the next — are
    also merged. When ``merge_touching`` is false, touching intervals
    remain separate.

    Args:
        intervals: A sequence of ``(start, end)`` integer pairs. The
            input is never modified.
        merge_touching: Keyword-only. When true (default) intervals
            meeting at a shared endpoint are merged, so ``[(1, 2),
            (2, 3)]`` becomes ``[(1, 3)]``. When false such intervals
            stay separate, returning ``[(1, 2), (2, 3)]``.

    Returns:
        A new list of disjoint ``(start, end)`` tuples sorted ascending
        by ``start`` (then by ``end``) with all overlapping intervals
        combined (and touching ones when ``merge_touching`` is true).
        Returns an empty list when the input is empty.

    Raises:
        ValueError: If any interval has ``start > end``.
    """
    # Validate every interval and build an independent copy so the input
    # is never mutated.
    validated: List[Interval] = []
    for interval in intervals:
        start, end = interval
        if start > end:
            raise ValueError(
                "interval start ({}) exceeds end ({})".format(start, end)
            )
        validated.append((start, end))

    if not validated:
        return []

    # Deterministic ordering: by start, then by end. Operating on the
    # copy keeps the caller's data intact.
    validated.sort()

    merged: List[Interval] = [validated[0]]
    for start, end in validated[1:]:
        last_start, last_end = merged[-1]
        # Strict overlap: the next start is strictly inside the running
        # interval. Touching (start == last_end) counts only when
        # merge_touching is true.
        if start < last_end or (merge_touching and start == last_end):
            # Overlapping (or touching): extend the running interval's
            # end if this one reaches further.
            if end > last_end:
                merged[-1] = (last_start, end)
        else:
            merged.append((start, end))

    return merged
