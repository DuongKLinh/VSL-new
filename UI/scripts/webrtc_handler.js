// webrtc_handler.js

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

class WebRTCHandler {
    constructor(userCode) {
        this.userCode = userCode;
        this.retryCount = 0;
        // Cấu hình ICE servers
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        };

        // Các biến quản lý trạng thái
        this.userCode = userCode;
        this.peerConnection = null;
        this.localStream = null;
        this.websocket = null;
        this.targetCode = null;

        // Callback cho remote stream
        this.onRemoteStreamReceived = null;
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
                const wsUrl = `ws://localhost:8765/ws/${this.userCode}`;
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
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });

        // Xử lý ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendToSignalingServer({
                    type: 'call-candidate',
                    target: this.targetCode,
                    candidate: event.candidate
                });
            }
        };

        // Xử lý remote stream
        this.peerConnection.ontrack = (event) => {
            if (this.onRemoteStreamReceived) {
                this.onRemoteStreamReceived(event.streams[0]);
            }
        };

        // Xử lý trạng thái kết nối
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Trạng thái kết nối:', this.peerConnection.connectionState);
        };
    }

    async startCall(targetCode) {
        try {
            this.targetCode = targetCode;
            await this.createPeerConnection();

            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            await this.peerConnection.setLocalDescription(offer);

            this.sendToSignalingServer({
                type: 'call-offer',
                target: targetCode,
                offer: offer
            });
        } catch (error) {
            console.error('Lỗi bắt đầu cuộc gọi:', error);
        }
    }

    async handleCallOffer(message) {
        try {
            const { from, offer } = message;
            this.targetCode = from;
            await this.createPeerConnection();
            
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.sendToSignalingServer({
                type: 'call-answer',
                target: from,
                answer: answer
            });
        } catch (error) {
            console.error('Lỗi xử lý offer:', error);
        }
    }

    async handleCallAnswer(message) {
        try {
            const { answer } = message;
            if (this.peerConnection) {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            }
        } catch (error) {
            console.error('Lỗi xử lý answer:', error);
        }
    }

    async handleNewICECandidate(message) {
        try {
            const { candidate } = message;
            if (this.peerConnection) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (error) {
            console.error('Lỗi xử lý ICE candidate:', error);
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
        // Đóng peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Đóng WebSocket
        if (this.websocket) {
            this.websocket.close();
        }

        // Dừng local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }

        this.targetCode = null;
    }
}

module.exports = WebRTCHandler;