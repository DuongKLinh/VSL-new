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

        this.dataChannel = null;
        this.onTextReceived = null;
    }

    async initialize(localStream) {
        try {
            // Đảm bảo đóng kết nối cũ
            if (this.websocket) {
                if (this.websocket.readyState === WebSocket.OPEN) {
                    this.websocket.close(1000, "Cleanup before new connection");
                }
                this.websocket = null;
                // Đợi một chút để đảm bảo socket được đóng hoàn toàn
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
    
            this.localStream = localStream;
            await this.connectSignalingServerWithRetry();
            console.log('WebRTC Handler đã được khởi tạo thành công');
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
                // Đóng kết nối cũ nếu còn tồn tại
                if (this.websocket) {
                    this.websocket.close();
                    this.websocket = null;
                }
    
                const currentIP = window.location.hostname || "localhost";
                // const wsUrl = `ws://${currentIP}:8765/ws/${this.userCode}`;
                const wsUrl = `wss://db0b-1-53-63-184.ngrok-free.app/ws/${this.userCode}`;

                console.log('Đang kết nối tới:', wsUrl);
                
                this.websocket = new WebSocket(wsUrl);
                
                // Thêm timeout để tránh treo
                const connectionTimeout = setTimeout(() => {
                    if (this.websocket.readyState !== WebSocket.OPEN) {
                        this.websocket.close();
                        reject(new Error('Kết nối timeout'));
                    }
                }, 5000);
                
                this.websocket.onopen = () => {
                    console.log('Đã kết nối thành công tới Signaling Server');
                    clearTimeout(connectionTimeout);
                    this.setupWebSocketHandlers();
                    resolve();
                };
    
                this.websocket.onerror = (error) => {
                    console.error('Lỗi WebSocket:', error);
                    clearTimeout(connectionTimeout);
                    reject(new Error(`Không thể kết nối tới Signaling Server: ${error.message}`));
                };
    
                this.websocket.onclose = (event) => {
                    console.log('WebSocket đã đóng:', event.code, event.reason);
                    clearTimeout(connectionTimeout);
                    if (!event.wasClean) {
                        this.reconnectToSignalingServer();
                    }
                };
    
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
        // Đóng kết nối cũ nếu tồn tại
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
            // Đợi một chút để đảm bảo cleanup hoàn toàn
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    
        console.log('Creating new RTCPeerConnection');
        this.peerConnection = new RTCPeerConnection(this.configuration);
        
        if (this.peerConnection) {
            this.dataChannel = this.peerConnection.createDataChannel("textChannel");
            this.setupDataChannel(this.dataChannel);
            
            this.peerConnection.ondatachannel = (event) => {
                this.dataChannel = event.channel;
                this.setupDataChannel(this.dataChannel);
            };
        }

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
                if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                    this.sendToSignalingServer({
                        type: 'call-candidate',
                        target: this.targetCode,
                        candidate: event.candidate
                    });
                } else {
                    console.warn('WebSocket not ready, cannot send ICE candidate');
                }
            }
        };
    
        // Theo dõi trạng thái ICE
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
            if (this.peerConnection.iceConnectionState === 'failed') {
                console.log('ICE connection failed - attempting to restart');
                this.peerConnection.restartIce();
            }
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
    
        // Theo dõi trạng thái kết nối
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'failed') {
                console.log('Connection failed - attempting to reconnect');
                this.reconnect();
            }
        };
    }

    setupDataChannel(channel) {
        channel.onmessage = (event) => {
            if (this.onTextReceived) {
                this.onTextReceived(event.data);
            }
        };
    }
    
    // method gửi text
    sendText(text) {
        if (this.dataChannel && this.dataChannel.readyState === "open") {
            this.dataChannel.send(text);
        }
    }

    async reconnect() {
        try {
            console.log('Attempting to reconnect...');
            
            // Đóng kết nối cũ
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }
            
            // Đóng WebSocket cũ
            if (this.websocket) {
                if (this.websocket.readyState === WebSocket.OPEN) {
                    this.websocket.close(1000, "Reconnecting");
                }
                this.websocket = null;
            }
    
            // Đợi cleanup
            await new Promise(resolve => setTimeout(resolve, 1000));
    
            // Khởi tạo lại kết nối
            await this.initialize(this.localStream);
            
            // Nếu đang trong cuộc gọi, khởi tạo lại
            if (this.targetCode) {
                await this.startCall(this.targetCode);
            }
        } catch (error) {
            console.error('Reconnection failed:', error);
            if (this.onError) {
                this.onError(error);
            }
        }
    }

    async startCall(targetCode) {
        try {
            console.log('Starting call to:', targetCode);
            this.targetCode = targetCode;
    
            // Tạo peer connection mới nếu chưa có hoặc đã bị đóng
            if (!this.peerConnection || this.peerConnection.connectionState === 'closed') {
                await this.createPeerConnection();
            }
    
            console.log('Creating offer...');
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            console.log('Setting local description...');
            await this.peerConnection.setLocalDescription(offer);
    
            // Đợi ICE gathering hoàn tất
            await this.waitForIceGathering();
    
            if (this.peerConnection.signalingState === "have-local-offer") {
                console.log('Sending offer to:', targetCode);
                this.sendToSignalingServer({
                    type: 'call-offer',
                    target: targetCode,
                    offer: this.peerConnection.localDescription
                });
            } else {
                console.warn('Unexpected signaling state:', this.peerConnection.signalingState);
            }
    
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
    
            if (!this.peerConnection || this.peerConnection.connectionState === 'closed') {
                await this.createPeerConnection();
            }
    
            console.log('Current signaling state:', this.peerConnection.signalingState);
            
            // if (this.peerConnection.signalingState !== "stable") {
            //     console.log('Rolling back...');
            //     await Promise.all([
            //         this.peerConnection.setLocalDescription({type: "rollback"}),
            //         this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
            //     ]);
            // } else {
            //     await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            // }
            if (this.peerConnection.signalingState !== "stable") {
                console.log('Rolling back before setting new remote description...');
                try {
                    await this.peerConnection.setLocalDescription({ type: "rollback" });
                } catch (rollbackError) {
                    console.warn('Rollback failed:', rollbackError);
                }
            }
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            await this.processPendingIceCandidates();
    
            console.log('Creating answer...');
            const answer = await this.peerConnection.createAnswer();
            
            console.log('Setting local description...');
            await this.peerConnection.setLocalDescription(answer);
    
            console.log('Sending answer...');
            this.sendToSignalingServer({
                type: 'call-answer',
                target: from,
                answer: this.peerConnection.localDescription
            });
    
        } catch (error) {
            console.error('Error in handleCallOffer:', error);
        }
    }
    

    async handleCallAnswer(message) {
        try {
            console.log('Received answer from:', message.from);
            const { answer } = message;
    
            if (!this.peerConnection) {
                throw new Error('No peer connection available');
            }
    
            let attempt = 0;
            while (this.peerConnection.signalingState !== "have-local-offer" && attempt < 5) {
                console.log("Waiting for signaling state to be 'have-local-offer'...");
                await new Promise(resolve => setTimeout(resolve, 100));
                attempt++;
            }
    
            const currentState = this.peerConnection.signalingState;
            console.log('Current signaling state:', currentState);
    
            if (currentState === "have-local-offer") {
                console.log('Setting remote description with answer...');
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                console.log('Remote description set successfully.');
            } else {
                console.warn('Unexpected signaling state for answer:', currentState);
            }
    
        } catch (error) {
            console.error('Error in handleCallAnswer:', error);
        }
    }
    

    isConnectionActive() {
        return this.peerConnection && 
               this.peerConnection.connectionState !== 'closed' &&
               this.peerConnection.connectionState !== 'failed' &&
               this.websocket &&
               this.websocket.readyState === WebSocket.OPEN;
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
            }
        } catch (error) {
            console.error('Error adding received ICE candidate:', error);
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
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            console.error('WebSocket không ở trạng thái mở');
            if (this.onError) {
                this.onError(new Error('Mất kết nối WebSocket'));
            }
            return;
        }
        try {
            this.websocket.send(JSON.stringify(message));
        } catch (error) {
            console.error('Lỗi gửi message:', error);
            if (this.onError) {
                this.onError(error);
            }
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
    
            // Đóng WebSocket và đảm bảo cleanup
            if (this.websocket) {
                if (this.websocket.readyState === WebSocket.OPEN) {
                    this.websocket.close(1000, "Kết thúc cuộc gọi");
                }
                this.websocket = null;
            }
    
            this.targetCode = null;
            this.retryCount = 0;
        } catch (error) {
            console.error('Lỗi khi kết thúc cuộc gọi:', error);
        }
    }
}

module.exports = WebRTCHandler;