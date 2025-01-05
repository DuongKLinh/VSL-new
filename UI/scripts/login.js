document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM đã được tải xong!');

    const { ipcRenderer } = require('electron');
    let meetingWindow = null;

    // Xử lý đăng nhập -----------------------------------------------------
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();

            if (username && password) {
                console.log('Thông tin đăng nhập hợp lệ, gửi sự kiện open-main-window!');
                ipcRenderer.send('open-main-window');
            } else {
                console.log('Thông tin đăng nhập không hợp lệ!');
                ipcRenderer.send('show-login-error-dialog');
            }
        });
    }
})