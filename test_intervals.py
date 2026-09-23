"""Unit tests for :func:`intervals.merge_intervals`.

Covers every stated requirement:
  - empty input
  - negative values
  - duplicates
  - zero-length intervals
  - unsorted / overlapping / touching input
  - ValueError when start exceeds end
  - input is never mutated
  - only the standard library is used (no external imports)
"""

import copy
import unittest

from intervals import merge_intervals


class TestMergeIntervals(unittest.TestCase):
    # ------------------------------------------------------------------
    # Requirements: empty input, single interval, sorting
    # ------------------------------------------------------------------
    def test_empty_input_returns_empty_list(self):
        self.assertEqual(merge_intervals([]), [])

    def test_single_interval_is_returned_as_list(self):
        self.assertEqual(merge_intervals([(1, 5)]), [(1, 5)])

    def test_result_is_sorted_by_start(self):
        # (1,3)+(2,6) -> (1,6); (1,6)+(5,8) overlap -> (1,8).
        # (9,11)+(10,12) -> (9,12). The two groups are disjoint.
        result = merge_intervals([(5, 8), (1, 3), (2, 6), (10, 12), (9, 11)])
        self.assertEqual(result, [(1, 8), (9, 12)])
        self.assertEqual(result, sorted(result))

    # ------------------------------------------------------------------
    # Requirement: overlapping intervals are merged
    # ------------------------------------------------------------------
    def test_overlapping_intervals_are_merged(self):
        self.assertEqual(merge_intervals([(1, 3), (2, 6)]), [(1, 6)])

    def test_fully_contained_interval_is_absorbed(self):
        self.assertEqual(merge_intervals([(1, 10), (3, 5)]), [(1, 10)])

    def test_contained_interval_with_larger_endpoint_first(self):
        # Sorting should handle containment regardless of endpoint order.
        self.assertEqual(merge_intervals([(1, 5), (2, 8)]), [(1, 8)])

    def test_multiple_overlapping_merge_cascade(self):
        self.assertEqual(
            merge_intervals([(1, 4), (2, 5), (3, 7), (6, 9)]),
            [(1, 9)],
        )

    # ------------------------------------------------------------------
    # Requirement: touching intervals are merged
    # ------------------------------------------------------------------
    def test_touching_intervals_are_merged(self):
        # End of one == start of the other -> they touch and merge.
        self.assertEqual(merge_intervals([(1, 5), (5, 7)]), [(1, 7)])

    def test_chain_of_touching_intervals(self):
        self.assertEqual(
            merge_intervals([(1, 2), (2, 3), (3, 4)]),
            [(1, 4)],
        )

    def test_touching_with_a_gap_between_other_pairs(self):
        result = merge_intervals([(1, 3), (3, 5), (8, 10), (10, 12)])
        self.assertEqual(result, [(1, 5), (8, 12)])

    # ------------------------------------------------------------------
    # Requirement: duplicates are collapsed
    # ------------------------------------------------------------------
    def test_duplicate_intervals_collapse(self):
        self.assertEqual(
            merge_intervals([(1, 3), (1, 3), (1, 3)]),
            [(1, 3)],
        )

    def test_duplicate_with_overlap(self):
        self.assertEqual(
            merge_intervals([(1, 4), (1, 4), (3, 6)]),
            [(1, 6)],
        )

    # ------------------------------------------------------------------
    # Requirement: zero-length intervals (start == end) are valid
    # ------------------------------------------------------------------
    def test_zero_length_interval_is_valid(self):
        self.assertEqual(merge_intervals([(3, 3)]), [(3, 3)])

    def test_zero_length_absorbed_into_larger_interval(self):
        self.assertEqual(merge_intervals([(1, 5), (3, 3)]), [(1, 5)])

    def test_zero_length_extends_into_adjacent(self):
        # (3,3) touches (3,7) at point 3 -> merge to (3,7)
        self.assertEqual(merge_intervals([(3, 3), (3, 7)]), [(3, 7)])

    def test_zero_length_bridges_two_intervals(self):
        # (2,3) and (5,8) do not touch, but (3,3)/(5,5) still leaves a gap.
        self.assertEqual(
            merge_intervals([(2, 3), (3, 3), (5, 5), (5, 8)]),
            [(2, 3), (5, 8)],
        )

    def test_duplicate_zero_length_intervals(self):
        self.assertEqual(merge_intervals([(4, 4), (4, 4)]), [(4, 4)])

    # ------------------------------------------------------------------
    # Requirement: negative values
    # ------------------------------------------------------------------
    def test_negative_values(self):
        self.assertEqual(
            merge_intervals([(-5, -1), (-3, 2)]),
            [(-5, 2)],
        )

    def test_all_negative(self):
        self.assertEqual(
            merge_intervals([(-10, -8), (-9, -6), (-7, -5)]),
            [(-10, -5)],
        )

    def test_negative_to_positive_spanning_zero(self):
        self.assertEqual(
            merge_intervals([(-2, 0), (0, 3)]),
            [(-2, 3)],
        )

    def test_single_negative_zero_length(self):
        self.assertEqual(merge_intervals([(-1, -1)]), [(-1, -1)])

    # ------------------------------------------------------------------
    # Requirement: ValueError when start > end
    # ------------------------------------------------------------------
    def test_raises_value_error_when_start_exceeds_end(self):
        with self.assertRaises(ValueError):
            merge_intervals([(5, 2)])

    def test_raises_value_error_even_within_larger_input(self):
        with self.assertRaises(ValueError):
            merge_intervals([(1, 4), (10, 3), (6, 8)])

    def test_raises_value_error_for_negative_start_exceeding_end(self):
        with self.assertRaises(ValueError):
            merge_intervals([(-1, -5)])

    # ------------------------------------------------------------------
    # Requirement: input is not mutated
    #
    # These tests deliberately use UNSORTED input so that an accidental
    # in-place `intervals.sort()` on the caller's data would reorder the
    # list and be caught by the "unchanged" assertion (a sorted input
    # would mask such a regression).
    # ------------------------------------------------------------------
    def test_input_list_is_not_mutated(self):
        original = [(5, 8), (1, 3), (2, 6)]
        original_copy = copy.deepcopy(original)
        merge_intervals(original)
        self.assertEqual(original, original_copy)

    def test_input_tuples_are_not_mutated(self):
        original = [(5, 8), (1, 3), (2, 6)]
        original_copy = [tuple(t) for t in original]
        merge_intervals(original)
        self.assertEqual([tuple(t) for t in original], original_copy)

    def test_input_is_unchanged_after_merge(self):
        original = [(8, 10), (1, 3), (2, 6), (15, 18), (17, 20)]
        snapshot = list(original)
        result = merge_intervals(original)
        self.assertEqual(original, snapshot)
        # And the result is independent of the input list identity.
        self.assertIsNot(result, original)

    # ------------------------------------------------------------------
    # Mixed / comprehensive scenarios
    # ------------------------------------------------------------------
    def test_complex_mixed_input(self):
        self.assertEqual(
            merge_intervals([(8, 10), (1, 3), (2, 6), (15, 18), (17, 20)]),
            [(1, 6), (8, 10), (15, 20)],
        )

    def test_unsorted_input_with_duplicates_and_gaps(self):
        # (2,3)+(3,3) touch -> absorbed; (1,3)+(3,7) overlap -> (1,7);
        # the duplicate (1,3) is collapsed; (5,5) is contained in (3,7).
        result = merge_intervals(
            [(5, 5), (1, 3), (1, 3), (3, 7), (10, 12)]
        )
        self.assertEqual(result, [(1, 7), (10, 12)])

    def test_adjacent_intervals_with_gap_between(self):
        result = merge_intervals([(1, 2), (4, 5)])
        self.assertEqual(result, [(1, 2), (4, 5)])

    def test_result_contains_tuples(self):
        result = merge_intervals([(1, 3), (2, 5)])
        self.assertIsInstance(result, list)
        for interval in result:
            self.assertIsInstance(interval, tuple)


