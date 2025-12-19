export function getKoreanTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export function addMilliseconds(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

