// Elementos do DOM
const campoTarefa = document.getElementById("campo-tarefa");
const botaoAdicionar = document.getElementById("botao-adicionar");
const listaTarefas = document.getElementById("lista-tarefas");
const emptyState = document.getElementById("empty-state");
const taskCounter = document.getElementById("task-counter");
const progressBar = document.getElementById("progressBar");
const progressCircle = document.getElementById("progressCircle");
const progressPercent = document.getElementById("progressPercent");

// Controles e Sliders
const sliderVolume = document.getElementById("slider-volume");
const volumeFill = document.getElementById("volumeFill");
const volumeDisplay = document.getElementById("volumeDisplay");
const toggleSound = document.getElementById("toggle-sound");
const switchStateText = document.getElementById("switchStateText");
const cardWrapper = document.getElementById("cardWrapper");
const mainGlassPlate = document.getElementById("mainGlassPlate");

// Botões de Ação
const btnClearDone = document.getElementById("btn-clear-done");
const btnRandomFocus = document.getElementById("btn-random-focus");
const btnQuickAdd = document.getElementById("btn-quick-add");
const btnSoundPlay = document.getElementById("btn-sound-play");

// Pílulas e Tags
const filterPills = document.querySelectorAll(".tactile-pill");
const categoryTags = document.querySelectorAll(".category-tag");

// Estado da Aplicação
let currentFilter = "active"; // 'all' | 'active' | 'completed'
let selectedCategory = "Lembrar";
let isAudioEnabled = true;
let audioVolume = 0.75;

/* ==========================================================================
   WEB AUDIO API: SINTETIZADOR DE CLIQUE HÁPTICO E TÁTIL
   ========================================================================== */
class TactileAudioEngine {
    constructor() {
        this.ctx = null;
    }

    // Inicializa o contexto de áudio sob demanda após interação do usuário
    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    // Som de clique mecânico/cerâmico rápido
    playClick(pitch = 1.0) {
        if (!isAudioEnabled) return;
        try {
            this.init();
            if (!this.ctx) return;

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = "triangle";
            const now = this.ctx.currentTime;
            const startFreq = 420 * pitch;

            osc.frequency.setValueAtTime(startFreq, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.045);

            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.18 * audioVolume, now + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.05);
        } catch (e) {
            // Em caso de restrição do navegador, ignora suavemente sem interromper a execução
        }
    }

    // Som suave de conclusão ou sucesso (arpeggio em acorde maior)
    playSuccess() {
        if (!isAudioEnabled) return;
        try {
            this.init();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            [523.25, 659.25, 783.99].forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, now + idx * 0.05);

                gain.gain.setValueAtTime(0.001, now + idx * 0.05);
                gain.gain.linearRampToValueAtTime(0.12 * audioVolume, now + idx * 0.05 + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 0.14);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(now + idx * 0.05);
                osc.stop(now + idx * 0.05 + 0.15);
            });
        } catch (e) {}
    }
}

const audioEngine = new TactileAudioEngine();

/* ==========================================================================
   ARMAZENAMENTO SEGURO DE TAREFAS (localStorage com tratamento de exceções)
   ========================================================================== */

// Recupera as tarefas do localStorage garantindo normalização e integridade
function getStoredTasks() {
    try {
        const raw = localStorage.getItem("neo_tactile_tasks") || localStorage.getItem("tarefas");
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        const validCategories = ["Lembrar", "Importante", "Urgente", "Foco", "Geral", "Dev", "Design"];

        return parsed.map((item, index) => {
            // Suporte retrocompatível se o item for apenas uma string
            if (typeof item === "string") {
                return {
                    id: `legacy-${Date.now()}-${index}`,
                    text: item.slice(0, 120),
                    completed: false,
                    category: "Lembrar",
                    createdAt: Date.now()
                };
            }
            return {
                id: String(item.id || `task-${Date.now()}-${index}`),
                text: String(item.text || "").slice(0, 120),
                completed: Boolean(item.completed),
                category: validCategories.includes(item.category) ? item.category : "Lembrar",
                createdAt: Number(item.createdAt) || Date.now()
            };
        });
    } catch (e) {
        console.warn("Erro ao ler armazenamento local:", e);
        return [];
    }
}

