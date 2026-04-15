// ============================================================
// QUEST SOLVER
// Solves PoMI quiz questions (arithmetic, string manipulation)
// ============================================================

/**
 * Solve a PoMI quest question.
 * Quest questions bisa berupa:
 * - Arithmetic: "What is 42 + 58?", "Calculate 15 * 3 - 7"
 * - String: "Reverse the string 'hello'", "What is 'abc' repeated 3 times?"
 * - Hash/Encode: "What is the SHA256 of 'nara'?"
 * - Logic: "What is the 10th Fibonacci number?"
 * - Hex: "Convert 255 to hexadecimal"
 *
 * Returns null jika gabisa solve.
 */
export function solveQuestion(question) {
  const q = question.trim();

  // Coba semua solver, return yg pertama berhasil
  const solvers = [
    solveArrayOperations,
    solveArithmetic,
    solveReverse,
    solveRepeat,
    solveUpperLower,
    solveLength,
    solveFibonacci,
    solveHexConvert,
    solveBaseConvert,
    solveConcatenate,
    solveReplace,
    solveCharAt,
    solveSubstring,
    solveSortChars,
    solveCountChars,
    solveModulo,
    solvePower,
    solveFactorial,
    solvePalindrome,
    solveMinMax,
    solveSum,
    solveBinaryConvert,
    solveAbsValue,
    solveGCD,
    solveEvalExpression,
  ];

  for (const solver of solvers) {
    try {
      const result = solver(q);
      if (result !== null && result !== undefined) {
        return String(result);
      }
    } catch {
      // Lanjut ke solver berikutnya
    }
  }

  return null;
}

// ──── ARRAY OPERATIONS ────

function solveArrayOperations(q) {
  // "What is the product of [4, 1, 3, 5]?"
  // "Calculate the sum of [1, 2, 3, 4]"
  const productMatch = q.match(/product\s+of\s*\[([\d,\s]+)\]/i);
  if (productMatch) {
    const nums = productMatch[1].split(',').map(n => parseInt(n.trim()));
    return nums.reduce((a, b) => a * b, 1);
  }
  
  const sumMatch = q.match(/sum\s+of\s*\[([\d,\s]+)\]/i);
  if (sumMatch) {
    const nums = sumMatch[1].split(',').map(n => parseInt(n.trim()));
    return nums.reduce((a, b) => a + b, 0);
  }
  
  const maxMatch = q.match(/max(?:imum)?\s+of\s*\[([\d,\s]+)\]/i);
  if (maxMatch) {
    const nums = maxMatch[1].split(',').map(n => parseInt(n.trim()));
    return Math.max(...nums);
  }
  
  const minMatch = q.match(/min(?:imum)?\s+of\s*\[([\d,\s]+)\]/i);
  if (minMatch) {
    const nums = minMatch[1].split(',').map(n => parseInt(n.trim()));
    return Math.min(...nums);
  }
  
  return null;
}

// ──── ARITHMETIC ────

function solveArithmetic(q) {
  // "What is 42 + 58?" / "Calculate 15 * 3 - 7" / "Compute 100 / 4"
  const patterns = [
    /(?:what is|calculate|compute|evaluate|solve)\s+([\d\s+\-*/().]+)/i,
    /^([\d\s+\-*/().]+)\s*[=?]?\s*$/,
    /result of\s+([\d\s+\-*/().]+)/i,
  ];

  for (const pat of patterns) {
    const m = q.match(pat);
    if (m) {
      const expr = m[1].trim().replace(/[^0-9+\-*/(). ]/g, '');
      if (expr && /\d/.test(expr)) {
        try {
          const result = Function(`"use strict"; return (${expr})`)();
          if (typeof result === 'number' && isFinite(result)) {
            return Number.isInteger(result) ? result : parseFloat(result.toFixed(10));
          }
        } catch { /* skip */ }
      }
    }
  }
  return null;
}

// ──── STRING REVERSE ────