class TestMergeTouching(unittest.TestCase):
    """Tests for the keyword-only ``merge_touching`` argument."""

    # ------------------------------------------------------------------
    # Default (merge_touching=True): touching intervals are merged.
    # ------------------------------------------------------------------
    def test_default_keeps_existing_touching_merge_behavior(self):
        self.assertEqual(merge_intervals([(1, 2), (2, 3)]), [(1, 3)])

    def test_merge_touching_true_explicit(self):
        # Explicitly passing the default must match the default behavior.
        self.assertEqual(
            merge_intervals([(1, 2), (2, 3)], merge_touching=True),
            [(1, 3)],
        )

    def test_chain_of_touching_intervals_default(self):
        self.assertEqual(
            merge_intervals([(1, 2), (2, 3), (3, 4)]),
            [(1, 4)],
        )

    # ------------------------------------------------------------------
    # merge_touching=False: touching intervals stay separate, but
    # strictly overlapping intervals still merge.
    # ------------------------------------------------------------------
    def test_merge_touching_false_keeps_touching_separate(self):
        self.assertEqual(
            merge_intervals([(1, 2), (2, 3)], merge_touching=False),
            [(1, 2), (2, 3)],
        )

    def test_merge_touching_false_example_from_spec(self):
        # The spec example: same input, separate output when False.
        self.assertEqual(
            merge_intervals([(1, 2), (2, 3)], merge_touching=False),
            [(1, 2), (2, 3)],
        )

    def test_merge_touching_false_still_merges_overlapping(self):
        # Strict overlap (shared interior) is merged regardless of mode.
        self.assertEqual(
            merge_intervals([(1, 3), (2, 5)], merge_touching=False),
            [(1, 5)],
        )

    def test_merge_touching_false_zero_length_at_endpoint(self):
        # (2,2) touches (2,5) at point 2 -> kept separate when False.
        self.assertEqual(
            merge_intervals([(2, 2), (2, 5)], merge_touching=False),
            [(2, 2), (2, 5)],
        )

    def test_merge_touching_false_mixed_touch_and_overlap(self):
        # (1,2)+(2,3) touch -> separate; (4,6)+(5,8) overlap -> (4,8).
        self.assertEqual(
            merge_intervals(
                [(1, 2), (2, 3), (4, 6), (5, 8)], merge_touching=False
            ),
            [(1, 2), (2, 3), (4, 8)],
        )

    def test_merge_touching_false_gap_remains_gap(self):
        self.assertEqual(
            merge_intervals([(1, 2), (4, 5)], merge_touching=False),
            [(1, 2), (4, 5)],
        )

    def test_merge_touching_false_negative_touching(self):
        self.assertEqual(
            merge_intervals([(-3, -1), (-1, 2)], merge_touching=False),
            [(-3, -1), (-1, 2)],
        )

    # ------------------------------------------------------------------
    # merge_touching=False with duplicates / zero-length / single input.
    # ------------------------------------------------------------------
    def test_merge_touching_false_duplicate_touching_stays(self):
        # Two identical zero-length intervals meet only at the shared
        # point (their sole endpoint) -> kept separate when False.
        self.assertEqual(
            merge_intervals([(3, 3), (3, 3)], merge_touching=False),
            [(3, 3), (3, 3)],
        )

    def test_merge_touching_false_identical_overlaps_merge(self):
        # Two identical intervals that overlap (not just touch) merge in
        # both modes.
        self.assertEqual(
            merge_intervals([(1, 2), (1, 2)], merge_touching=False),
            [(1, 2)],
        )

    def test_merge_touching_false_single_interval_unchanged(self):
        self.assertEqual(
            merge_intervals([(5, 5)], merge_touching=False),
            [(5, 5)],
        )

    def test_merge_touching_false_empty_input(self):
        self.assertEqual(merge_intervals([], merge_touching=False), [])

    # ------------------------------------------------------------------
    # Argument handling: merge_touching is keyword-only.
    # ------------------------------------------------------------------
    def test_merge_touching_is_keyword_only(self):
        with self.assertRaises(TypeError):
            # Positional use should fail because of the `*`.
            merge_intervals([(1, 2), (2, 3)], False)  # type: ignore[call-arg]

    def test_merge_touching_accepts_only_bool_semantics(self):
        # Truthy/falsy values behave like their bool conversion.
        self.assertEqual(
            merge_intervals([(1, 2), (2, 3)], merge_touching=1),
            [(1, 3)],
        )
        self.assertEqual(
            merge_intervals([(1, 2), (2, 3)], merge_touching=0),
            [(1, 2), (2, 3)],
        )

    # ------------------------------------------------------------------
    # Validation still applies in both modes.
    # ------------------------------------------------------------------
    def test_merge_touching_false_still_raises_on_invalid_interval(self):
        with self.assertRaises(ValueError):
            merge_intervals([(5, 2)], merge_touching=False)


if __name__ == "__main__":
    unittest.main()