// Persiste tarefas no localStorage e atualiza os indicadores
function saveTasks(tasks) {
    try {
        localStorage.setItem("neo_tactile_tasks", JSON.stringify(tasks));
        localStorage.setItem("tarefas", JSON.stringify(tasks.map(t => t.text)));
    } catch (e) {
        console.error("Limite de quota ou restrição no armazenamento local:", e);
    }
    updateProgressAndMetrics(tasks);
}

/* ==========================================================================
   MÉTRICAS E ANEL CIRCULAR DE PROGRESSO
   ========================================================================== */

// Atualiza o anel neon SVG, contadores e o estado vazio da interface
function updateProgressAndMetrics(tasks = getStoredTasks()) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    // Atualiza o texto do contador de tarefas
    taskCounter.textContent = `${total} ${total === 1 ? "tarefa" : "tarefas"}`;

    // Cálculo da circunferência SVG: 2 * PI * raio (r = 18)
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;

    const offset = circumference - (percentage / 100) * circumference;
    progressCircle.style.strokeDashoffset = offset;
    progressPercent.textContent = `${percentage}%`;

    // Atualiza o atributo ARIA para acessibilidade
    if (progressBar) {
        progressBar.setAttribute("aria-valuenow", String(percentage));
    }

    // Exibe ou esconde o estado vazio
    const visibleTasks = getFilteredTasks(tasks);
    if (visibleTasks.length === 0) {
        emptyState.classList.add("visible");
    } else {
        emptyState.classList.remove("visible");
    }
}

// Filtra as tarefas de acordo com a aba selecionada (Todas, Ativas ou Feitas)
function getFilteredTasks(tasks = getStoredTasks()) {
    if (currentFilter === "active") {
        return tasks.filter(t => !t.completed);
    }
    if (currentFilter === "completed") {
        return tasks.filter(t => t.completed);
    }
    return tasks;
}

/* ==========================================================================
   RENDERIZAÇÃO SEGURA NO DOM (Puro createElement e textContent - Zero XSS)
   ========================================================================== */

