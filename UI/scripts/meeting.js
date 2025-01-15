// meeting.js

const handleMediaError = (error) => {
    let message = 'Lỗi truy cập thiết bị media: ';
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        message += 'Không tìm thấy thiết bị camera hoặc microphone.';
    } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        message += 'Vui lòng cấp quyền truy cập camera và microphone.';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        message += 'Thiết bị đang được sử dụng bởi ứng dụng khác.';
    } else {
        message += error.message;
    }
    console.error(message);
    ipcRenderer.send('show-error', message);
};

const localVideo = document.getElementById('self-video');
const participantsContainer = document.querySelector('.participants-container');
const micButton = document.getElementById('toggle-mic');
const cameraButton = document.getElementById('toggle-camera');
const translationButton = document.getElementById('toggle-translation');
const leaveButton = document.getElementById('leave-meeting');
const okLeaveButton = document.getElementById('leave-meeting-ok');
const leavePopup = document.getElementById('leave-meeting-popup');
const leaveOverlay = document.getElementById('leave-meeting-overlay');
const cancelLeaveButton = document.getElementById('leave-meeting-cancel');
const selfPredictionLabel = document.getElementById('self-prediction');

// Tạo video element cho người kia
const remoteVideo = document.createElement('video');
remoteVideo.autoplay = true;
remoteVideo.playsInline = true;

// Tạo container cho remote video
const remoteParticipant = document.createElement('div');
remoteParticipant.className = 'participant';
const remoteUserName = document.createElement('p');
remoteUserName.textContent = 'Người dùng khác';
// Thêm lớp CSS mới
remoteUserName.classList.add('remote-username');

remoteParticipant.appendChild(remoteVideo);
remoteParticipant.appendChild(remoteUserName);
participantsContainer.appendChild(remoteParticipant);

let localStream = null;
let webrtcHandler = null;
let isMicOn = true;
let isCameraOn = true;
let isTranslationEnabled = false;
const { ipcRenderer } = require('electron');
const WebRTCHandler = require('../scripts/webrtc_handler');

let frameBuffer = [];
const FRAMES_TO_KEEP = 60;  // Số frame giữ lại
const FRAME_INTERVAL = 10; // Số frame mới trước khi gửi
let frameCounter = 0;
let isTranslating = false;
let mediaRecorder = null;
let translationOverlay = null;

// Nhận trạng thái ban đầu từ main process
let initialMicState = true;
let initialCameraState = true;
let targetCode = null;
// Lấy thông tin user từ localStorage
let userInfo = null;

ipcRenderer.on('initial-meeting-data', (event, data) => {
    initialMicState = data.micEnabled;
    initialCameraState = data.cameraEnabled;
    targetCode = data.targetCode;
    initializeWebRTC();
    
    // Bắt đầu cuộc gọi sau khi đã khởi tạo
    if (webrtcHandler && targetCode) {
        webrtcHandler.startCall(targetCode);
    }
});

// Khởi tạo WebRTC và media streams
// Thay thế hàm initializeWebRTC trong meeting.js
async function initializeWebRTC() {
    try {
        // Lấy thông tin user từ localStorage
        userInfo = JSON.parse(localStorage.getItem('currentUser'));
        if (!userInfo) {
            throw new Error('Không tìm thấy thông tin người dùng');
        }

        // Khởi tạo media stream
        const constraints = {
            video: initialCameraState,
            audio: initialMicState
        };
        console.log('Requesting media with constraints:', constraints);
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Hiển thị local video
        if (localVideo) {
            console.log('Setting local video stream');
            localVideo.srcObject = localStream;
            
            // Cập nhật trạng thái tracks
            if (localStream.getAudioTracks().length > 0) {
                localStream.getAudioTracks()[0].enabled = initialMicState;
                isMicOn = initialMicState;
            }
            if (localStream.getVideoTracks().length > 0) {
                localStream.getVideoTracks()[0].enabled = initialCameraState;
                isCameraOn = initialCameraState;
            }
        }

        // Khởi tạo WebRTC handler
        // initializeWebRTCHandlers();

        // Khởi tạo WebRTC handler với local stream
        if (userInfo && userInfo.userCode) {
            webrtcHandler = new WebRTCHandler(userInfo.userCode);
            
            // Thiết lập callback cho remote stream
            webrtcHandler.onRemoteStreamReceived = (stream) => {
                console.log('Received remote stream');
                if (remoteVideo) {
                    remoteVideo.srcObject = stream;
                }
            };

            await webrtcHandler.initialize(localStream);
            console.log('WebRTC handler initialized');

            // Bắt đầu cuộc gọi nếu có targetCode
            if (targetCode) {
                webrtcHandler.startCall(targetCode);
            }
        }

        setupVideoFrameCapture();

    } catch (error) {
        console.error('Lỗi khởi tạo media:', error);
        handleMediaError(error);
    }
}

// Xử lý kết nối WebRTC
function initializeWebRTCHandlers() {
    // Lấy user code từ localStorage
    const userInfo = JSON.parse(localStorage.getItem('currentUser'));
    if (!userInfo || !userInfo.userCode) {
        console.error('Không tìm thấy thông tin người dùng');
        return;
    }

    // Khởi tạo WebRTC handler
    const WebRTCHandler = require('../scripts/webrtc_handler');
    webrtcHandler = new WebRTCHandler(userInfo.userCode);

    // Thiết lập callback nhận video stream của người kia
    webrtcHandler.onRemoteStreamReceived = (stream) => {
        console.log('Đã nhận được stream từ xa');
        remoteVideo.srcObject = stream;
        remoteVideo.play();
    };

    // Khởi tạo kết nối
    webrtcHandler.initialize(localStream).catch(error => {
        console.error('Lỗi khởi tạo WebRTC:', error);
    });
}

