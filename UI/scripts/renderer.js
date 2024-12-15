console.log('renderer.js đã được tải thành công!');
const ChannelView = require('../scripts/channel.js');

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

    // Xử lý tạo nhóm -----------------------------------------------------
    const createGroupButton = document.getElementById('create-group');
    const createGroupPopup = document.getElementById('create-group-popup');
    const createGroupOverlay = document.getElementById('create-group-overlay');
    const createGroupCancel = document.getElementById('create-group-cancel');
    const createGroupOk = document.getElementById('create-group-ok');
    const newGroupNameInput = document.getElementById('new-group-name');

    if (createGroupButton) {
        createGroupButton.addEventListener('click', () => {
            console.log('Nút Tạo nhóm được nhấn!');
            createGroupPopup.style.display = 'block';
            createGroupOverlay.style.display = 'block';
            newGroupNameInput.focus();
        });
    }

    if (createGroupCancel) {
        createGroupCancel.addEventListener('click', () => {
            console.log('Cancel Tạo nhóm!');
            createGroupPopup.style.display = 'none';
            createGroupOverlay.style.display = 'none';
        });
    }

    if (createGroupOverlay) {
        createGroupOverlay.addEventListener('click', () => {
            console.log('Tắt overlay Tạo nhóm!');
            createGroupPopup.style.display = 'none';
            createGroupOverlay.style.display = 'none';
        });
    }

    if (createGroupOk) {
        createGroupOk.addEventListener('click', () => {
            const groupName = document.getElementById('new-group-name').value;
            if (groupName.trim() !== '') {
                const newGroup = document.createElement('div');
                newGroup.classList.add('group');
                
                const groupIcon = document.createElement('div');
                groupIcon.classList.add('group-icon');
                groupIcon.textContent = groupName.slice(0, 2).toUpperCase();
                newGroup.appendChild(groupIcon);
                
                newGroup.addEventListener('click', () => {

                    // Xóa class active từ tất cả các nhóm
                    const allGroups = document.querySelectorAll('.group');
                    allGroups.forEach(g => g.classList.remove('active'));
                    
                    // Thêm class active cho nhóm được chọn
                    newGroup.classList.add('active');

                    const defaultView = document.getElementById('default-view');
                    const groupContent = document.getElementById('group-content');
                    
                    defaultView.style.display = 'none';
                    groupContent.style.display = 'block';
                    
                    groupContent.innerHTML = `
                        <div class="group-header">
                            <div class="header-info">
                                <h2>${groupName}</h2>
                            </div>
                            <div class="header-actions">
                                <button class="action-btn" title="Tạo cuộc họp">
                                    <img src="../assets/call.png" alt="Call Icon">
                                </button>
                                <button class="action-btn" title="Danh sách thành viên">
                                    <img src="../assets/members.png" alt="Members Icon">
                                </button>
                                <button class="close-group">×</button>
                            </div>
                        </div>
                        <div class="group-content-container">
                            <div class="channels-sidebar">
                                <div class="channel" data-channel="thông-báo">
                                    <span class="channel-icon">#</span>
                                    <span class="channel-name">thông-báo</span>
                                </div>
                                <div class="channel" data-channel="tài-liệu">
                                    <span class="channel-icon">#</span>
                                    <span class="channel-name">tài-liệu</span>
                                </div>
                                <div class="channel" data-channel="thảo-luận">
                                    <span class="channel-icon">#</span>
                                    <span class="channel-name">thảo-luận</span>
                                </div>
                            </div>
                            <div class="chat-area">
                                <!-- Nội dung chat sẽ được thêm vào đây -->
                            </div>
                        </div>
                    `;
                    
                    const channels = groupContent.querySelectorAll('.channel');
                    const chatArea = groupContent.querySelector('.chat-area');

                    // Trong phần xử lý click vào kênh
                    channels.forEach(channel => {
                        channel.addEventListener('click', (e) => {
                            console.log('Click vào channel!');
                            channels.forEach(c => c.classList.remove('active'));
                            channel.classList.add('active');

                            const channelName = channel.getAttribute('data-channel');
                            console.log('Channel name:', channelName);

                            fetch('../views/channel.html')
                                .then(response => response.text())
                                .then(html => {
                                    chatArea.innerHTML = html;
                                    new ChannelView(groupName, channelName); // Truyền thêm tên nhóm
                                })
                                .catch(error => console.error('Error:', error));
                        });
                    });

                    channels[0].click();

                    // Xử lý nút tạo cuộc họp
                    const meetingButton = groupContent.querySelector('.action-btn[title="Tạo cuộc họp"]');
                    if (meetingButton) {
                        meetingButton.addEventListener('click', () => {
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
                            };

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
                    }

                    const closeButton = groupContent.querySelector('.close-group');
                    closeButton.addEventListener('click', () => {
                        newGroup.classList.remove('active'); // Xóa class active khi đóng nhóm
                        groupContent.style.display = 'none';
                        defaultView.style.display = 'block';
                    });
                });
                
                const groupContainer = document.querySelector('.group-container');
                groupContainer.appendChild(newGroup);
                
                createGroupPopup.style.display = 'none';
                createGroupOverlay.style.display = 'none';
                document.getElementById('new-group-name').value = '';
            }
        });
    }

    // Xử lý tham gia nhóm -----------------------------------------------------
    const joinGroupButton = document.getElementById('join-group');
    const popup = document.getElementById('popup');
    const overlay = document.getElementById('overlay');
    const confirmButton = document.getElementById('confirm-join');

    if (joinGroupButton) {
        joinGroupButton.addEventListener('click', () => {
            console.log('Popup tham gia nhóm được hiển thị!');
            popup.style.display = 'block';
            overlay.style.display = 'block';
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            console.log('Popup tham gia nhóm bị tắt qua overlay!');
            popup.style.display = 'none';
            overlay.style.display = 'none';
        });
    }

    if (confirmButton) {
        confirmButton.addEventListener('click', () => {
            console.log('Popup tham gia nhóm bị tắt qua nút Xác nhận!');
            popup.style.display = 'none';
            overlay.style.display = 'none';
        });
    }

    

});