import { QuestObjective, QuestProgress } from './quest.types';

/**
 * 특정 objective가 완료되었는지 확인
 */
export function isObjectiveComplete(
  objective: QuestObjective,
  progress: QuestProgress,
  index: number,
): boolean {
  const current = progress[index] || 0;
  return current >= objective.count;
}

/**
 * 모든 objectives가 완료되었는지 확인
 */
export function areAllObjectivesComplete(
  objectives: QuestObjective[],
  progress: QuestProgress,
): boolean {
  return objectives.every((obj, idx) => isObjectiveComplete(obj, progress, idx));
}

/**
 * 진행도 요약 문자열 생성 (e.g. "2/3")
 */
export function getProgressSummary(
  objectives: QuestObjective[],
  progress: QuestProgress,
): string {
  const completed = objectives.filter((obj, idx) => 
    isObjectiveComplete(obj, progress, idx)
  ).length;
  return `${completed}/${objectives.length}`;
}

/**
 * objective 증가 (특정 index)
 */
export function incrementObjective(
  progress: QuestProgress,
  index: number,
  amount: number = 1,
): QuestProgress {
  const current = progress[index] || 0;
  return {
    ...progress,
    [index]: current + amount,
  };
}