// Thiết lập capture video frames để nhận dạng
function setupVideoFrameCapture() {
    console.log('Setting up video capture...');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    let skipFrameCount = 0;
    
    function processFrame() {
        if (!isTranslating || !localVideo.srcObject) {
            requestAnimationFrame(processFrame);
            return;
        }

        skipFrameCount++;
        
        // Chỉ xử lý frame khi đạt đến khoảng cách frame_interval
        if (skipFrameCount >= FRAME_INTERVAL) {
            canvas.width = localVideo.videoWidth;
            canvas.height = localVideo.videoHeight;
            context.drawImage(localVideo, 0, 0, canvas.width, canvas.height);
            
            frameBuffer.push(canvas.toDataURL('image/jpeg', 0.8));
            console.log(`Captured frame ${frameBuffer.length}/${FRAMES_TO_KEEP}`);
            
            // Reset bộ đếm frame
            skipFrameCount = 0;
            
            // Khi đủ số frame cần thiết, gửi đến server
            if (frameBuffer.length >= FRAMES_TO_KEEP) {
                console.log('Sending frames batch to server...');
                sendFramesToServer([...frameBuffer]);
                frameBuffer = []; // Xóa buffer sau khi gửi
            }
        }

        requestAnimationFrame(processFrame);
    }

    processFrame();
}

// Gửi frames đến server để xử lý
async function sendFramesToServer(frames) {
    try {
        console.log('Gửi frames...');
        const response = await fetch('http://192.168.1.8:8000/api/process-frames', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ frames: frames })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Kết quả từ server:', data);
        
        // Cập nhật nhãn dựa trên kết quả từ server
        updatePredictionLabel(data);
    } catch (error) {
        console.error('Lỗi gửi frames:', error);
    }
}

// Hàm cập nhật nhãn
function updatePredictionLabel(data) {
    if (!selfPredictionLabel) return;

    let labelText = 'Đang chờ...';
    
    if (data.status === 'no_hand_detected') {
        labelText = 'Không phát hiện bàn tay';
    } else if (data.status === 'insufficient_data') {
        labelText = 'Chưa đủ dữ liệu';
    } else if (data.status === 'success' && data.label) {
        labelText = `Đang nói: ${data.label}`;
    }

    // Cập nhật text và thêm animation
    selfPredictionLabel.textContent = labelText;
    selfPredictionLabel.classList.add('updated');
    
    // Xóa class animation sau khi hoàn thành
    setTimeout(() => {
        selfPredictionLabel.classList.remove('updated');
    }, 300);
}

// Cập nhật kết quả dịch
function updateTranslationOverlay(label) {
    let overlay = document.querySelector('.translation-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'translation-overlay';
        remoteParticipant.appendChild(overlay);
    }
    
    overlay.textContent = `Đang nói: ${label}`;
}

// Xử lý các nút điều khiển
micButton.addEventListener('click', () => {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            isMicOn = !isMicOn;
            audioTrack.enabled = isMicOn;
            micButton.querySelector('img').src = isMicOn ? '../assets/mic-on.png' : '../assets/mic-off.png';
        }
    }
});

cameraButton.addEventListener('click', () => {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            isCameraOn = !isCameraOn;
            videoTrack.enabled = isCameraOn;
            cameraButton.querySelector('img').src = isCameraOn ? '../assets/camera-on.png' : '../assets/camera-off.png';
        }
    }
});

if (translationButton) {
    translationButton.addEventListener('click', () => {
        isTranslating = !isTranslating;
        console.log('Translation state changed:', isTranslating);
        
        if (isTranslating) {
            console.log('Starting translation...');
            frameBuffer = [];
            frameCounter = 0;
            setupVideoFrameCapture();
        } else {
            console.log('Stopping translation...');
            const overlay = document.querySelector('.translation-overlay');
            if (overlay) overlay.remove();
        }
        
        translationButton.querySelector('img').style.opacity = isTranslating ? 1 : 0.5;
    });
} else {
    console.error('Translation button not found!');
}

// Xử lý rời phòng họp
leaveButton.addEventListener('click', () => {
    leavePopup.style.display = 'block';
    leaveOverlay.style.display = 'block';
});

cancelLeaveButton.addEventListener('click', () => {
    leavePopup.style.display = 'none';
    leaveOverlay.style.display = 'none';
});

okLeaveButton.addEventListener('click', () => {
    // Dọn dẹp và đóng kết nối
    if (webrtcHandler) {
        webrtcHandler.endCall();
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    leavePopup.style.display = 'none';
    leaveOverlay.style.display = 'none';
    ipcRenderer.send('close-meeting-window');
});

// Khởi tạo khi trang được tải
window.addEventListener('DOMContentLoaded', () => {
    initializeWebRTC();
});

// Xử lý khi đóng cửa sổ
window.addEventListener('beforeunload', () => {
    if (webrtcHandler) {
        webrtcHandler.endCall();
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
});