function renderTaskList() {
    // Limpa a lista existente de forma segura
    while (listaTarefas.firstChild) {
        listaTarefas.removeChild(listaTarefas.firstChild);
    }

    const allTasks = getStoredTasks();
    const tasksToShow = getFilteredTasks(allTasks);

    tasksToShow.forEach(task => {
        const item = document.createElement("li");
        item.className = `task-item ${task.completed ? "completed" : ""}`;
        item.dataset.id = task.id;
        item.setAttribute("role", "listitem");
        item.setAttribute("tabindex", "0");
        item.setAttribute("aria-label", `Tarefa: ${task.text}. Status: ${task.completed ? 'concluída' : 'pendente'}`);

        // Grupo da esquerda (Checkbox, texto e categoria)
        const leftGroup = document.createElement("div");
        leftGroup.className = "task-left-group";

        // Botão de anel do checkbox
        const checkbox = document.createElement("button");
        checkbox.type = "button";
        checkbox.className = "task-checkbox-ring";
        checkbox.setAttribute("aria-label", task.completed ? "Marcar como pendente" : "Marcar como concluída");
        checkbox.setAttribute("aria-checked", task.completed ? "true" : "false");

        // Ícone SVG de marcação construído de forma segura no namespace SVG
        const svgNS = "http://www.w3.org/2000/svg";
        const checkSvg = document.createElementNS(svgNS, "svg");
        checkSvg.setAttribute("class", "task-check-icon");
        checkSvg.setAttribute("width", "12");
        checkSvg.setAttribute("height", "12");
        checkSvg.setAttribute("viewBox", "0 0 24 24");
        checkSvg.setAttribute("fill", "none");
        checkSvg.setAttribute("stroke", "currentColor");
        checkSvg.setAttribute("stroke-width", "3");
        checkSvg.setAttribute("stroke-linecap", "round");
        checkSvg.setAttribute("stroke-linejoin", "round");
        checkSvg.setAttribute("aria-hidden", "true");

        const polyline = document.createElementNS(svgNS, "polyline");
        polyline.setAttribute("points", "20 6 9 17 4 12");
        checkSvg.appendChild(polyline);
        checkbox.appendChild(checkSvg);

        // Texto da tarefa (textContent protege contra injeção de HTML/XSS)
        const textSpan = document.createElement("span");
        textSpan.className = "task-text";
        textSpan.textContent = task.text;

        // Tag da categoria
        const badgeSpan = document.createElement("span");
        badgeSpan.className = "task-badge";
        badgeSpan.textContent = task.category || "Lembrar";

        leftGroup.appendChild(checkbox);
        leftGroup.appendChild(textSpan);
        leftGroup.appendChild(badgeSpan);

        // Grupo da direita (Botão de excluir)
        const actionsGroup = document.createElement("div");
        actionsGroup.className = "task-actions";

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "task-delete-btn";
        deleteBtn.setAttribute("title", "Excluir tarefa");
        deleteBtn.setAttribute("aria-label", `Excluir tarefa ${task.text}`);

        const deleteSvg = document.createElementNS(svgNS, "svg");
        deleteSvg.setAttribute("width", "14");
        deleteSvg.setAttribute("height", "14");
        deleteSvg.setAttribute("viewBox", "0 0 24 24");
        deleteSvg.setAttribute("fill", "none");
        deleteSvg.setAttribute("stroke", "currentColor");
        deleteSvg.setAttribute("stroke-width", "2.5");
        deleteSvg.setAttribute("stroke-linecap", "round");
        deleteSvg.setAttribute("stroke-linejoin", "round");
        deleteSvg.setAttribute("aria-hidden", "true");

        const line1 = document.createElementNS(svgNS, "line");
        line1.setAttribute("x1", "18");
        line1.setAttribute("y1", "6");
        line1.setAttribute("x2", "6");
        line1.setAttribute("y2", "18");

        const line2 = document.createElementNS(svgNS, "line");
        line2.setAttribute("x1", "6");
        line2.setAttribute("y1", "6");
        line2.setAttribute("x2", "18");
        line2.setAttribute("y2", "18");

        deleteSvg.appendChild(line1);
        deleteSvg.appendChild(line2);
        deleteBtn.appendChild(deleteSvg);

        actionsGroup.appendChild(deleteBtn);

        item.appendChild(leftGroup);
        item.appendChild(actionsGroup);

        // Evento de clique para alternar o status
        item.addEventListener("click", (e) => {
            if (e.target.closest(".task-delete-btn")) return;
            toggleTaskCompletion(task.id);
        });

        // Acessibilidade via teclado: Tecla Espaço ou Enter alterna a conclusão
        item.addEventListener("keydown", (e) => {
            if (e.target === item && (e.key === " " || e.key === "Enter")) {
                e.preventDefault();
                toggleTaskCompletion(task.id);
            }
        });

        // Evento de clique para excluir a tarefa
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteTask(task.id);
        });

        listaTarefas.appendChild(item);
    });

    updateProgressAndMetrics(allTasks);
}

/* ==========================================================================
   OPERAÇÕES CRUD DE TAREFAS
   ========================================================================== */

// Adiciona uma nova tarefa à lista
function addNewTask(text) {
    const cleanText = text.trim();
    if (!cleanText) {
        audioEngine.playClick(0.6);
        campoTarefa.focus();
        return;
    }

    const tasks = getStoredTasks();
    const newTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        text: cleanText.slice(0, 120),
        completed: false,
        category: selectedCategory,
        createdAt: Date.now()
    };

    tasks.unshift(newTask);
    saveTasks(tasks);
    renderTaskList();
    campoTarefa.value = "";
    audioEngine.playClick(1.3);
}

