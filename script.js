const campoTarefa = document.getElementById("campo-tarefa");
const botaoAdicionar = document.getElementById("botao-adicionar");
const listaTarefas = document.getElementById("lista-tarefas");


function pegarTarefasSalvas() { // Pega as tarefas salvas no localStorage
    const dadosSalvos = localStorage.getItem("tarefas");

    if (dadosSalvos === null) { // Verifica se há tarefas salvas
        return []; // Retorna um array vazio
    } else {
        return JSON.parse(dadosSalvos); // Converte o JSON em objeto
    }
}





function salvarTarefas(tarefas) { // Salva as tarefas no localStorage
    localStorage.setItem("tarefas", JSON.stringify(tarefas));
}







function criarTarefaNaTela(texto) { // Cria um elemento HTML do tipo <li>
    const novoItem = document.createElement("li");  // Cria um elemento HTML do tipo <li>
    novoItem.textContent = texto; // Adiciona o texto digitado no item

    novoItem.addEventListener("click", function () { // Adiciona um evento de clique ao item
        novoItem.remove(); // Remove o item

        const tarefasAtuais = pegarTarefasSalvas(); // Pega as tarefas salvas no localStorage
        const tarefaSemEssa = tarefasAtuais.filter(function (tarefa) { // Filtra as tarefas
            return tarefa !== texto; // Retorna as tarefas que não são iguais ao texto digitado
        });
        salvarTarefas(tarefaSemEssa); // Salva as tarefas
    });

    listaTarefas.appendChild(novoItem); // Adiciona o novo item na lista
}





botaoAdicionar.addEventListener("click", function () { // Adiciona um evento de clique ao botao
    const textoDigitado = campoTarefa.value; // Pega o valor digitado no campo

    if (textoDigitado === "") { // Impede que tarefas vazias sejam adicionadas
        alert("Digite uma tarefa!");
        return;
    }

    criarTarefaNaTela(textoDigitado); // Adiciona a tarefa na tela

    const tarefasAtuais = pegarTarefasSalvas();
    tarefasAtuais.push(textoDigitado);
    salvarTarefas(tarefasAtuais);

    campoTarefa.value = ""; // Limpa o campo de texto
});








campoTarefa.addEventListener("keydown", function (evento) { // Adiciona um evento de clique ao botao
    if (evento.key === "Enter") { // Adiciona um evento de clique ao botao
        botaoAdicionar.click(); // Simula um clique no botao
    }
});







const tarefasSalvas = pegarTarefasSalvas(); // Pega as tarefas salvas no localStorage
tarefasSalvas.forEach(function (texto) { // Cria um elemento HTML do tipo <li>
    criarTarefaNaTela(texto);
});