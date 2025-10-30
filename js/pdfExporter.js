// js/pdfExporter.js
import { getTasks } from './taskStore.js';

// --- NOVO: LÓGICA DE CARREGAMENTO DINÂMICO ---

// URLs para as bibliotecas
const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const AUTOTABLE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';

// Flags para garantir que o download ocorra apenas uma vez
let isJsPdfLoading = false;
let isJsPdfLoaded = false;
let isAutoTableLoading = false;
let isAutoTableLoaded = false;

/**
 * Carrega um script dinamicamente no <head> e retorna uma Promise.
 * @param {string} url - A URL do script a ser carregado.
 * @param {string} id - Um ID para a tag script (evita duplicação).
 * @returns {Promise<void>}
 */
function loadScript(url, id) {
    return new Promise((resolve, reject) => {
        // Verifica se o script já não foi injetado
        if (document.getElementById(id)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = url;
        script.id = id;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Falha ao carregar o script: ${url}`));
        document.head.appendChild(script);
    });
}

/**
 * Carrega jsPDF e jsPDF-AutoTable em sequência, sob demanda.
 * Só fará o download uma vez por sessão da página.
 * @returns {Promise<boolean>} - Resolve true se tudo estiver pronto.
 */
export async function loadPdfLibraries() {
    // 1. Verifica se a biblioteca principal (jsPDF) já está carregada
    if (!isJsPdfLoaded && !isJsPdfLoading) {
        isJsPdfLoading = true;
        try {
            console.log('Carregando jsPDF...');
            await loadScript(JSPDF_URL, 'jspdf-lib');
            isJsPdfLoaded = true;
            isJsPdfLoading = false;
            console.log('jsPDF carregado.');
        } catch (error) {
            isJsPdfLoading = false;
            console.error(error);
            return false; // Falha ao carregar
        }
    } else if (isJsPdfLoading) {
        // Se outro clique já disparou o loading, apenas espera
        await new Promise(resolve => setTimeout(resolve, 300));
        return loadPdfLibraries(); // Tenta novamente
    }

    // 2. Verifica se a biblioteca secundária (AutoTable) já está carregada
    // (Só executa se a principal já estiver carregada)
    if (isJsPdfLoaded && !isAutoTableLoaded && !isAutoTableLoading) {
        isAutoTableLoading = true;
        try {
            console.log('Carregando jsPDF-AutoTable...');
            await loadScript(AUTOTABLE_URL, 'jspdf-autotable-lib');
            isAutoTableLoaded = true;
            isAutoTableLoading = false;
            console.log('jsPDF-AutoTable carregado.');
        } catch (error) {
            isAutoTableLoading = false;
            console.error(error);
            return false; // Falha ao carregar
        }
    } else if (isAutoTableLoading) {
        // Se outro clique já disparou o loading, apenas espera
        await new Promise(resolve => setTimeout(resolve, 300));
        return loadPdfLibraries(); // Tenta novamente
    }

    // 3. Verificação final
    // Às vezes o script carrega mas demora um microssegundo para se anexar ao `window.jspdf`
    if (isJsPdfLoaded && isAutoTableLoaded) {
        if (typeof window.jspdf?.jsPDF?.autoTable === 'undefined') {
            console.warn('Bibliotecas carregadas, mas autoTable não está pronto. Aguardando 200ms...');
            await new Promise(resolve => setTimeout(resolve, 200));
            return (typeof window.jspdf?.jsPDF?.autoTable !== 'undefined');
        }
        return true; // Sucesso!
    }
    
    // Se algo deu errado
    return false;
}

// --- FIM DA NOVA LÓGICA DE CARREGAMENTO ---


/**
 * Converte um objeto de tarefa em um PDF para download.
 * (Esta é a sua função original, sem modificações)
 * @param {object} task - O objeto da tarefa principal.
 */
export function exportTaskToPDF(task) {
    // Esta verificação agora é apenas um fallback final.
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined' || typeof window.jspdf.jsPDF.autoTable === 'undefined') {
        alert('Erro: Bibliotecas de PDF (jsPDF ou jsPDF-AutoTable) não foram carregadas. Recarregue a página.');
        console.error("jsPDF ou jsPDF-AutoTable não encontrados no window.jspdf");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // === 1. TÍTULO ===
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor('#333333');
    // Trata quebras de linha no título
    const titleLines = doc.splitTextToSize(task.text || 'Tarefa sem Título', 180);
    doc.text(titleLines, 14, 22);

    // === 2. TABELA DE METADADOS ===
    const metaData = [
        ['Prioridade', task.priority ? (task.priority.charAt(0).toUpperCase() + task.priority.slice(1)) : 'Média'],
        ['Categoria', task.category ? (task.category.charAt(0).toUpperCase() + task.category.slice(1)) : 'Geral'],
        ['Status', task.completed ? 'Concluída' : 'Pendente'],
    ];
    
    if (task.dueDate) {
        let dateStr = new Date(task.dueDate + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        if (task.dueTime) {
            dateStr += ` às ${task.dueTime}`;
        }
        metaData.push(['Prazo', dateStr]);
    }

    doc.autoTable({
        startY: doc.previousAutoTable ? doc.previousAutoTable.finalY + 10 : 35,
        body: metaData,
        theme: 'plain',
        styles: {
            fontSize: 11,
            cellPadding: { top: 1, right: 2, bottom: 1, left: 0 },
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 30 },
            1: { cellWidth: 'auto' },
        },
        margin: { left: 14 },
    });

    // === 3. SEÇÃO DE SUBTAREFAS ===
    if (task.subtasks && task.subtasks.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Subtarefas', 14, doc.autoTable.previous.finalY + 15);

        // Prepara os dados da tabela de subtarefas
        const tableData = [];
        // Função recursiva para achatar a árvore de subtarefas
        const flattenSubtasks = (subtasks, level) => {
            if (!subtasks) return;
            
            subtasks.forEach(st => {
                // Adiciona indentação baseada no nível
                const indent = "    ".repeat(level);
                let text = indent + st.text;
                
                // Formata o status
                const status = st.completed ? '✅' : '☐';
                
                // Formata prioridade (opcional)
                const priority = st.priority ? (st.priority.charAt(0).toUpperCase() + st.priority.slice(1)) : 'Média';
                
                // Formata prazo (opcional)
                let dueDate = '';
                if (st.dueDate) {
                    dueDate = new Date(st.dueDate + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                    if (st.dueTime) dueDate += ` ${st.dueTime}`;
                }

                tableData.push([text, status, priority, dueDate]);
                
                // Processa filhos
                if (st.subtasks && st.subtasks.length > 0) {
                    flattenSubtasks(st.subtasks, level + 1);
                }
            });
        };
        
        // Inicia o achatamento
        flattenSubtasks(task.subtasks, 0);

        doc.autoTable({
            startY: doc.autoTable.previous.finalY + 22,
            head: [['Tarefa', 'Status', 'Prioridade', 'Prazo']],
            body: tableData,
            theme: 'striped', // Tema 'striped' ou 'grid'
            headStyles: {
                fillColor: '#4CAF50', // Cor principal (do tema)
                textColor: 255,
                fontStyle: 'bold',
            },
            styles: {
                fontSize: 10,
                cellPadding: 2,
            },
            columnStyles: {
                0: { cellWidth: 'auto' }, // Coluna da tarefa se expande
                1: { cellWidth: 20, halign: 'center' },
                2: { cellWidth: 25 },
                3: { cellWidth: 30 },
            },
            margin: { left: 14, right: 14 },
        });
    } else {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Esta tarefa não possui subtarefas.', 14, doc.autoTable.previous.finalY + 15);
    }

    // === 4. RODAPÉ (Opcional) ===
    const pageCount = doc.internal.getNumberOfPages();
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Exportado de: Gerenciador de Tarefas - Página ${i} de ${pageCount}`, 14, doc.internal.pageSize.height - 10);
    }

    // === 5. SALVAR ===
    // Limpa o nome do arquivo para evitar caracteres inválidos
    const fileName = (task.text || 'tarefa').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`${fileName}.pdf`);
}