// Alterna o status entre pendente e concluída
function toggleTaskCompletion(taskId) {
    const tasks = getStoredTasks();
    const target = tasks.find(t => t.id === taskId);
    if (!target) return;

    target.completed = !target.completed;
    saveTasks(tasks);
    renderTaskList();

    if (target.completed) {
        audioEngine.playSuccess();
    } else {
        audioEngine.playClick(0.9);
    }
}

// Exclui uma tarefa específica pelo ID
function deleteTask(taskId) {
    const tasks = getStoredTasks();
    const updated = tasks.filter(t => t.id !== taskId);
    saveTasks(updated);
    renderTaskList();
    audioEngine.playClick(0.75);
}

// Remove todas as tarefas concluídas da lista
function clearCompletedTasks() {
    const tasks = getStoredTasks();
    const uncompleted = tasks.filter(t => !t.completed);
    if (uncompleted.length === tasks.length) {
        audioEngine.playClick(0.6);
        return;
    }
    saveTasks(uncompleted);
    renderTaskList();
    audioEngine.playSuccess();
}

/* ==========================================================================
   LISTENERS DE EVENTOS E CONTROLES
   ========================================================================== */

// Inserir tarefa ao clicar no botão ou pressionar Enter
botaoAdicionar.addEventListener("click", () => {
    addNewTask(campoTarefa.value);
});

campoTarefa.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        addNewTask(campoTarefa.value);
    }
});

// Filtro pelas pílulas táteis (Todas, Ativas e Feitas)
filterPills.forEach(pill => {
    pill.addEventListener("click", () => {
        filterPills.forEach(p => {
            p.classList.remove("active");
            p.setAttribute("aria-pressed", "false");
        });
        pill.classList.add("active");
        pill.setAttribute("aria-pressed", "true");
        currentFilter = pill.dataset.filter;
        audioEngine.playClick(1.15);
        renderTaskList();
    });
});

// Seleção de tags de categoria (Lembrar, Importante, Urgente, Foco)
categoryTags.forEach(tag => {
    tag.addEventListener("click", () => {
        categoryTags.forEach(t => {
            t.classList.remove("active");
            t.setAttribute("aria-pressed", "false");
        });
        tag.classList.add("active");
        tag.setAttribute("aria-pressed", "true");
        selectedCategory = tag.dataset.tag;
        audioEngine.playClick(1.05);
    });
});

// Ações da barra escura de controles (com verificação defensiva de existência)
if (btnClearDone) {
    btnClearDone.addEventListener("click", clearCompletedTasks);
}

if (btnQuickAdd) {
    btnQuickAdd.addEventListener("click", () => {
        if (campoTarefa) campoTarefa.focus();
        audioEngine.playClick(1.1);
    });
}

if (btnRandomFocus) {
    btnRandomFocus.addEventListener("click", () => {
        const activeTasks = getStoredTasks().filter(t => !t.completed);
        if (activeTasks.length === 0) {
            audioEngine.playClick(0.6);
            return;
        }
        const chosen = activeTasks[Math.floor(Math.random() * activeTasks.length)];
        audioEngine.playSuccess();
        alert(`🎯 Tarefa em foco agora:\n"${chosen.text}"`);
    });
}

if (btnSoundPlay) {
    btnSoundPlay.addEventListener("click", () => {
        audioEngine.playClick(1.4);
    });
}

// Interruptor 3D para ligar/desligar o áudio háptico
if (toggleSound) {
    toggleSound.addEventListener("change", (e) => {
        isAudioEnabled = e.target.checked;
        if (switchStateText) switchStateText.textContent = isAudioEnabled ? "On" : "Off";
        toggleSound.setAttribute("aria-checked", isAudioEnabled ? "true" : "false");
        if (isAudioEnabled) {
            audioEngine.playClick(1.2);
        }
    });
}

// Sincronização do controle deslizante de volume
function syncVolumeControls() {
    if (sliderVolume && volumeFill && volumeDisplay) {
        const val = sliderVolume.value;
        audioVolume = val / 100;
        volumeFill.style.width = `${val}%`;
        volumeDisplay.textContent = `${val}%`;
    }
}

