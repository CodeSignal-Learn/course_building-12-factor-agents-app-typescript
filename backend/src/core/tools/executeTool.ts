import {
  divideNumbers,
  multiplyNumbers,
  power,
  squareRoot,
  subtractNumbers,
  sumNumbers
} from "./functions/math.js";

export function executeTool(name: string, args: Record<string, unknown>): string {
  try {
    const result = executeMathTool(name, args);
    return JSON.stringify({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ result: `Error: ${message}` });
  }
}

function executeMathTool(name: string, args: Record<string, unknown>): number {
  switch (name) {
    case "sum_numbers":
      return sumNumbers(args);
    case "multiply_numbers":
      return multiplyNumbers(args);
    case "subtract_numbers":
      return subtractNumbers(args);
    case "divide_numbers":
      return divideNumbers(args);
    case "power":
      return power(args);
    case "square_root":
      return squareRoot(args);
    default:
      throw new Error(`Tool ${name} not found`);
  }
}
