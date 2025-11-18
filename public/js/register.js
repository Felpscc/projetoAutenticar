document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const mensagem = document.getElementById('mensagem');

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            mensagem.style.color = '#00FFFF';
            mensagem.textContent = data.message + ' Redirecionando para login...';
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            mensagem.style.color = '#FF6347';
            mensagem.textContent = data.message;
        }
    } catch (error) {
        mensagem.style.color = '#FF6347';
        mensagem.textContent = 'Erro ao conectar ao servidor';
        console.error('Erro:', error);
    }
});