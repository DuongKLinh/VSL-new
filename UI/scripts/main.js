// const config = require('./config');
// const localIP = require('ip').address();
// config.serverIP = localIP;

// Lấy các phần tử DOM
const historyPanel = document.getElementById('historyPanel');
const toggleButton = document.getElementById('toggleButton');
const copyButton = document.querySelector('.copy-button');
const userCode = document.querySelector('.user-code');
const createCallButton = document.querySelector('.create-call-button');

// Khởi tạo
const { ipcRenderer } = require('electron');
const WebRTCHandler = require('../scripts/webrtc_handler');

// Trạng thái panel
let isOpen = true;
let currentUserCode = '';
let webrtcHandler = null;

// Xử lý đóng/mở panel lịch sử
toggleButton.addEventListener('click', () => {
    isOpen = !isOpen;
    historyPanel.classList.toggle('closed');
    toggleButton.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
});

// Lắng nghe sự kiện user-code từ main process
ipcRenderer.on('user-code', (event, userCode) => {
    currentUserCode = userCode;
    const userCodeElement = document.querySelector('.user-code');
    if (userCodeElement) {
        userCodeElement.textContent = `Mã của bạn: ${userCode}`;
    }
    
    // Khởi tạo WebRTC handler với user code
    initializeWebRTC(userCode);
});

// Khởi tạo WebRTC
async function initializeWebRTC(userCode) {
    try {
        console.log('Bắt đầu khởi tạo WebRTC với userCode:', userCode);
        
        // === ✅ Ensure that the old WebRTC connection is closed before reinitializing ===
        if (webrtcHandler) {
            console.log('Đóng kết nối WebRTC cũ trước khi khởi tạo mới.');
            webrtcHandler.endCall();  // Closes peer connection, streams, and WebSocket
            webrtcHandler = null;
        }

        // === ✅ Create a new WebRTC Handler ===
        webrtcHandler = new WebRTCHandler(userCode);
        console.log('WebRTC handler được tạo mới');

        // Event handlers for WebRTC
        webrtcHandler.onCallReceived = (message) => {
            console.log('Nhận được cuộc gọi từ:', message.from);
            const targetCode = message.from;
            showIncomingCallPopup(targetCode);
        };

        webrtcHandler.onCallRejected = () => {
            console.log('Cuộc gọi bị từ chối');
            ipcRenderer.send('show-notification', {
                title: 'Cuộc gọi bị từ chối',
                message: 'Người dùng đã từ chối cuộc gọi'
            });
        };

        webrtcHandler.onError = (error) => {
            console.error('Lỗi WebRTC:', error);
            ipcRenderer.send('show-notification', {
                title: 'Lỗi kết nối',
                message: 'Không thể thiết lập kết nối. Vui lòng thử lại sau.'
            });
        };

        await webrtcHandler.initialize();
        console.log('WebRTC handler đã khởi tạo xong');

    } catch (error) {
        console.error('Lỗi khởi tạo WebRTC:', error);
        ipcRenderer.send('show-notification', {
            title: 'Lỗi khởi tạo',
            message: 'Không thể khởi tạo kết nối. Vui lòng kiểm tra kết nối mạng.'
        });

        // Thử lại sau 5 giây
        setTimeout(() => {
            initializeWebRTC(userCode);
        }, 5000);
    }
}


// Copy code
copyButton.addEventListener('click', () => {
    const code = userCode.textContent.replace('Mã của bạn: ', '');
    ipcRenderer.send('copy-to-clipboard', code);
});

// Thêm listener để xử lý thông báo khi copy thành công
ipcRenderer.on('copy-success', () => {
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = 'Sao chép mã thành công!';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 1700);
});

