export function isProductionDatabaseId(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return false;
  return value.toLowerCase() !== '00000000-0000-0000-0000-000000000000';
}
