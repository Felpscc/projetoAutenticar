const express = require('express');
const bodyParser = require('body-parser');
const sqlite = require('sqlite'); 
const sqlite3 = require('sqlite3'); 
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'database.sqlite'); // Caminho do arquivo do banco de dados SQLite


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


app.use(express.static(path.join(__dirname, 'public')));


app.use(session({
    secret: 'sua_chave_secreta_muito_forte_e_aleatoria',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000, httpOnly: true, secure: false } // <--- Confirme que 'secure' é 'false' para HTTP
}));

let db; // Variável para armazenar a instância do banco de dados

// Função para inicializar o banco de dados SQLite e criar a tabela
async function initializeDatabase() {
    try {
        console.log('Inicializando banco de dados SQLite...');
        db = await sqlite.open({
            filename: DB_PATH,
            driver: sqlite3.Database
        });
        console.log(`Banco de dados SQLite aberto em: ${DB_PATH}`);

        // Cria a tabela 'Usuarios' se ela não existir
        await db.exec(`
            CREATE TABLE IF NOT EXISTS Usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL
            )
        `);
        

        // **NOVA TABELA: Tarefas**
        await db.exec(`
            CREATE TABLE IF NOT EXISTS Tarefas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL,
                materia TEXT NOT NULL,
                descricao TEXT NOT NULL,
                dataLimite TEXT, -- Formato YYYY-MM-DD
                estrategia TEXT,
                status TEXT DEFAULT 'Pendente', -- Pendente, Em Andamento, Concluído
                FOREIGN KEY (userId) REFERENCES Usuarios(id) ON DELETE CASCADE
            )
        `);
        

         await db.exec(`
            CREATE TABLE IF NOT EXISTS Materiais (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL,
                titulo TEXT NOT NULL,
                descricao TEXT,
                link TEXT,
                materia TEXT,
                status TEXT DEFAULT 'Não Iniciado', -- Não Iniciado, Em Andamento, Concluído, Revisado
                FOREIGN KEY (userId) REFERENCES Usuarios(id) ON DELETE CASCADE
            )
        `);

        return true;
    } catch (error) {
        console.error('Erro na inicialização do banco de dados SQLite:', error.message);
        return false;
    }
}
// Middleware para verificar se o usuário está autenticado
function isAuthenticated(req, res, next) {
    console.log('Middleware isAuthenticated ativado.');
    console.log('Session completa no isAuthenticated:', req.session);
    console.log('Session userId no isAuthenticated:', req.session.userId);
    if (req.session.userId) {
        next();
    } else {
        res.status(401).send({ success: false, message: 'Não autorizado. Faça login.' });
    }
}

// Rota para página de login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para página de registro
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Rota para processar o registro de usuário
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send({ success: false, message: 'Usuário e senha são obrigatórios!' });
    }

    try {
        // Verifica se o nome de usuário já existe
        const existingUser = await db.get('SELECT * FROM Usuarios WHERE username = ?', username);

        if (existingUser) {
            return res.status(409).send({ success: false, message: 'Nome de usuário já existe!' });
        }

        // Hash da senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insere o novo usuário no banco de dados
        const result = await db.run('INSERT INTO Usuarios (username, password) VALUES (?, ?)', username, hashedPassword);

        res.status(201).send({ success: true, message: 'Usuário registrado com sucesso!', userId: result.lastID });

    } catch (err) {
        console.error('Erro ao registrar usuário:', err.message);
        res.status(500).send({ success: false, message: 'Erro interno do servidor ao registrar.' });
    }
});

