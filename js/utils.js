// js/utils.js
export function generateId() { return '_' + Math.random().toString(36).substr(2, 9); }

export function findNestedSubtask(subtasks, targetId) {
    if (!subtasks) return null;
    for (const subtask of subtasks) {
        if (subtask.id === targetId) {
            return subtask;
        }
        // Usa optional chaining para segurança
        if (subtask.subtasks?.length > 0) {
            const found = findNestedSubtask(subtask.subtasks, targetId);
            if (found) return found;
        }
    }
    return null;
}