if (sliderVolume) {
    sliderVolume.addEventListener("input", (e) => {
        syncVolumeControls();
    });

    sliderVolume.addEventListener("change", () => {
        audioEngine.playClick(0.9 + audioVolume * 0.5);
    });

    // Sincroniza imediatamente o estado visual com o valor atual do input
    syncVolumeControls();
}

/* ==========================================================================
   EFEITO DE PARALLAX E INCLINAÇÃO 3D NO MOUSE
   ========================================================================== */

if (cardWrapper && mainGlassPlate) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Aplica o efeito 3D apenas se o usuário não tiver preferência de movimento reduzido
    if (!prefersReducedMotion) {
        const handleTilt = (e) => {
            const rect = cardWrapper.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -6;
            const rotateY = ((x - centerX) / centerX) * 6;

            mainGlassPlate.style.transform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
        };

        const resetTilt = () => {
            mainGlassPlate.style.transform = `rotateX(0deg) rotateY(0deg)`;
        };

        cardWrapper.addEventListener("mousemove", handleTilt);
        cardWrapper.addEventListener("mouseleave", resetTilt);
    }
}

// Inicialização da aplicação ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
    renderTaskList();
    syncVolumeControls();

// Inicia o tutorial com um pequeno delay de 500ms para a tela carregar suavemente
    setTimeout(iniciarTutorial, 500);
});



// TUTORIAL GUIADO (ONBOARDING)

const passosTutorial = [
    {
        elementoId: "btn-random-focus", // O botão com 🤔
        titulo: "Modo Foco Aleatório",
        descricao: "Não sabe por onde começar? Clique nesse icone 🤔 e o sistema sorteará uma tarefa pendente para você focar agora!",
        textoBotao: "Próxima Dica ➔"
    },
    
    {
        elementoId: "btn-clear-done", // O botão com ✕
        titulo: "Limpar Concluídas",
        descricao: "Terminou o dia? Use este botão '✕' para remover rapidamente todas as tarefas que você já concluiu.",
        textoBotao: "Próxima Dica ➔"
    },

    {
        elementoId: "btn-menu", // O botão com ⇶
        titulo: "Alternar Foco",
        descricao: "Deseja alternar o modo foco para outra tarefa? Use este botão '⇶' para fazer isso.",
        textoBotao: "Vamos começar! 🚀"
    }
];


let indicePassoAtual = 0;
function iniciarTutorial() {
    // Removida a trava para exibir sempre ao carregar a página
    const overlay = document.getElementById("tutorial");
    if (!overlay) return;

    overlay.style.display = "flex";
    indicePassoAtual = 0;
    mostrarPasso(indicePassoAtual);


    // Configura botões de avançar e pular
    document.getElementById("tutorial-next").onclick = () => {
        indicePassoAtual++;
        if (indicePassoAtual < passosTutorial.length) {
            mostrarPasso(indicePassoAtual);
        } else {
            fecharTutorial();
        }
    };
    document.getElementById("tutorial-close").onclick = fecharTutorial;
}




function mostrarPasso(indice) {
    const passo = passosTutorial[indice];
    // Atualiza os textos do pop-up
    document.getElementById("tutorial-step").textContent = `Dica ${indice + 1} de ${passosTutorial.length}`;
    document.getElementById("tutorial-title").textContent = passo.titulo;
    document.getElementById("tutorial-description").textContent = passo.descricao;
    document.getElementById("tutorial-next").textContent = passo.textoBotao;
    // Remove destaque anterior de outros botões
    document.querySelectorAll(".tutorial-highlight").forEach(el => el.classList.remove("tutorial-highlight"));
    // Adiciona o brilho/destaque pulsante ao botão em foco
    const elementoAlvo = document.getElementById(passo.elementoId);
    if (elementoAlvo) {
        elementoAlvo.classList.add("tutorial-highlight");
    }
}




function fecharTutorial() {
    const overlay = document.getElementById("tutorial");
    if (overlay) overlay.style.display = "none";
    // Remove qualquer destaque restante
    document.querySelectorAll(".tutorial-highlight").forEach(el => el.classList.remove("tutorial-highlight"));
}