// Rota para processar o login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Busca o usuário pelo username
        const user = await db.get('SELECT * FROM Usuarios WHERE username = ?', username);

        if (!user) {
            return res.status(401).send({ success: false, message: 'Usuário ou senha inválidos!' });
        }

        // Compara a senha enviada com a senha hash armazenada
        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
                req.session.userId = user.id;
                req.session.username = user.username;
                console.log('Login bem-sucedido. Session ID definido:', req.session.id); // ADICIONE ISSO
                console.log('Session userId:', req.session.userId); // ADICIONE ISSO
                console.log('Session username:', req.session.username); // ADICIONE ISSO
            res.status(200).send({
                success: true,
                message: 'Login realizado com sucesso!',
                user: {
                    id: user.id,
                    username: user.username
                }
            });
        } else {
            res.status(401).send({
                success: false,
                message: 'Usuário ou senha inválidos!'
            });
        }

    } catch (err) {
        console.error('Erro ao processar login:', err.message);
        res.status(500).send({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

app.get('/dashboard', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Rota de teste para ver as tarefas diretamente
app.get('/test-tarefas', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        console.log('TEST-TAREFAS: userId da sessão para busca:', userId);
        const tarefas = await db.all('SELECT * FROM Tarefas WHERE userId = ? ORDER BY dataLimite', userId);
        console.log('TEST-TAREFAS: Tarefas encontradas no DB:', tarefas);
        res.status(200).json({ success: true, tarefas });
    } catch (error) {
        console.error('TEST-TAREFAS: Erro ao obter tarefas:', error.message);
        res.status(500).json({ success: false, message: 'Erro ao obter tarefas.' });
    }
});
// **NOVAS ROTAS PARA TAREFAS**
// Obter todas as tarefas do usuário logado
app.get('/api/tarefas', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        console.log('GET /api/tarefas: userId da sessão para busca:', userId); // ADICIONE ESTA LINHA
        const tarefas = await db.all('SELECT * FROM Tarefas WHERE userId = ? ORDER BY dataLimite', userId);
        console.log('GET /api/tarefas: Tarefas encontradas no DB:', tarefas); // ADICIONE ESTA LINHA
        res.status(200).json({ success: true, tarefas });
    } catch (error) {
        console.error('Erro ao obter tarefas:', error.message);
        res.status(500).json({ success: false, message: 'Erro ao obter tarefas.' });
    }
});

// Adicionar uma nova tarefa
app.post('/api/tarefas', isAuthenticated, async (req, res) => {
    const { materia, descricao, dataLimite, estrategia, status } = req.body;
    const userId = req.session.userId;

     console.log('Tentando adicionar tarefa para userId:', userId); // ADICIONE ISSO
     console.log('Dados da tarefa:', { materia, descricao, dataLimite, estrategia, status }); // ADICIONE ISSO
    if (!materia || !descricao) {
        return res.status(400).json({ success: false, message: 'Matéria e Descrição são obrigatórios.' });
    }

    try {
        const result = await db.run(
            'INSERT INTO Tarefas (userId, materia, descricao, dataLimite, estrategia, status) VALUES (?, ?, ?, ?, ?, ?)',
            userId, materia, descricao, dataLimite || null, estrategia || null, status || 'Pendente'
        );
        const novaTarefa = {
            id: result.lastID,
            userId, materia, descricao, dataLimite, estrategia, status: status || 'Pendente'
        };
        res.status(201).json({ success: true, message: 'Tarefa adicionada com sucesso!', tarefa: novaTarefa });
    } catch (error) {
        console.error('Erro ao adicionar tarefa:', error.message);
        res.status(500).json({ success: false, message: 'Erro ao adicionar tarefa.' });
    }
});

// Atualizar uma tarefa existente
app.put('/api/tarefas/:id', isAuthenticated, async (req, res) => {
    const tarefaId = req.params.id;
    const { materia, descricao, dataLimite, estrategia, status } = req.body;
    const userId = req.session.userId;

    try {
        // Garante que o usuário só pode atualizar suas próprias tarefas
        const existingTarefa = await db.get('SELECT userId FROM Tarefas WHERE id = ?', tarefaId);
        if (!existingTarefa || existingTarefa.userId !== userId) {
            return res.status(403).json({ success: false, message: 'Não autorizado para atualizar esta tarefa.' });
        }

        await db.run(
            'UPDATE Tarefas SET materia = ?, descricao = ?, dataLimite = ?, estrategia = ?, status = ? WHERE id = ?',
            materia, descricao, dataLimite, estrategia, status, tarefaId
        );
        res.status(200).json({ success: true, message: 'Tarefa atualizada com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar tarefa:', error.message);
        res.status(500).json({ success: false, message: 'Erro ao atualizar tarefa.' });
    }
});

// Excluir uma tarefa
app.delete('/api/tarefas/:id', isAuthenticated, async (req, res) => {
    const tarefaId = req.params.id;
    const userId = req.session.userId;

    try {
        // Garante que o usuário só pode excluir suas próprias tarefas
        const existingTarefa = await db.get('SELECT userId FROM Tarefas WHERE id = ?', tarefaId);
        if (!existingTarefa || existingTarefa.userId !== userId) {
            return res.status(403).json({ success: false, message: 'Não autorizado para excluir esta tarefa.' });
        }

        await db.run('DELETE FROM Tarefas WHERE id = ?', tarefaId);
        res.status(200).json({ success: true, message: 'Tarefa excluída com sucesso!' });
    } catch (error) {
        console.error('Erro ao excluir tarefa:', error.message);
        res.status(500).json({ success: false, message: 'Erro ao excluir tarefa.' });
    }
});

app.get('/api/materiais', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const materiais = await db.all('SELECT * FROM Materiais WHERE userId = ? ORDER BY titulo', userId);
        res.status(200).json({ success: true, materiais });
    } catch (error) {
        console.error('Erro ao obter materiais:', error.message);
        res.status(500).json({ success: false, message: 'Erro ao obter materiais.' });
    }
});

