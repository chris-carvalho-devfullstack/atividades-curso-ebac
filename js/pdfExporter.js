// js/pdfExporter.js
import { getTasks } from './taskStore.js'; // Esta importação ainda é necessária

/**
 * Converte um objeto de tarefa em um PDF para download.
 * Esta função agora assume que as bibliotecas jsPDF e AutoTable
 * já foram carregadas globalmente (pelo index.html).
 * @param {object} task - O objeto da tarefa principal.
 */
export function exportTaskToPDF(task) {
    // A verificação de segurança ainda é uma boa prática
    if (typeof window.jspdf === 'undefined' || 
        typeof window.jspdf.jsPDF === 'undefined' || 
        typeof window.jspdf.jsPDF.autoTable === 'undefined') {
        
        console.error("Erro fatal: exportTaskToPDF chamada, mas window.jspdf.jsPDF.autoTable não está definido.");
        // O eventBinder.js deve ter pego isso primeiro, mas este é um fallback.
        alert('Erro: Bibliotecas de PDF não estão carregadas. Verifique os arquivos em /js/lib/ e limpe o cache.');
        return;
    }

    // O código de geração de PDF é o mesmo de antes
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // === 1. TÍTULO ===
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor('#333333');
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

        const tableData = [];
        const flattenSubtasks = (subtasks, level) => {
            if (!subtasks) return;
            
            subtasks.forEach(st => {
                const indent = "    ".repeat(level);
                let text = indent + st.text;
                const status = st.completed ? '✅' : '☐';
                const priority = st.priority ? (st.priority.charAt(0).toUpperCase() + st.priority.slice(1)) : 'Média';
                let dueDate = '';
                if (st.dueDate) {
                    dueDate = new Date(st.dueDate + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                    if (st.dueTime) dueDate += ` ${st.dueTime}`;
                }
                tableData.push([text, status, priority, dueDate]);
                
                if (st.subtasks && st.subtasks.length > 0) {
                    flattenSubtasks(st.subtasks, level + 1);
                }
            });
        };
        
        flattenSubtasks(task.subtasks, 0);

        doc.autoTable({
            startY: doc.autoTable.previous.finalY + 22,
            head: [['Tarefa', 'Status', 'Prioridade', 'Prazo']],
            body: tableData,
            theme: 'striped',
            headStyles: {
                fillColor: '#4CAF50',
                textColor: 255,
                fontStyle: 'bold',
            },
            styles: {
                fontSize: 10,
                cellPadding: 2,
            },
            columnStyles: {
                0: { cellWidth: 'auto' },
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

    // === 4. RODAPÉ ===
    const pageCount = doc.internal.getNumberOfPages();
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Exportado de: Gerenciador de Tarefas - Página ${i} de ${pageCount}`, 14, doc.internal.pageSize.height - 10);
    }

    // === 5. SALVAR ===
    const fileName = (task.text || 'tarefa').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`${fileName}.pdf`);
}