import sys
import subprocess
from threading import Thread
import uvicorn
# Sửa lại import
from Backend.server import app as recognition_app
from signaling.signaling_server import app as signaling_app

class VSLTranslator:
    def __init__(self):
        self.electron_process = None
        self.recognition_server = None
        self.signaling_server = None

    def start_electron_app(self):
        """Khởi động ứng dụng Electron"""
        try:
            self.electron_process = subprocess.Popen(
                ['npm', 'start'],
                cwd='./UI',
                shell=True
            )
        except Exception as e:
            print(f"Lỗi khi khởi động ứng dụng Electron: {e}")
            sys.exit(1)

    def start_recognition_server(self):
        """Khởi động recognition server"""
        try:
            uvicorn.run(recognition_app, host="0.0.0.0", port=8000)
        except Exception as e:
            print(f"Lỗi khi khởi động Recognition Server: {e}")
            sys.exit(1)

    def start_signaling_server(self):
        """Khởi động signaling server"""
        try:
            print("Khởi động Signaling Server...")
            uvicorn.run(
                signaling_app, 
                host="0.0.0.0", 
                port=8765,
                ws="websockets",  # Chỉ định rõ websocket backend
                loop="asyncio"    # Sử dụng asyncio event loop
            )
        except Exception as e:
            print(f"Lỗi khi khởi động Signaling Server: {e}")
            sys.exit(1)

    def run(self):
        """Chạy toàn bộ ứng dụng"""
        try:
            print("Khởi động VSL Translator...")
            
            # Đợi một chút trước khi khởi động các server
            import time
            time.sleep(1)
            
            # Khởi động recognition server trong thread riêng
            print("Khởi động Recognition Server...")
            recognition_thread = Thread(
                target=self.start_recognition_server,
                daemon=True
            )
            recognition_thread.start()
            time.sleep(2)  # Đợi 2 giây
            
            # Khởi động signaling server trong thread riêng
            print("Khởi động Signaling Server...")
            signaling_thread = Thread(
                target=self.start_signaling_server,
                daemon=True
            )
            signaling_thread.start()
            time.sleep(2)  # Đợi 2 giây
            
            # Kiểm tra các server đã sẵn sàng
            if not self.check_servers_ready():
                print("Không thể khởi động các server. Vui lòng kiểm tra lại.")
                sys.exit(1)
            
            # Khởi động Electron app trong main thread
            print("Khởi động giao diện người dùng...")
            self.start_electron_app()
            
            # Đợi cho đến khi Electron app đóng
            self.electron_process.wait()
            
        except KeyboardInterrupt:
            print("\nĐang dừng hệ thống...")
        finally:
            self.cleanup()

    def cleanup(self):
        """Dọn dẹp tài nguyên khi kết thúc"""
        if self.electron_process:
            print("Đóng giao diện người dùng...")
            self.electron_process.terminate()

        print("Đã đóng toàn bộ hệ thống.")

    def check_servers_ready(self):
        """Kiểm tra các server đã sẵn sàng chưa"""
        import requests
        try:
            # Kiểm tra Recognition Server
            recognition_response = requests.get('http://localhost:8000/docs')
            # Kiểm tra Signaling Server
            signaling_response = requests.get('http://localhost:8765/docs')
            return recognition_response.status_code == 200 and signaling_response.status_code == 200
        except:
            return False

if __name__ == "__main__":
    translator = VSLTranslator()
    translator.run()