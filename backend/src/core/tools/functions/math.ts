export function sumNumbers(a: number, b: number): number {
  return a + b;
}

export function multiplyNumbers(a: number, b: number): number {
  return a * b;
}

export function subtractNumbers(a: number, b: number): number {
  return a - b;
}

export function divideNumbers(a: number, b: number): number {
  if (b === 0) {
    throw new Error("Division by zero");
  }

  return a / b;
}

export function power(base: number, exponent: number): number {
  return base ** exponent;
}

export function squareRoot(x: number): number {
  if (x < 0) {
    throw new Error("Square root of negative number");
  }

  return Math.sqrt(x);
}
