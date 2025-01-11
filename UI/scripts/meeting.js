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
const FRAMES_PER_SEND = 10; // Số frame mới trước khi gửi
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
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    function processFrame() {
        if (!isTranslating || !localVideo.srcObject) return;

        canvas.width = localVideo.videoWidth;
        canvas.height = localVideo.videoHeight;
        context.drawImage(localVideo, 0, 0, canvas.width, canvas.height);
        
        // Thêm frame mới vào buffer
        frameBuffer.push(canvas.toDataURL('image/jpeg', 0.8));
        if (frameBuffer.length > FRAMES_TO_KEEP) {
            frameBuffer.shift();
        }

        frameCounter++;
        
        // Gửi frames khi đủ điều kiện
        if (frameCounter >= FRAMES_PER_SEND && frameBuffer.length >= FRAMES_TO_KEEP) {
            sendFramesToServer([...frameBuffer]);
            frameCounter = 0;
        }
    }

    // Tạo animation loop
    function animate() {
        if (isTranslating) {
            processFrame();
            requestAnimationFrame(animate);
        }
    }

    // Bắt đầu xử lý khi bật dịch
    translationButton.addEventListener('click', () => {
        isTranslating = !isTranslating;
        if (isTranslating) {
            frameBuffer = [];
            frameCounter = 0;
            animate();
        }
        translationButton.querySelector('img').style.opacity = isTranslating ? 1 : 0.5;
    });
}

// Gửi frames đến server để xử lý
async function sendFramesToServer(frames) {
    try {
        const response = await fetch('http://192.168.1.8:8000/api/process-frames', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ frames: frames })
        });

        console.log('Gửi frames:', response);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        console.log('Gửi frames thành công');
        const data = await response.json();
        console.log('Dữ liệu trả về:', data);
        if (data.label !== undefined) {
            console.log('Label:', data.label);
            updateTranslationOverlay(data.label);
            console.log('Nhãn:', data.label);
            if (webrtcHandler) {
                console.log('Gửi kết quả dịch:', data.label);
                webrtcHandler.sendMessage({
                    type: 'translation-result',
                    label: data.label
                });
                console.log('Đã gửi kết quả dịch');
            }
            console.log('Đã cập nhật overlay');
        }
    } catch (error) {
        console.error('Lỗi gửi frames:', error);
    }
}

// Cập nhật kết quả dịch
function updateTranslationOverlay(label) {
    let overlay = document.querySelector('.translation-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'translation-overlay';
        remoteParticipant.appendChild(overlay);
    }
    
    // Lấy nhãn từ labels.json
    fetch('/Backend/dataset/labels.json')
        .then(response => response.json())
        .then(labels => {
            const labelText = Object.values(labels).find(l => l.index === label)?.label_with_diacritics || 'Không xác định';
            overlay.textContent = `Đang nói: ${labelText}`;
        })
        .catch(error => {
            console.error('Lỗi đọc labels:', error);
            overlay.textContent = `Đang nói: Không xác định`;
        });
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

translationButton.addEventListener('click', () => {
    isTranslationEnabled = !isTranslationEnabled;
    translationButton.querySelector('img').style.opacity = isTranslationEnabled ? 1 : 0.5;
    
    if (!isTranslationEnabled) {
        const overlay = document.querySelector('.translation-overlay');
        if (overlay) overlay.remove();
    }
});

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