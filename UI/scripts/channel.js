class ChannelView {
    static messageStore = {};

    constructor(groupName, channelName) {
        this.groupName = groupName;
        this.channelName = channelName;
        this.channelId = `${groupName}_${channelName}`; // Tạo ID duy nhất cho mỗi kênh

        // Khởi tạo cấu trúc lưu trữ tin nhắn theo nhóm nếu chưa tồn tại
        if (!ChannelView.messageStore[this.groupName]) {
            ChannelView.messageStore[this.groupName] = {};
        }
        
        // Khởi tạo mảng tin nhắn cho kênh trong nhóm nếu chưa tồn tại
        if (!ChannelView.messageStore[this.groupName][this.channelName]) {
            ChannelView.messageStore[this.groupName][this.channelName] = [];
        }

        this.init();
    }

    init() {
        console.log(`Khởi tạo giao diện cho kênh: ${this.channelName} trong nhóm: ${this.groupName}`);
        this.updateChannelInfo();
        this.setupChatInput();
        this.loadMessages();
    }

    updateChannelInfo() {
        const channelHeader = document.querySelector('.chat-header .channel-info .channel-name');
        const chatInput = document.querySelector('.chat-input');
        
        if (channelHeader) {
            channelHeader.textContent = this.channelName;
        }
        
        if (chatInput) {
            chatInput.placeholder = `Gửi tin nhắn tới #${this.channelName}`;
        }
    }

    loadMessages() {
        const messagesContainer = document.querySelector('.chat-messages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
            // Lấy tin nhắn từ kênh cụ thể trong nhóm cụ thể
            const messages = ChannelView.messageStore[this.groupName][this.channelName];
            messages.forEach(message => {
                const messageDiv = document.createElement('div');
                messageDiv.classList.add('message');
                messageDiv.innerHTML = `
                    <div class="message-content">
                        <div class="message-text">${message}</div>
                    </div>
                `;
                messagesContainer.appendChild(messageDiv);
            });
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    setupChatInput() {
        const chatInput = document.querySelector('.chat-input');
        const messagesContainer = document.querySelector('.chat-messages');

        if (chatInput && messagesContainer) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && e.target.value.trim() !== '') {
                    // Lưu tin nhắn vào store theo nhóm và kênh
                    ChannelView.messageStore[this.groupName][this.channelName].push(e.target.value);
                    
                    const messageDiv = document.createElement('div');
                    messageDiv.classList.add('message');
                    messageDiv.innerHTML = `
                        <div class="message-content">
                            <div class="message-text">${e.target.value}</div>
                        </div>
                    `;
                    messagesContainer.appendChild(messageDiv);
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    e.target.value = '';
                }
            });
        }
    }
}

module.exports = ChannelView;