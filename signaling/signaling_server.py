from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from socket_handler import WebSocketHandler
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Khởi tạo WebSocket handler
socket_handler = WebSocketHandler()

@app.websocket("/ws/{user_code}")
async def websocket_endpoint(websocket: WebSocket, user_code: str):
    try:
        await socket_handler.connect(websocket, user_code)
    
        try:
            while True:
                # Nhận tin nhắn từ client
                data = await websocket.receive_json()
                
                # Lấy thông tin từ tin nhắn
                message_type = data.get("type")
                target_code = data.get("target")
                
                # Xử lý các loại tin nhắn
                if message_type == "call-offer":
                    success = await socket_handler.handle_call_offer(
                        from_code=user_code,
                        target_code=target_code,
                        offer=data.get("offer")
                    )
                    if not success:
                        await socket_handler.send_error(
                            websocket, 
                            f"User {target_code} not found"
                        )

                elif message_type == "call-answer":
                    success = await socket_handler.handle_call_answer(
                        from_code=user_code,
                        target_code=target_code,
                        answer=data.get("answer")
                    )
                    if not success:
                        await socket_handler.send_error(
                            websocket, 
                            f"User {target_code} not found"
                        )

                elif message_type == "call-candidate":
                    success = await socket_handler.handle_call_candidate(
                        from_code=user_code,
                        target_code=target_code,
                        candidate=data.get("candidate")
                    )
                    if not success:
                        await socket_handler.send_error(
                            websocket, 
                            f"User {target_code} not found"
                        )

                elif message_type == "call-reject":
                    success = await socket_handler.handle_call_reject(
                        from_code=user_code,
                        target_code=target_code
                    )
                    if not success:
                        await socket_handler.send_error(
                            websocket, 
                            f"User {target_code} not found"
                        )

                elif message_type == "call-end":
                    success = await socket_handler.handle_call_end(
                        from_code=user_code,
                        target_code=target_code
                    )
                    if not success:
                        await socket_handler.send_error(
                            websocket, 
                            f"User {target_code} not found"
                        )

        except WebSocketDisconnect:
            await socket_handler.disconnect(user_code)
            print(f"Client {user_code} disconnected")
            
        except Exception as e:
            print(f"Error occurred: {e}")
            await socket_handler.disconnect(user_code)

    finally:
        # Đảm bảo cleanup
        if user_code in socket_handler.active_connections:
            await socket_handler.disconnect(user_code)
            
def get_signaling_app():
    """Returns the FastAPI app instance"""
    return app

if __name__ == "__main__":
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8765,
        ws="websockets",  # Chỉ định rõ websocket backend
        loop="asyncio"    # Sử dụng asyncio event loop
    )