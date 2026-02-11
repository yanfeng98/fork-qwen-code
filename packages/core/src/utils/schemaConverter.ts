export type SchemaComplianceMode = 'auto' | 'openapi_30';

export function convertSchema(
  schema: Record<string, unknown>,
  mode: SchemaComplianceMode = 'auto',
): Record<string, unknown> {
  if (mode === 'openapi_30') {
    return toOpenAPI30(schema);
  }

  return schema;
}

function toOpenAPI30(schema: Record<string, unknown>): Record<string, unknown> {
  const convert = (obj: unknown): unknown => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(convert);
    }

    const source = obj as Record<string, unknown>;
    const target: Record<string, unknown> = {};

    if (Array.isArray(source['type'])) {
      const types = source['type'] as string[];
      if (types.length === 2 && types.includes('null')) {
        target['type'] = types.find((t) => t !== 'null');
        target['nullable'] = true;
      } else {
        target['type'] = types[0];
      }
    } else if (source['type'] !== undefined) {
      target['type'] = source['type'];
    }

    if (source['const'] !== undefined) {
      target['enum'] = [source['const']];
      delete target['const'];
    }

    if (typeof source['exclusiveMinimum'] === 'number') {
      target['minimum'] = source['exclusiveMinimum'];
      target['exclusiveMinimum'] = true;
    }
    if (typeof source['exclusiveMaximum'] === 'number') {
      target['maximum'] = source['exclusiveMaximum'];
      target['exclusiveMaximum'] = true;
    }

    if (Array.isArray(source['items'])) {
      delete target['items'];
    } else if (
      typeof source['items'] === 'object' &&
      source['items'] !== null
    ) {
      target['items'] = convert(source['items']);
    }

    if (Array.isArray(source['enum'])) {
      target['enum'] = source['enum'].map(String);
    }

    for (const [key, value] of Object.entries(source)) {
      if (
        key === 'type' ||
        key === 'const' ||
        key === 'exclusiveMinimum' ||
        key === 'exclusiveMaximum' ||
        key === 'items' ||
        key === 'enum' ||
        key === '$schema' ||
        key === '$id' ||
        key === 'default' ||
        key === 'dependencies' ||
        key === 'patternProperties'
      ) {
        continue;
      }

      target[key] = convert(value);
    }

    return target;
  };

  return convert(schema) as Record<string, unknown>;
}
