const { app, BrowserWindow, ipcMain, dialog, session, clipboard } = require('electron');
const path = require('path');

let loginWindow;
let mainWindow;
let meetingWindow;

ipcMain.on('show-error', (event, message) => {
    dialog.showErrorBox('Lỗi', message);
});

ipcMain.on('show-notification', (event, data) => {
    dialog.showMessageBox(null, {
        type: 'info',
        title: data.title,
        message: data.message
    });
});

app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
// Hàm tạo cửa sổ login
function createLoginWindow() {
    loginWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
        },
    });
    loginWindow.loadFile('views/login.html');
}

// Hàm tạo cửa sổ main
function createMainWindow() {
    console.log('Tạo mới mainWindow.');
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true, // Đảm bảo đã bật
            contextIsolation: false, // Đảm bảo đã tắt
        },
    });

    console.log('Tải file main.html cho mainWindow.');
    mainWindow.loadFile('views/main.html'); // Đường dẫn đúng đến main.html

    mainWindow.on('closed', () => {
        console.log('mainWindow đã bị đóng.');
        mainWindow = null; // Đặt về null khi cửa sổ bị đóng
    });
}



app.on('ready', () => {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'media') {
            callback(true);
        } else {
            callback(false);
        }
    });
    
    createLoginWindow();
});


// Hàm tạo cửa sổ meeting
function createMeetingWindow() {
    meetingWindow = new BrowserWindow({
        width: 1300,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: true,
            enableWebRTC: true
        }
    });

    // Cấu hình quyền truy cập media cho cửa sổ meeting
    meetingWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowedPermissions = ['media'];
        if (allowedPermissions.includes(permission)) {
            callback(true);
        } else {
            callback(false);
        }
    });

    meetingWindow.loadFile('views/meeting.html');

    // Bắt sự kiện khi trang web được tải xong
    meetingWindow.webContents.on('did-finish-load', () => {
        meetingWindow.webContents.send('verify-permissions');
    });

    return meetingWindow;
}

// Lắng nghe sự kiện từ renderer để mở cửa sổ phòng họp
ipcMain.on('open-meeting-window', (event, data) => {
    if (!meetingWindow || meetingWindow.isDestroyed()) {
        meetingWindow = createMeetingWindow();
        // Gửi trạng thái media và targetCode đến cửa sổ meeting
        meetingWindow.webContents.on('did-finish-load', () => {
            meetingWindow.webContents.send('initial-meeting-data', {
                micEnabled: data.micEnabled,
                cameraEnabled: data.cameraEnabled,
                targetCode: data.targetCode
            });
        });
    } else {
        meetingWindow.focus();
    }
});

// Lắng nghe sự kiện mở giao diện chính
ipcMain.on('open-main-window', (event, data) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
        console.log('mainWindow bị hủy hoặc không tồn tại, tạo lại cửa sổ chính.');
        createMainWindow();
        // Gửi userCode đến main window
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.send('user-code', data.userCode);
        });
        mainWindow.show();
    } else if (mainWindow) {
        console.log('mainWindow tồn tại, hiển thị lại và làm nổi cửa sổ chính.');
        mainWindow.show();
        mainWindow.focus();
        // Gửi userCode đến main window
        mainWindow.webContents.send('user-code', data.userCode);
    }

    if (loginWindow && loginWindow.isVisible()) {
        console.log('Ẩn cửa sổ loginWindow.');
        loginWindow.hide();
    }
});


ipcMain.on('show-login-window', () => {
    loginWindow.show();
});

ipcMain.on('hide-main-window', () => {
    mainWindow.hide();
});

ipcMain.on('close-meeting-window', () => {
    meetingWindow.close();
});

ipcMain.on('show-login-error-dialog', () => {
    dialog.showErrorBox('Login Error', 'Please enter valid username and password!');
});

// Lắng nghe sự kiện logout
ipcMain.on('show-logout-dialog', () => {
    dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['Ok', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        title: 'Logout',
        message: 'Do you really want to logout?',
    }).then((result) => {
        if (result.response === 0) {
            console.log('Người dùng đã đăng xuất!');
            if (mainWindow) {
                mainWindow.hide(); // Ẩn cửa sổ chính
            }
            if (loginWindow) {
                loginWindow.show(); // Hiển thị cửa sổ đăng nhập
                loginWindow.focus(); // Làm nổi cửa sổ đăng nhập
            }
        } else {
            console.log('Người dùng đã hủy đăng xuất!');
        }
    });
});

// copy-to-clipboard
ipcMain.on('copy-to-clipboard', (event, text) => {
    clipboard.writeText(text);
    event.reply('copy-success');
});
