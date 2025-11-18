-- Criar a tabela de usuários se não existir
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Usuarios')
BEGIN
    CREATE TABLE Usuarios (
        id INT IDENTITY(1,1) PRIMARY KEY,
        username NVARCHAR(50) NOT NULL UNIQUE,
        password NVARCHAR(100) NOT NULL,
        nome NVARCHAR(100),
        email NVARCHAR(100),
        data_criacao DATETIME DEFAULT GETDATE()
    );
    
    -- Inserir alguns usuários de exemplo
    INSERT INTO Usuarios (username, password, nome, email)
    VALUES 
        ('admin', 'admin123', 'Administrador', 'admin@exemplo.com'),
        ('estudante', 'senha123', 'Estudante Teste', 'estudante@exemplo.com');
    
    PRINT 'Tabela Usuarios criada com sucesso!';
END
ELSE
BEGIN
    PRINT 'Tabela Usuarios já existe.';
END