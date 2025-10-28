// js/eventBinder.js
import { showModal, hideModal } from './modalHandler.js';
import { addTask, updateTask, deleteTask, updateSubtasks, getTasks, saveTaskOrder, restoreTaskFromTrash, permanentlyDeleteTask, getTrash } from './taskStore.js';
import { applyFilter, findNestedSubtask } from './uiRenderer.js'; // Importa applyFilter e findNestedSubtask
import { generateId } from './utils.js'; // Para IDs de subtarefas locais

// Importações temporárias de app.js (para funções de modal/menu que ainda estão lá)
import { openSubtaskModalForCreate, openSubtaskModalForEdit, deleteSubtaskViaModal, toggleSubtaskMenu, exportTaskToGoogleLink } from './app.js';

// Referências a variáveis globais de app.js (ainda necessárias temporariamente)
// Precisaremos refatorar isso depois, mas por agora, vamos acessá-las diretamente (não ideal)
// Ou melhor, passar o que for necessário como parâmetro para setupEventListeners se possível.
// Por enquanto, vamos manter a referência a 'currentTaskLi' e 'currentSubtaskData' no app.js globalmente.