from fractions import Fraction
import unittest

from lines import EquationError, compare_lines, parse_line


class LineTests(unittest.TestCase):
    def compare(self, first, second):
        return compare_lines(parse_line(first), parse_line(second))

    def test_default_intersection(self):
        result = self.compare("y = 2x + 1", "y = -x + 4")
        self.assertEqual(result["point"], {"x": 1, "y": 3})

    def test_vertical_horizontal(self):
        self.assertEqual(self.compare("x = 3", "y = -2")["point"], {"x": 3, "y": -2})

    def test_parallel_and_identical_including_vertical(self):
        for first, second in [("y = 2x + 1", "y = 2x + 3"), ("x = 1", "x = 2")]:
            self.assertEqual(self.compare(first, second)["kind"], "parallel")
        for first, second in [("y = 2x + 1", "2y = 4x + 2"), ("x = 3", "2x = 6"),
                              ("y = 0", "3y = 0")]:
            self.assertEqual(self.compare(first, second)["kind"], "identical")

    def test_standard_form_fractions_and_parentheses(self):
        self.assertEqual(self.compare("2(x + y) = 6", "x / 2 = y")["exact"], {"x": "2", "y": "1"})
        self.assertEqual(self.compare("y = x/3", "x=1")["exact"]["y"], "1/3")
        self.assertEqual(parse_line("y = .5x - 1e-2").c, Fraction(-1, 100))

    def test_near_parallel_lines_are_not_misclassified(self):
        result = self.compare("y = x", "y = 1.000000000001x + 1")
        self.assertEqual(result["kind"], "intersection")
        self.assertEqual(result["exact"]["x"], "-1000000000000")

    def test_invalid_and_unsafe_input(self):
        for equation in [None, "", "x", "x=y=1", "1=1", "1=2", "x*x=y", "x**2=y",
                         "y=1/x", "y=x/0", "y=sin(x)", "y=__import__('os')", "y=x.real",
                         "y=True", "y=z", "y=1e999999999", "y=1e-999999999", "y=" + "1" * 201]:
            with self.subTest(equation=equation), self.assertRaises(EquationError):
                parse_line(equation)


if __name__ == "__main__":
    unittest.main()
