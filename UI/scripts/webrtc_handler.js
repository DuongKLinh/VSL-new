// webrtc_handler.js

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

class WebRTCHandler {
    constructor(userCode) {
        this.userCode = userCode;
        this.retryCount = 0;
        // Cập nhật cấu hình ICE servers
        this.configuration = {
            iceServers: [
                { 
                    urls: [
                        'stun:stun.l.google.com:19302',
                        'stun:stun1.l.google.com:19302',
                        'stun:stun2.l.google.com:19302',
                        'stun:stun3.l.google.com:19302',
                        'stun:stun4.l.google.com:19302'
                    ]
                }
            ],
            iceCandidatePoolSize: 10,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };
    
        // Các biến quản lý trạng thái
        this.peerConnection = null;
        this.localStream = null;
        this.websocket = null;
        this.targetCode = null;
    
        // Callback cho remote stream
        this.onRemoteStreamReceived = null;
        this.onCallReceived = null;
        this.onCallRejected = null;
        this.onError = null;  
    }

    async initialize(localStream) {
        try {
            this.localStream = localStream;
            await this.connectSignalingServerWithRetry();
            console.log('WebRTC Handler đã được khởi tạo');
        } catch (error) {
            console.error('Lỗi khởi tạo WebRTC Handler:', error);
            throw error;
        }
    }

    async connectSignalingServerWithRetry() {
        while (this.retryCount < MAX_RETRIES) {
            try {
                await this.connectSignalingServer();
                this.retryCount = 0; // Reset counter on successful connection
                return;
            } catch (error) {
                this.retryCount++;
                if (this.retryCount === MAX_RETRIES) {
                    throw new Error('Không thể kết nối sau nhiều lần thử');
                }
                console.log(`Thử kết nối lại lần ${this.retryCount}/${MAX_RETRIES}`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
        }
    }

    async connectSignalingServer() {
        return new Promise((resolve, reject) => {
            try {
                const wsUrl = `ws://192.168.100.24:8765/ws/${this.userCode}`;
                console.log('Đang kết nối tới:', wsUrl);
                
                this.websocket = new WebSocket(wsUrl);
                
                this.websocket.onopen = () => {
                    console.log('Đã kết nối thành công tới Signaling Server');
                    this.setupWebSocketHandlers();
                    resolve();
                };
    
                this.websocket.onerror = (error) => {
                    console.error('Lỗi WebSocket:', error);
                    reject(new Error(`Không thể kết nối tới Signaling Server: ${error.message}`));
                };
    
                this.websocket.onclose = (event) => {
                    console.log('WebSocket đã đóng:', event.code, event.reason);
                    if (!event.wasClean) {
                        this.reconnectToSignalingServer();
                    }
                };
    
                // Thêm timeout để tránh đợi quá lâu
                setTimeout(() => {
                    if (this.websocket.readyState !== WebSocket.OPEN) {
                        this.websocket.close();
                        reject(new Error('Kết nối timeout'));
                    }
                }, 5000);
    
            } catch (error) {
                console.error('Lỗi khi tạo kết nối WebSocket:', error);
                reject(error);
            }
        });
    }
    
    // Thêm hàm kết nối lại
    async reconnectToSignalingServer() {
        console.log('Đang thử kết nối lại...');
        try {
            await this.connectSignalingServer();
        } catch (error) {
            console.error('Không thể kết nối lại:', error);
            setTimeout(() => this.reconnectToSignalingServer(), 5000);
        }
    }

    setupWebSocketHandlers() {
        this.websocket.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
                case 'call-offer':
                    await this.handleCallOffer(message);
                    break;
                case 'call-answer':
                    await this.handleCallAnswer(message);
                    break;
                case 'call-candidate':
                    await this.handleNewICECandidate(message);
                    break;
                case 'error':
                    // Thêm xử lý lỗi từ server
                    const { ipcRenderer } = require('electron');
                    ipcRenderer.send('show-notification', {
                        title: 'Lỗi cuộc gọi',
                        message: message.message
                    });
                    break;
                case 'translation-result':
                    this.handleTranslationResult(message);
                    break;
            }
        };
    
        // Xử lý khi mất kết nối
        this.websocket.onclose = () => {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('show-notification', {
                title: 'Mất kết nối',
                message: 'Đã mất kết nối với server. Vui lòng thử lại sau.'
            });
        };
    }

    // Hàm xử lý kết quả dịch
    handleTranslationResult(message) {
        if (this.onTranslationResult) {
            this.onTranslationResult(message.label);
        }
    }
    
