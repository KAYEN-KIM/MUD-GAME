export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`환경 변수 ${key}가 설정되지 않았습니다.`);
  }
  return value;
}

export function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (!value) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`환경 변수 ${key}가 설정되지 않았습니다.`);
  }
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`환경 변수 ${key}는 숫자여야 합니다.`);
  }
  return num;
}

