export function resolveTimerTaskSelection(tasks, selectedTaskId, businessDate) {
  const selected = tasks.find(task => task.id === selectedTaskId);
  return selected?.businessDate === businessDate && ['todo', 'doing'].includes(selected.status)
    ? selected.id
    : '';
}
