// meeting.js

const localVideo = document.getElementById('self-video');
const micButton = document.getElementById('toggle-mic');
const cameraButton = document.getElementById('toggle-camera');
const leaveButton = document.getElementById('leave-meeting');
const okLeaveButton = document.getElementById('leave-meeting-ok');
const leavePopup = document.getElementById('leave-meeting-popup');

let localStream = null;
let isMicOn = true;
let isCameraOn = true;
let frameBuffer = [];
let frameCount = 0;
const FRAMES_TO_SEND = 60;
const { ipcRenderer } = require('electron');

// Nhận trạng thái ban đầu từ main process
let initialMicState = true;
let initialCameraState = true;

ipcRenderer.on('initial-media-state', (event, { micEnabled, cameraEnabled }) => {
    initialMicState = micEnabled;
    initialCameraState = cameraEnabled;
    
    // Cập nhật UI và trạng thái media khi khởi tạo
    if (!initialMicState) {
        const micButton = document.getElementById('toggle-mic');
        micButton.querySelector('img').src = '../assets/mic-off.png';
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) audioTrack.enabled = false;
        }
    }
    
    if (!initialCameraState) {
        const cameraButton = document.getElementById('toggle-camera');
        cameraButton.querySelector('img').src = '../assets/camera-off.png';
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) videoTrack.enabled = false;
        }
    }
});

// hàm gửi frames
async function sendFramesToServer(frames) {
    try {
        const response = await fetch('http://localhost:8000/api/process-frames', {
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
        console.log('Server response:', data);
    } catch (error) {
        console.error('Error sending frames to server:', error);
    }
}

// Initialize media devices
// Initialize media devices
async function initializeMedia() {
    try {
        const constraints = {
            video: initialCameraState,
            audio: initialMicState
        };

        const permissions = await navigator.mediaDevices.getUserMedia(constraints);
        localStream = permissions;
        
        if (localVideo) {
            localVideo.srcObject = localStream;
            
            // Cập nhật trạng thái các track theo thiết lập ban đầu
            if (localStream.getAudioTracks().length > 0) {
                localStream.getAudioTracks()[0].enabled = initialMicState;
            }
            if (localStream.getVideoTracks().length > 0) {
                localStream.getVideoTracks()[0].enabled = initialCameraState;
            }

            // Thêm canvas để capture video frames
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // Set up video frame capture
            localVideo.addEventListener('play', () => {
                const captureFrame = () => {
                    if (localVideo.paused || localVideo.ended) return;
                    
                    // Đảm bảo canvas có kích thước phù hợp với video
                    canvas.width = localVideo.videoWidth;
                    canvas.height = localVideo.videoHeight;
                    
                    // Vẽ frame hiện tại lên canvas
                    context.drawImage(localVideo, 0, 0, canvas.width, canvas.height);
                    
                    // Chuyển frame thành base64
                    const frameBase64 = canvas.toDataURL('image/jpeg', 0.8);
                    
                    // Thêm frame vào buffer
                    frameBuffer.push(frameBase64);

                    // Giữ lại tối đa 60 frame cuối cùng
                    if (frameBuffer.length > FRAMES_TO_SEND) {
                        frameBuffer.shift();
                    }

                    // Gửi frame nhưng không xóa buffer
                    if (frameBuffer.length === FRAMES_TO_SEND) {
                        sendFramesToServer([...frameBuffer]); // Gửi bản sao buffer hiện tại
                        // Không xóa buffer, tiếp tục thêm frame mới
                    }

                    // Tiếp tục capture frame tiếp theo
                    requestAnimationFrame(captureFrame);
                };
                
                captureFrame();
            });

            // Khởi tạo dịch vụ dịch nếu camera đang bật
            if (initialCameraState && isTranslationEnabled) {
                translationInterval = setInterval(processTranslation, 100);
            }
        }
    } catch (error) {
        console.error('Error initializing media:', error);
    }
}


// Toggle microphone
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

// Toggle camera
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

// Leave meeting
leaveButton.addEventListener('click', () => {
    leavePopup.style.display = 'block';

    // if (confirm('Are you sure you want to leave the meeting?')) {
    //     // Stop all media tracks
    //     localStream.getTracks().forEach(track => track.stop());
    //     // Redirect to another page or close the meeting interface
    //     // window.location.href = '../views/main.html';
    //     ipcRenderer.send('close-meeting-window');
    // }
});

okLeaveButton.addEventListener('click', () => {
    if (localStream && localStream.getTracks) {
        localStream.getTracks().forEach(track => track.stop());
    }
    leavePopup.style.display = 'none';
    ipcRenderer.send('close-meeting-window');
});

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    initializeMedia();
});


// Thêm khai báo biến cho overlay
const leaveOverlay = document.getElementById('leave-meeting-overlay');
const cancelLeaveButton = document.getElementById('leave-meeting-cancel');

// Sửa lại event listener cho nút Leave
leaveButton.addEventListener('click', () => {
    leavePopup.style.display = 'block';
    leaveOverlay.style.display = 'block'; // Hiển thị overlay khi mở popup
});

// Thêm xử lý cho nút Cancel
if (cancelLeaveButton) {
    cancelLeaveButton.addEventListener('click', () => {
        leavePopup.style.display = 'none';
        leaveOverlay.style.display = 'none';
    });
}

// Thêm xử lý cho overlay
if (leaveOverlay) {
    leaveOverlay.addEventListener('click', () => {
        leavePopup.style.display = 'none';
        leaveOverlay.style.display = 'none';
    });
}

// Sửa lại event listener cho nút Ok
okLeaveButton.addEventListener('click', () => {
    if (localStream && localStream.getTracks) {
        localStream.getTracks().forEach(track => track.stop());
    }
    leavePopup.style.display = 'none';
    leaveOverlay.style.display = 'none';
    ipcRenderer.send('close-meeting-window');
});