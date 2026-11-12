"""Safe linear equation parsing and exact two-line intersection calculations."""

import ast
from dataclasses import dataclass
from fractions import Fraction
import re


class EquationError(ValueError):
    """An equation cannot be represented as a single straight line."""


@dataclass(frozen=True)
class Line:
    a: Fraction
    b: Fraction
    c: Fraction

    def as_dict(self):
        return {"a": float(self.a), "b": float(self.b), "c": float(self.c),
                "vertical": self.b == 0,
                "slope": float(-self.a / self.b) if self.b else None,
                "intercept": float(self.c / self.b) if self.b else None,
                "x": float(self.c / self.a) if not self.b else None}


def _bounded(values):
    # Bound intermediate rational values as well as input length to limit work.
    if any(abs(v) > 10**12 or v.denominator > 10**12 for v in values):
        raise EquationError("Numbers are too large or too precise; use values up to 1e12 and precision up to 12 decimal places.")
    return values


def _expression(source):
    source = source.strip()
    # Permit familiar 2x, 3y and 2(x + y) notation. All evaluation below is
    # explicit; input is never passed to eval, exec, or a symbolic interpreter.
    source = re.sub(r"(?<=[0-9.)])\s*(?=[xy(])", "*", source)
    source = re.sub(r"(?<=[xy])\s*(?=\()", "*", source)
    try:
        root = ast.parse(source, mode="eval")
    except (SyntaxError, RecursionError):
        raise EquationError("Use a linear expression such as 2x + y = 4.") from None

    def visit(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            literal = ast.get_source_segment(source, node)
            exponent = re.search(r"[eE]([+-]?\d+)$", literal)
            if exponent and abs(int(exponent[1])) > 12:
                raise EquationError("Use scientific notation exponents between -12 and 12.")
            try:
                value = Fraction(literal)
            except (ValueError, OverflowError):
                raise EquationError("Use finite decimal numbers or fractions.") from None
            return _bounded((Fraction(0), Fraction(0), value))
        if isinstance(node, ast.Name) and node.id in ("x", "y"):
            return (Fraction(node.id == "x"), Fraction(node.id == "y"), Fraction(0))
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            sign = -1 if isinstance(node.op, ast.USub) else 1
            return tuple(sign * v for v in visit(node.operand))
        if isinstance(node, ast.BinOp):
            left, right = visit(node.left), visit(node.right)
            if isinstance(node.op, (ast.Add, ast.Sub)):
                sign = -1 if isinstance(node.op, ast.Sub) else 1
                return _bounded(tuple(l + sign * r for l, r in zip(left, right)))
            if isinstance(node.op, ast.Mult):
                if any(left[:2]) and any(right[:2]):
                    raise EquationError("Only straight lines are supported; remove products of variables.")
                variable, constant = (left, right) if any(left[:2]) else (right, left)
                return _bounded(tuple(v * constant[2] for v in variable))
            if isinstance(node.op, ast.Div):
                if any(right[:2]):
                    raise EquationError("Divide only by a constant, not by x or y.")
                if not right[2]:
                    raise EquationError("Division by zero is not allowed.")
                return _bounded(tuple(v / right[2] for v in left))
        raise EquationError("Use x, y, numbers, parentheses, and +, -, *, / only.")

    return visit(root.body)


def parse_line(equation):
    if not isinstance(equation, str) or not equation.strip():
        raise EquationError("Enter an equation, for example y = 2x + 1.")
    if len(equation) > 200:
        raise EquationError("Keep each equation under 200 characters.")
    if equation.count("=") != 1:
        raise EquationError("Include exactly one equals sign, for example x = 3.")
    left, right = (_expression(part) for part in equation.split("="))
    a, b, constant = _bounded(tuple(l - r for l, r in zip(left, right)))
    if not a and not b:
        raise EquationError("This equation does not describe a single line.")
    return Line(a, b, -constant)


def compare_lines(first, second):
    determinant = first.a * second.b - second.a * first.b
    if not determinant:
        same = (first.a * second.c == second.a * first.c
                and first.b * second.c == second.b * first.c)
        return {"kind": "identical" if same else "parallel", "point": None}
    x = (first.c * second.b - second.c * first.b) / determinant
    y = (first.a * second.c - second.a * first.c) / determinant
    return {"kind": "intersection", "point": {"x": float(x), "y": float(y)},
            "exact": {"x": str(x), "y": str(y)}}
