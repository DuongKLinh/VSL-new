from fastapi import WebSocket
from typing import Dict, Optional
import json

class WebSocketHandler:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_code: str):
        """Xử lý kết nối mới"""
        await websocket.accept()
        self.active_connections[user_code] = websocket
        print(f"User {user_code} connected. Total users: {len(self.active_connections)}")

    def disconnect(self, user_code: str):
        """Xử lý ngắt kết nối"""
        if user_code in self.active_connections:
            del self.active_connections[user_code]
            print(f"User {user_code} disconnected. Total users: {len(self.active_connections)}")

    def get_connection(self, user_code: str) -> Optional[WebSocket]:
        """Lấy kết nối WebSocket của một user"""
        return self.active_connections.get(user_code)

    async def broadcast(self, message: dict, exclude: Optional[str] = None):
        """Gửi tin nhắn đến tất cả users (trừ người gửi)"""
        for code, connection in self.active_connections.items():
            if code != exclude:
                await connection.send_json(message)

    async def handle_call_offer(self, from_code: str, target_code: str, offer: dict):
        """Xử lý yêu cầu cuộc gọi"""
        target_connection = self.get_connection(target_code)
        if target_connection:
            await target_connection.send_json({
                "type": "call-offer",
                "from": from_code,
                "offer": offer
            })
            return True
        return False

    async def handle_call_answer(self, from_code: str, target_code: str, answer: dict):
        """Xử lý trả lời cuộc gọi"""
        target_connection = self.get_connection(target_code)
        if target_connection:
            await target_connection.send_json({
                "type": "call-answer",
                "from": from_code,
                "answer": answer
            })
            return True
        return False

    async def handle_call_candidate(self, from_code: str, target_code: str, candidate: dict):
        """Xử lý trao đổi ICE candidates"""
        target_connection = self.get_connection(target_code)
        if target_connection:
            await target_connection.send_json({
                "type": "call-candidate",
                "from": from_code,
                "candidate": candidate
            })
            return True
        return False

    async def handle_call_reject(self, from_code: str, target_code: str):
        """Xử lý từ chối cuộc gọi"""
        target_connection = self.get_connection(target_code)
        if target_connection:
            await target_connection.send_json({
                "type": "call-reject",
                "from": from_code
            })
            return True
        return False

    async def handle_call_end(self, from_code: str, target_code: str):
        """Xử lý kết thúc cuộc gọi"""
        target_connection = self.get_connection(target_code)
        if target_connection:
            await target_connection.send_json({
                "type": "call-end",
                "from": from_code
            })
            return True
        return False

    async def send_error(self, websocket: WebSocket, message: str):
        """Gửi thông báo lỗi"""
        await websocket.send_json({
            "type": "error",
            "message": message
        })
    
    async def handle_call_offer(self, from_code: str, target_code: str, offer: dict):
        """Xử lý yêu cầu cuộc gọi"""
        target_connection = self.get_connection(target_code)
        if target_connection:
            await target_connection.send_json({
                "type": "call-offer",
                "from": from_code,
                "offer": offer
            })
            return True
        else:
            # Thông báo cho người gọi rằng người nhận không online
            from_connection = self.get_connection(from_code)
            if from_connection:
                await from_connection.send_json({
                    "type": "error",
                    "message": "Người dùng không trực tuyến hoặc không tồn tại"
                })
            return False