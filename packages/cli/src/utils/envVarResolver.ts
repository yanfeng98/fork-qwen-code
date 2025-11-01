export function resolveEnvVarsInObject<T>(obj: T): T {
  return resolveEnvVarsInObjectInternal(obj, new WeakSet());
}

function resolveEnvVarsInObjectInternal<T>(
  obj: T,
  visited: WeakSet<object>,
): T {
  if (
    obj === null ||
    obj === undefined ||
    typeof obj === 'boolean' ||
    typeof obj === 'number'
  ) {
    return obj;
  }

  if (typeof obj === 'string') {
    return resolveEnvVarsInString(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    if (visited.has(obj)) {
      return [...obj] as unknown as T;
    }

    visited.add(obj);
    const result = obj.map((item) =>
      resolveEnvVarsInObjectInternal(item, visited),
    ) as unknown as T;
    visited.delete(obj);
    return result;
  }

  if (typeof obj === 'object') {
    if (visited.has(obj as object)) {
      return { ...obj } as T;
    }

    visited.add(obj as object);
    const newObj = { ...obj } as T;
    for (const key in newObj) {
      if (Object.prototype.hasOwnProperty.call(newObj, key)) {
        newObj[key] = resolveEnvVarsInObjectInternal(newObj[key], visited);
      }
    }
    visited.delete(obj as object);
    return newObj;
  }

  return obj;
}

export function resolveEnvVarsInString(value: string): string {
  const envVarRegex = /\$(?:(\w+)|{([^}]+)})/g; // Find $VAR_NAME or ${VAR_NAME}
  return value.replace(envVarRegex, (match, varName1, varName2) => {
    const varName = varName1 || varName2;
    if (process && process.env && typeof process.env[varName] === 'string') {
      return process.env[varName]!;
    }
    return match;
  });
}
