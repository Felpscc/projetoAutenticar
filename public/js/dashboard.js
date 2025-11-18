document.addEventListener('DOMContentLoaded', async () => {
    const usernameDisplay = document.getElementById('usernameDisplay');
    const logoutBtn = document.getElementById('logoutBtn');

    // No public/js/dashboard.js, dentro de document.addEventListener('DOMContentLoaded', async () => {
try {
    console.log('Tentando buscar informações do usuário...');
    const response = await fetch('/api/user-info');
    console.log('Resposta da API de usuário:', response.status, response.ok);

    if (response.ok) {
        const data = await response.json();
        console.log('Dados do usuário recebidos:', data);
        // ...
    } else {
        console.log('Falha ao obter info do usuário. Status:', response.status);
        window.location.href = '/';
    }
} catch (error) {
    console.error('Erro ao buscar informações do usuário (catch block):', error);
    window.location.href = '/';
}

    logoutBtn.addEventListener('click', () => {
        window.location.href = '/logout';
    });
});