// Adicionar um novo material
app.post('/api/materiais', isAuthenticated, async (req, res) => {
    const { titulo, descricao, link, materia, status } = req.body;
    const userId = req.session.userId;

    if (!titulo) {
        return res.status(400).json({ success: false, message: 'Título do material é obrigatório.' });
    }

    try {
        const result = await db.run(
            'INSERT INTO Materiais (userId, titulo, descricao, link, materia, status) VALUES (?, ?, ?, ?, ?, ?)',
            userId, titulo, descricao || null, link || null, materia || null, status || 'Não Iniciado'
        );
        const novoMaterial = {
            id: result.lastID,
            userId, titulo, descricao, link, materia, status: status || 'Não Iniciado'
        };
        res.status(201).json({ success: true, message: 'Material adicionado com sucesso!', material: novoMaterial });
    } catch (error) {
        console.error('Erro ao adicionar material:', error.message);
        res.status(500).json({ success: false, message: 'Erro ao adicionar material.' });
    }
});

// Atualizar um material existente
app.put('/api/materiais/:id', isAuthenticated, async (req, res) => {
    const materialId = req.params.id;
    const { titulo, descricao, link, materia, status } = req.body;
    const userId = req.session.userId;

    if (!titulo) {
        return res.status(400).json({ success: false, message: 'Título do material é obrigatório.' });
    }

    try {
        const existingMaterial = await db.get('SELECT userId FROM Materiais WHERE id = ?', materialId);
        if (!existingMaterial || existingMaterial.userId !== userId) {
            return res.status(403).json({ success: false, message: 'Não autorizado para atualizar este material.' });
        }

        await db.run(
            'UPDATE Materiais SET titulo = ?, descricao = ?, link = ?, materia = ?, status = ? WHERE id = ?',
            titulo, descricao, link, materia, status, materialId
        );
        res.status(200).json({ success: true, message: 'Material atualizado com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar material:', error.message);
        res.status(500).json({ success: false, message: 'Erro ao atualizar material.' });
    }
});

// Excluir um material
app.delete('/api/materiais/:id', isAuthenticated, async (req, res) => {
    const materialId = req.params.id;
    const userId = req.session.userId;

    try {
        const existingMaterial = await db.get('SELECT userId FROM Materiais WHERE id = ?', materialId);
        if (!existingMaterial || existingMaterial.userId !== userId) {
            return res.status(403).json({ success: false, message: 'Não autorizado para excluir este material.' });
        }

        await db.run('DELETE FROM Materiais WHERE id = ?', materialId);
        res.status(200).json({ success: true, message: 'Material excluído com sucesso!' });
    } catch (error) {
        console.error('Erro ao excluir material:', error.message);
        res.status(500).json({ success: false, message: 'Erro ao excluir material.' });
    }
});

app.get('/api/user-info', isAuthenticated, (req, res) => { // AQUI! isAuthenticated AINDA está aqui!
    console.log('API user-info acessada. Session userId:', req.session.userId);
    if (req.session.username && req.session.userId) {
        res.status(200).json({
            success: true,
            username: req.session.username,
            userId: req.session.userId
        });
    } else {
        res.status(401).json({ success: false, message: 'Usuário não autenticado na API.' });
    }
});

// Rota de logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send({ success: false, message: 'Erro ao fazer logout.' });
        }
        res.redirect('/'); // Redireciona para a página de login
    });
});

// Iniciar o servidor SOMENTE APÓS a inicialização do banco de dados
initializeDatabase().then(success => {
    if (success) {
        app.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
            console.log(`Acesse: http://localhost:${PORT}`);
        });
    } else {
        console.error('O servidor não pôde ser iniciado devido a falha na inicialização do banco de dados.');
    }
}).catch(err => {
    console.error('Erro fatal durante a inicialização:', err);
});