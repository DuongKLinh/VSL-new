// Lấy các phần tử DOM
const historyPanel = document.getElementById('historyPanel');
const toggleButton = document.getElementById('toggleButton');
const copyButton = document.querySelector('.copy-button');
const userCode = document.querySelector('.user-code');
const createCallButton = document.querySelector('.create-call-button');

// Khởi tạo ipcRenderer
const { ipcRenderer } = require('electron');

// Trạng thái panel
let isOpen = true;

// Xử lý đóng/mở panel lịch sử
toggleButton.addEventListener('click', () => {
    isOpen = !isOpen;
    historyPanel.classList.toggle('closed');
    toggleButton.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
});

// Xử lý copy mã người dùng
copyButton.addEventListener('click', () => {
    // Lấy mã từ nội dung text (bỏ "Mã của bạn: " ở đầu)
    const code = userCode.textContent.replace('Mã của bạn: ', '');
    
    // Copy vào clipboard
    navigator.clipboard.writeText(code)
        .then(() => {
            // Thông báo thành công
            alert('Đã sao chép mã thành công!');
        })
        .catch(err => {
            // Xử lý lỗi
            console.error('Không thể sao chép mã:', err);
            alert('Không thể sao chép mã. Vui lòng thử lại!');
        });
});

// Nút tạo cuộc họp
createCallButton.addEventListener('click', () => {
    const meetingPopup = document.getElementById('meeting-popup');
    const meetingOverlay = document.getElementById('meeting-overlay');
    const micControl = document.getElementById('mic-control');
    const cameraControl = document.getElementById('camera-control');
    const meetingOkButton = document.getElementById('meeting-ok');
    const meetingCancel = document.getElementById('meeting-cancel');

    // Hiển thị popup
    meetingPopup.style.display = 'block';
    meetingOverlay.style.display = 'block';

    // Xử lý đóng popup
    const closeMeetingPopup = () => {
        meetingPopup.style.display = 'none';
        meetingOverlay.style.display = 'none';
    }

    // Xử lý nút ok trong popup
    if (meetingOkButton) {
        meetingOkButton.addEventListener('click', () => {
            const micControl = document.getElementById('mic-control');
            const cameraControl = document.getElementById('camera-control');
            
            // Lấy trạng thái hiện tại của mic và camera
            const micEnabled = micControl.querySelector('img').src.includes('mic-on.png');
            const cameraEnabled = cameraControl.querySelector('img').src.includes('camera-on.png');
            
            // Gửi sự kiện mở cửa sổ meeting kèm theo trạng thái
            ipcRenderer.send('open-meeting-window', { micEnabled, cameraEnabled });
            
            const meetingPopup = document.getElementById('meeting-popup');
            const meetingOverlay = document.getElementById('meeting-overlay');
            if (meetingPopup && meetingOverlay) {
                meetingPopup.style.display = 'none';
                meetingOverlay.style.display = 'none';
            }
        });
    }

    if (meetingCancel) meetingCancel.addEventListener('click', closeMeetingPopup);
    if (meetingOverlay) meetingOverlay.addEventListener('click', closeMeetingPopup);

    // Xử lý nút microphone
    if (micControl) {
        micControl.addEventListener('click', () => {
            const micImg = micControl.querySelector('img');
            const isMicOn = micImg.src.includes('mic-on.png');
            micImg.src = isMicOn ? '../assets/mic-off.png' : '../assets/mic-on.png';
            micControl.title = isMicOn ? 'Bật microphone' : 'Tắt microphone';
        });
    }

    // Xử lý nút camera
    if (cameraControl) {
        cameraControl.addEventListener('click', () => {
            const cameraImg = cameraControl.querySelector('img');
            const isCameraOn = cameraImg.src.includes('camera-on.png');
            cameraImg.src = isCameraOn ? '../assets/camera-off.png' : '../assets/camera-on.png';
            cameraControl.title = isCameraOn ? 'Bật camera' : 'Tắt camera';
        });
    }

});

// Xử lý đăng xuất -----------------------------------------------------
const logoutButton = document.getElementById('logout-button');
const logoutPopup = document.getElementById('logout-popup');
const logoutOverlay = document.getElementById('logout-overlay');
const logoutOk = document.getElementById('logout-ok');
const logoutCancel = document.getElementById('logout-cancel');

if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        console.log('Nút Logout được nhấn!');
        logoutPopup.style.display = 'block';
        logoutOverlay.style.display = 'block';
    });
}

if (logoutCancel) {
    logoutCancel.addEventListener('click', () => {
        console.log('Popup đăng xuất bị hủy!');
        logoutPopup.style.display = 'none';
        logoutOverlay.style.display = 'none';
    });
}

if (logoutOverlay) {
    logoutOverlay.addEventListener('click', () => {
        console.log('Overlay của popup đăng xuất bị nhấn!');
        logoutPopup.style.display = 'none';
        logoutOverlay.style.display = 'none';
    });
}

if (logoutOk) {
    logoutOk.addEventListener('click', () => {
        console.log('Người dùng đã đăng xuất!');
        logoutPopup.style.display = 'none';
        logoutOverlay.style.display = 'none';
        ipcRenderer.send('show-login-window');
        ipcRenderer.send('hide-main-window');
    });
}