function requireFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }

  return value;
}

export function sumNumbers(args: Record<string, unknown>): number {
  return requireFiniteNumber(args.a, "a") + requireFiniteNumber(args.b, "b");
}

export function multiplyNumbers(args: Record<string, unknown>): number {
  return requireFiniteNumber(args.a, "a") * requireFiniteNumber(args.b, "b");
}

export function subtractNumbers(args: Record<string, unknown>): number {
  return requireFiniteNumber(args.a, "a") - requireFiniteNumber(args.b, "b");
}

export function divideNumbers(args: Record<string, unknown>): number {
  const denominator = requireFiniteNumber(args.b, "b");
  if (denominator === 0) {
    throw new Error("Division by zero");
  }

  return requireFiniteNumber(args.a, "a") / denominator;
}

export function power(args: Record<string, unknown>): number {
  return requireFiniteNumber(args.base, "base") ** requireFiniteNumber(args.exponent, "exponent");
}

export function squareRoot(args: Record<string, unknown>): number {
  const x = requireFiniteNumber(args.x, "x");
  if (x < 0) {
    throw new Error("Square root of negative number");
  }

  return Math.sqrt(x);
}
