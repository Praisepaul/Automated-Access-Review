function correlateEmail(email) {
    if (!email) return "";
    return email
        .toLowerCase()
        .trim()
        .replace("@finspace.ai", "@neospace.ai"); // Correlation logic
}

function isSystemAccount(email) {
    const systemKeywords = [
        'sys_', 
        'ansible', 
        'terraform', 
        'automation', 
        'bot@', 
        'serviceaccount',
        'access_review',
        'administrativo',
    ];
    return systemKeywords.some(keyword => email.toLowerCase().includes(keyword));
}

function normalize(input) {
  const map = new Map();
  if (!input) return map;

  const add = (item) => {
    let rawEmail = "";
    let originalValue = item;
    if (typeof item === "string") {
      rawEmail = item;
      originalValue = { email: item };
    } else if (item?.email) {
      rawEmail = item.email;
    }

    if (rawEmail) {
            const normalizedEmail = correlateEmail(rawEmail);
            if (isSystemAccount(normalizedEmail)) {
            return;
        }
            map.set(normalizedEmail, originalValue);
        }
  };

  if (input instanceof Set || Array.isArray(input)) {
    for (const item of input) add(item);
    return map;
  }

  if (typeof input === "object") {
    for (const value of Object.values(input)) add(value);
  }

  return map;
}


export function diffSets(expected, actual) {
  const expectedMap = normalize(expected);
  const actualMap = normalize(actual);

  const unauthorized = [];
  const missing = [];

  for (const [email, value] of actualMap) {
    if (!expectedMap.has(email)) {
      unauthorized.push(value);
    }
  }

  for (const [email, value] of expectedMap) {
    if (!actualMap.has(email)) {
      missing.push(value);
    }
  }

  return { unauthorized, missing };
}