function solveReverse(q) {
  const m = q.match(/reverse\s+(?:the\s+)?(?:string\s+)?['"](.+?)['"]/i)
    || q.match(/reverse\s+of\s+['"](.+?)['"]/i)
    || q.match(/['"](.+?)['"]\s+reversed/i);
  if (m) return m[1].split('').reverse().join('');
  return null;
}

// ──── STRING REPEAT ────

function solveRepeat(q) {
  const m = q.match(/['"](.+?)['"]\s+repeated?\s+(\d+)\s+times?/i)
    || q.match(/repeat\s+(?:the\s+string\s+)?['"](.+?)['"]\s+(\d+)\s+times?/i)
    || q.match(/['"](.+?)['"]\s+repeated?\s+(\d+)\s+times?/i);
  if (m) return m[1].repeat(parseInt(m[2]));
  return null;
}

// ──── UPPER/LOWER ────

function solveUpperLower(q) {
  let m = q.match(/(?:convert|transform|change)?\s*['"](.+?)['"]\s+to\s+(?:upper\s*case|uppercase|upper)/i)
    || q.match(/upper\s*case\s+(?:of\s+)?['"](.+?)['"]/i);
  if (m) return m[1].toUpperCase();

  m = q.match(/(?:convert|transform|change)?\s*['"](.+?)['"]\s+to\s+(?:lower\s*case|lowercase|lower)/i)
    || q.match(/lower\s*case\s+(?:of\s+)?['"](.+?)['"]/i);
  if (m) return m[1].toLowerCase();
  return null;
}

// ──── STRING LENGTH ────

function solveLength(q) {
  const m = q.match(/(?:length|len)\s+(?:of\s+)?['"](.+?)['"]/i)
    || q.match(/how\s+(?:many|long)\s+(?:characters?\s+(?:in|does)\s+)?['"](.+?)['"]/i);
  if (m) return (m[1] || m[2]).length;
  return null;
}

// ──── FIBONACCI ────

function solveFibonacci(q) {
  const m = q.match(/(\d+)(?:st|nd|rd|th)\s+fibonacci/i)
    || q.match(/fibonacci\s+(?:number\s+)?(?:#\s*)?(\d+)/i);
  if (m) {
    const n = parseInt(m[1]);
    if (n > 100) return null;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
    return n <= 1 ? n : b;
  }
  return null;
}

// ──── HEX CONVERT ────

function solveHexConvert(q) {
  const m = q.match(/convert\s+(\d+)\s+to\s+hex(?:adecimal)?/i)
    || q.match(/(?:what is|find)\s+(?:the\s+)?hex(?:adecimal)?\s+(?:of|for|representation)\s+(\d+)/i)
    || q.match(/(\d+)\s+in\s+hex(?:adecimal)?/i);
  if (m) return parseInt(m[1] || m[2]).toString(16);
  return null;
}

// ──── BASE CONVERT ────

function solveBaseConvert(q) {
  const m = q.match(/convert\s+(\d+)\s+(?:from\s+)?(?:base\s+)?(\d+)\s+to\s+(?:base\s+)?(\d+)/i);
  if (m) return parseInt(m[1], parseInt(m[2])).toString(parseInt(m[3]));
  return null;
}

// ──── BINARY CONVERT ────

function solveBinaryConvert(q) {
  // Binary
  let m = q.match(/convert\s+(?:decimal\s+)?(\d+)\s+to\s+binary/i)
    || q.match(/(\d+)\s+in\s+binary/i)
    || q.match(/binary\s+(?:of|for|representation)\s+(\d+)/i);
  if (m) return parseInt(m[1]).toString(2);
  
  // Octal
  m = q.match(/convert\s+(?:decimal\s+)?(\d+)\s+(?:to\s+)?octal/i)
    || q.match(/(\d+)\s+in\s+octal/i)
    || q.match(/octal\s+(?:of|for|representation)\s+(\d+)/i);
  if (m) return parseInt(m[1]).toString(8);
  
  return null;
}

// ──── CONCATENATE ────

function solveConcatenate(q) {
  const m = q.match(/concat(?:enate)?\s+['"](.+?)['"]\s+(?:and|with|\+)\s+['"](.+?)['"]/i);
  if (m) return m[1] + m[2];
  return null;
}

// ──── REPLACE ────

function solveReplace(q) {
  const m = q.match(/replace\s+['"](.+?)['"]\s+(?:with|by)\s+['"](.+?)['"]\s+in\s+['"](.+?)['"]/i)
    || q.match(/in\s+['"](.+?)['"],?\s+replace\s+['"](.+?)['"]\s+(?:with|by)\s+['"](.+?)['"]/i);
  if (m) {
    if (m.length === 4 && q.toLowerCase().startsWith('replace')) {
      return m[3].replaceAll(m[1], m[2]);
    }
    if (m.length === 4 && q.toLowerCase().startsWith('in')) {
      return m[1].replaceAll(m[2], m[3]);
    }
  }
  return null;
}

// ──── CHAR AT ────

function solveCharAt(q) {
  const m = q.match(/(?:what is )?(?:the )?(?:character|char|letter)\s+(?:at\s+)?(?:position|index)\s+(\d+)\s+(?:of|in)\s+['"](.+?)['"]/i)
    || q.match(/(\d+)(?:st|nd|rd|th)\s+(?:character|char|letter)\s+(?:of|in)\s+['"](.+?)['"]/i);
  if (m) {
    const idx = parseInt(m[1]);
    const str = m[2];
    return str[idx] ?? str[idx - 1]; // 0-indexed atau 1-indexed
  }
  return null;
}

// ──── SUBSTRING ────

function solveSubstring(q) {
  const m = q.match(/substring\s+(?:of\s+)?['"](.+?)['"]\s+from\s+(\d+)\s+to\s+(\d+)/i);
  if (m) return m[1].substring(parseInt(m[2]), parseInt(m[3]));
  return null;
}

// ──── SORT CHARS ────

function solveSortChars(q) {
  const m = q.match(/sort\s+(?:the\s+)?(?:characters?|chars?|letters?)\s+(?:of|in)\s+['"](.+?)['"]/i);
  if (m) return m[1].split('').sort().join('');
  return null;
}

// ──── COUNT CHARS ────

function solveCountChars(q) {
  const m = q.match(/(?:count|how many)\s+['"](.)['"]\s+(?:in|are in)\s+['"](.+?)['"]/i)
    || q.match(/(?:count|how many)\s+(?:times?\s+(?:does\s+)?)?['"](.)['"]\s+appear\s+in\s+['"](.+?)['"]/i);
  if (m) return m[2].split(m[1]).length - 1;
  return null;
}

// ──── MODULO ────

function solveModulo(q) {
  const m = q.match(/(\d+)\s+(?:mod(?:ulo)?|%)\s+(\d+)/i)
    || q.match(/(?:what is\s+)?(?:the\s+)?remainder\s+(?:of|when)\s+(\d+)\s+(?:divided by|\/)\s+(\d+)/i);
  if (m) return parseInt(m[1]) % parseInt(m[2]);
  return null;
}

// ──── POWER ────

function solvePower(q) {
  const m = q.match(/(\d+)\s+(?:to the power of|\*\*|\^)\s+(\d+)/i)
    || q.match(/(\d+)\s+raised\s+to\s+(\d+)/i)
    || q.match(/pow(?:er)?\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (m) return Math.pow(parseInt(m[1]), parseInt(m[2]));
  return null;
}

// ──── FACTORIAL ────

function solveFactorial(q) {
  const m = q.match(/factorial\s+(?:of\s+)?(\d+)/i)
    || q.match(/(\d+)\s*!/);
  if (m) {
    const n = parseInt(m[1]);
    if (n > 20) return null;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }
  return null;
}

// ──── PALINDROME CHECK ────

function solvePalindrome(q) {
  const m = q.match(/is\s+['"](.+?)['"]\s+a?\s*palindrome/i);
  if (m) {
    const s = m[1].toLowerCase().replace(/[^a-z0-9]/g, '');
    return s === s.split('').reverse().join('') ? 'true' : 'false';
  }
  return null;
}

// ──── MIN/MAX ────

function solveMinMax(q) {
  let m = q.match(/(?:what is )?(?:the )?max(?:imum)?\s+(?:of|in|from)\s+([\d,\s]+)/i)
    || q.match(/(?:what is )?(?:the )?largest\s+(?:of|in|from|number)\s+([\d,\s]+)/i);
  if (m) {
    const nums = m[1].match(/\d+/g).map(Number);
    return Math.max(...nums);
  }

  m = q.match(/(?:what is )?(?:the )?min(?:imum)?\s+(?:of|in|from)\s+([\d,\s]+)/i)
    || q.match(/(?:what is )?(?:the )?smallest\s+(?:of|in|from|number)\s+([\d,\s]+)/i);
  if (m) {
    const nums = m[1].match(/\d+/g).map(Number);
    return Math.min(...nums);
  }
  return null;
}

// ──── SUM ────

function solveSum(q) {
  const m = q.match(/(?:what is )?(?:the )?sum\s+(?:of\s+)?([\d,\s+and]+)/i);
  if (m) {
    const nums = m[1].match(/\d+/g)?.map(Number);
    if (nums?.length) return nums.reduce((a, b) => a + b, 0);
  }
  return null;
}

// ──── ABSOLUTE VALUE ────

function solveAbsValue(q) {
  const m = q.match(/(?:absolute value|abs)\s+(?:of\s+)?(-?\d+(?:\.\d+)?)/i);
  if (m) return Math.abs(parseFloat(m[1]));
  return null;
}

// ──── GCD ────

function solveGCD(q) {
  const m = q.match(/(?:gcd|greatest common divisor)\s+(?:of\s+)?(\d+)\s+(?:and\s+)?(\d+)/i);
  if (m) {
    let a = parseInt(m[1]), b = parseInt(m[2]);
    while (b) [a, b] = [b, a % b];
    return a;
  }
  return null;
}

// ──── GENERIC EVAL (fallback) ────

function solveEvalExpression(q) {
  // Terakhir, coba eval expression numerik yang ada di question
  const exprMatch = q.match(/([\d\s+\-*/%().]+)/);
  if (exprMatch) {
    const expr = exprMatch[1].trim();
    if (expr.length >= 3 && /\d.*[\+\-\*\/\%].*\d/.test(expr)) {
      try {
        const clean = expr.replace(/[^0-9+\-*/(). %]/g, '');
        const result = Function(`"use strict"; return (${clean})`)();
        if (typeof result === 'number' && isFinite(result)) {
          return Number.isInteger(result) ? result : parseFloat(result.toFixed(10));
        }
      } catch { /* skip */ }
    }
  }
  return null;
}