    async createPeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.configuration);

        // Thêm local stream
        if (this.localStream) {
            console.log('Adding local stream tracks...');
            this.localStream.getTracks().forEach(track => {
                console.log('Adding track:', track.kind);
                this.peerConnection.addTrack(track, this.localStream);
            });
        } else {
            console.warn('No local stream available');
        }

        // Xử lý ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('New ICE candidate:', event.candidate.type);
                this.sendToSignalingServer({
                    type: 'call-candidate',
                    target: this.targetCode,
                    candidate: event.candidate
                });
            }
        };

        // Thêm xử lý trạng thái ICE
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
        };

        this.peerConnection.onicegatheringstatechange = () => {
            console.log('ICE gathering state:', this.peerConnection.iceGatheringState);
        };

        // Xử lý remote stream
        this.peerConnection.ontrack = (event) => {
            console.log('Received remote track:', event.track.kind);
            if (event.streams && event.streams[0]) {
                console.log('Setting remote stream');
                if (this.onRemoteStreamReceived) {
                    this.onRemoteStreamReceived(event.streams[0]);
                }
            }
        };

        // Xử lý trạng thái kết nối
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'failed') {
                console.log('Connection failed - restarting ICE');
                this.peerConnection.restartIce();
            }
        };
    }

    async startCall(targetCode) {
        try {
            console.log('Starting call to:', targetCode);
            this.targetCode = targetCode;
            await this.createPeerConnection();
    
            // Tạo offer
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            // Đặt offer làm local description TRƯỚC KHI gửi
            await this.peerConnection.setLocalDescription(offer);
            console.log('Set local description (offer):', offer.type);
    
            // Chờ một chút để đảm bảo ICE gathering hoàn tất
            await this.waitForIceGathering();
    
            // Gửi offer với ICE candidates đã được thu thập
            this.sendToSignalingServer({
                type: 'call-offer',
                target: targetCode,
                offer: this.peerConnection.localDescription
            });
    
            console.log('Offer created and sent');
        } catch (error) {
            console.error('Error in startCall:', error);
            if (this.onError) {
                this.onError(error);
            }
        }
    }

    async handleCallOffer(message) {
        try {
            console.log('Received offer from:', message.from);
            const { from, offer } = message;
    
            if (this.onCallReceived) {
                this.onCallReceived(message);
            }
    
            this.targetCode = from;
            await this.createPeerConnection();
            
            // Set remote description TRƯỚC
            const remoteDesc = new RTCSessionDescription(offer);
            await this.peerConnection.setRemoteDescription(remoteDesc);
            console.log('Set remote description (offer)');
    
            // Sau đó tạo và set local description
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            console.log('Set local description (answer)');
    
            // Chờ ICE gathering hoàn tất
            await this.waitForIceGathering();
    
            // Gửi answer
            this.sendToSignalingServer({
                type: 'call-answer',
                target: from,
                answer: this.peerConnection.localDescription
            });
            console.log('Answer created and sent');
        } catch (error) {
            console.error('Error in handleCallOffer:', error);
            if (this.onError) {
                this.onError(error);
            }
        }
    }

    async handleCallAnswer(message) {
        try {
            console.log('Received answer from:', message.from);
            const { answer } = message;
    
            if (!answer || !answer.type) {
                console.error('Invalid answer received:', answer);
                return;
            }
    
            if (this.peerConnection) {
                const remoteDesc = new RTCSessionDescription(answer);
                await this.peerConnection.setRemoteDescription(remoteDesc);
                console.log('Set remote description (answer)');
                
                // Xử lý các ICE candidates đã được buffer
                await this.processPendingIceCandidates();
            } else {
                console.error('No peer connection available');
            }
        } catch (error) {
            console.error('Error in handleCallAnswer:', error);
            if (this.onError) {
                this.onError(error);
            }
        }
    }

    // Hàm đợi ICE gathering hoàn tất
    async waitForIceGathering() {
        if (this.peerConnection.iceGatheringState === 'complete') {
            return;
        }

        return new Promise((resolve) => {
            const checkState = () => {
                if (this.peerConnection.iceGatheringState === 'complete') {
                    this.peerConnection.removeEventListener('icegatheringstatechange', checkState);
                    resolve();
                }
            };

            this.peerConnection.addEventListener('icegatheringstatechange', checkState);

            // Thêm timeout để tránh đợi quá lâu
            setTimeout(resolve, 2000);
        });
    }

    async handleNewICECandidate(message) {
        try {
            const { candidate } = message;
            if (this.peerConnection && candidate) {
                // Đợi cho đến khi remote description được set
                if (this.peerConnection.remoteDescription === null) {
                    console.log('Buffering ICE candidate vì remote description chưa sẵn sàng');
                    if (!this.iceCandidatesBuffer) {
                        this.iceCandidatesBuffer = [];
                    }
                    this.iceCandidatesBuffer.push(candidate);
                    return;
                }
    
                console.log('Adding received ICE candidate');
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('Successfully added ICE candidate');
            }
        } catch (error) {
            console.error('Error adding received ICE candidate:', error);
            if (this.onError) {
                this.onError(error);
            }
        }
    }
    
    // Hàm xử lý các candidate đã được buffer
    async processPendingIceCandidates() {
        if (this.iceCandidatesBuffer && this.iceCandidatesBuffer.length > 0) {
            console.log('Processing pending ICE candidates:', this.iceCandidatesBuffer.length);
            while (this.iceCandidatesBuffer.length) {
                const candidate = this.iceCandidatesBuffer.shift();
                try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log('Added buffered ICE candidate');
                } catch (error) {
                    console.error('Error adding buffered ICE candidate:', error);
                }
            }
        }
    }

    sendToSignalingServer(message) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(message));
        } else {
            console.error('WebSocket không ở trạng thái mở');
        }
    }

    endCall() {
        try {
            // Dừng tất cả tracks trong localStream
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    track.stop();
                });
                this.localStream = null;
            }
    
            // Đóng peer connection
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }
    
            // Đóng WebSocket
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                this.websocket.close();
                this.websocket = null;
            }
    
            this.targetCode = null;
        } catch (error) {
            console.error('Lỗi khi kết thúc cuộc gọi:', error);
        }
    }
}

module.exports = WebRTCHandler;