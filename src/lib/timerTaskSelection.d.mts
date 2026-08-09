import type { SprintTask } from '../types';

export function resolveTimerTaskSelection(
  tasks: SprintTask[],
  selectedTaskId: string,
  businessDate: string,
): string;
