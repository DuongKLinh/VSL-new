document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM đã được tải xong!');

    const { ipcRenderer } = require('electron');

    // Hàm tạo mã code ngẫu nhiên
    function generateUserCode() {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return code;
    }

    // Xử lý đăng nhập
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();

            if (username && password) {
                // Tạo mã code cho người dùng khi đăng nhập thành công
                const userCode = generateUserCode();
                
                // Lưu thông tin người dùng vào localStorage
                localStorage.setItem('currentUser', JSON.stringify({
                    username: username,
                    userCode: userCode
                }));

                console.log('Thông tin đăng nhập hợp lệ, gửi sự kiện open-main-window!');
                // Gửi mã code qua main process
                ipcRenderer.send('open-main-window', { userCode });
            } else {
                console.log('Thông tin đăng nhập không hợp lệ!');
                ipcRenderer.send('show-login-error-dialog');
            }
        });
    }
});