// Nút tạo cuộc họp
// Xử lý nút tạo cuộc gọi và popup
createCallButton.addEventListener('click', () => {
    const userIdInput = document.querySelector('.user-id-input');
    const targetCode = userIdInput.value.trim();

    // Kiểm tra mã người dùng nhập vào
    if (!targetCode) {
        ipcRenderer.send('show-error', 'Vui lòng nhập mã người dùng');
        return;
    }

    // Kiểm tra không cho phép gọi chính mình
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (targetCode === currentUser.userCode) {
        ipcRenderer.send('show-error', 'Không thể gọi cho chính mình');
        return;
    }

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

    // Xử lý nút microphone trong popup
    if (micControl) {
        micControl.addEventListener('click', () => {
            const micImg = micControl.querySelector('img');
            const isMicOn = micImg.src.includes('mic-on.png');
            // Đổi ảnh mic khi click
            micImg.src = isMicOn ? '../assets/mic-off.png' : '../assets/mic-on.png';
            micControl.title = isMicOn ? 'Bật microphone' : 'Tắt microphone';
        });
    }

    // Xử lý nút camera trong popup
    if (cameraControl) {
        cameraControl.addEventListener('click', () => {
            const cameraImg = cameraControl.querySelector('img');
            const isCameraOn = cameraImg.src.includes('camera-on.png');
            // Đổi ảnh camera khi click
            cameraImg.src = isCameraOn ? '../assets/camera-off.png' : '../assets/camera-on.png';
            cameraControl.title = isCameraOn ? 'Bật camera' : 'Tắt camera';
        });
    }

    // Xử lý nút ok trong popup
    if (meetingOkButton) {
        meetingOkButton.addEventListener('click', () => {
            // Lấy trạng thái hiện tại của mic và camera
            const micEnabled = micControl.querySelector('img').src.includes('mic-on.png');
            const cameraEnabled = cameraControl.querySelector('img').src.includes('camera-on.png');
            
            // Gửi sự kiện mở cửa sổ meeting kèm theo trạng thái và mã người nhận
            ipcRenderer.send('open-meeting-window', { 
                micEnabled, 
                cameraEnabled,
                targetCode 
            });
            
            if (webrtcHandler) {
                console.log('Bắt đầu cuộc gọi tới:', targetCode);
                webrtcHandler.startCall(targetCode);
            } else {
                console.error('WebRTC handler chưa được khởi tạo');
            }

            closeMeetingPopup();
        });
    }

    // Xử lý nút cancel
    if (meetingCancel) {
        meetingCancel.addEventListener('click', closeMeetingPopup);
    }

    // Xử lý click vào overlay
    if (meetingOverlay) {
        meetingOverlay.addEventListener('click', closeMeetingPopup);
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
        // Xóa thông tin người dùng khi đăng xuất
        localStorage.removeItem('currentUser');
        currentUserCode = '';
        logoutPopup.style.display = 'none';
        logoutOverlay.style.display = 'none';
        ipcRenderer.send('show-login-window');
        ipcRenderer.send('hide-main-window');
    });
}

// Xử lý popup cuộc gọi đến
function showIncomingCallPopup(callerCode) {
    const incomingCallPopup = document.getElementById('incoming-call-popup');
    const incomingCallOverlay = document.getElementById('incoming-call-overlay');
    const callerId = document.getElementById('caller-id');
    const acceptCallButton = document.getElementById('accept-call');
    const rejectCallButton = document.getElementById('reject-call');

    // Hiển thị mã người gọi
    callerId.textContent = callerCode;

    // Hiển thị popup
    incomingCallPopup.style.display = 'block';
    incomingCallOverlay.style.display = 'block';

    // Xử lý nút chấp nhận cuộc gọi
    acceptCallButton.onclick = () => {
        incomingCallPopup.style.display = 'none';
        incomingCallOverlay.style.display = 'none';
        
        // Mở cửa sổ meeting với trạng thái mặc định
        ipcRenderer.send('open-meeting-window', {
            micEnabled: true,
            cameraEnabled: true,
            targetCode: callerCode
        });

        // Bắt đầu cuộc gọi
        if (webrtcHandler) {
            console.log('Chấp nhận cuộc gọi từ:', callerCode);
            webrtcHandler.startCall(callerCode);
        } else {
            console.error('WebRTC handler chưa được khởi tạo');
        }
    };

    // Xử lý nút từ chối cuộc gọi
    rejectCallButton.onclick = () => {
        incomingCallPopup.style.display = 'none';
        incomingCallOverlay.style.display = 'none';
        
        // Gửi tín hiệu từ chối cuộc gọi
        if (webrtcHandler) {
            webrtcHandler.sendToSignalingServer({
                type: 'call-reject',
                target: callerCode
            });
        }
    };
}