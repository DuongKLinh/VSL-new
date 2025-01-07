import sys
import subprocess
from threading import Thread
import uvicorn
# Sửa lại import
from Backend.server import app as recognition_app
from signaling.signaling_server import app as signaling_app
import argparse
import os
import socket

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
            # Kiểm tra port có sẵn sàng không
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex(('127.0.0.1', 8000))
            if result == 0:
                print("Port 8000 đang được sử dụng. Vui lòng đóng ứng dụng đang sử dụng port này.")
                sys.exit(1)
            sock.close()
            
            # Kiểm tra các file model cần thiết
            model_path = 'Backend/preparation/results/best.keras'
            labels_path = './Backend/dataset/labels.json'
            
            if not os.path.exists(model_path):
                print(f"Không tìm thấy file model tại: {model_path}")
                sys.exit(1)
                
            if not os.path.exists(labels_path):
                print(f"Không tìm thấy file labels tại: {labels_path}")
                sys.exit(1)
                
            print("Tất cả các file cần thiết đã sẵn sàng")
            
            try:
                # Thử import các module cần thiết
                import mediapipe
                import tensorflow
                import fastapi
                print("Đã kiểm tra các thư viện cần thiết")
            except ImportError as e:
                print(f"Thiếu thư viện: {str(e)}")
                print("Vui lòng cài đặt các thư viện bằng lệnh:")
                print("pip install -r requirements.txt")
                sys.exit(1)

            # Nếu mọi thứ OK, khởi động server
            print("Bắt đầu khởi động Recognition Server...")
            uvicorn.run(recognition_app, host="0.0.0.0", port=8000)
        except Exception as e:
            print(f"Lỗi khi khởi động Recognition Server: {str(e)}")
            print("Chi tiết lỗi:", e)
            import traceback
            traceback.print_exc()
            sys.exit(1)

    def start_signaling_server(self):
        """Khởi động signaling server"""
        try:
            print("Khởi động Signaling Server...")
            uvicorn.run(
                signaling_app, 
                host="192.168.1.8", 
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
            
            # Kiểm tra Recognition Server đã sẵn sàng
            if not self.check_servers_ready():
                print("Không thể khởi động Recognition Server. Vui lòng kiểm tra lại.")
                sys.exit(1)
                
            print("Các server đã khởi động thành công.")
            
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
            # Chỉ kiểm tra Recognition Server
            recognition_response = requests.get('http://localhost:8000/docs')
            return recognition_response.status_code == 200
        except:
            return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=['server', 'client'], default='client',
                       help='Chạy ứng dụng ở chế độ server hoặc client')
    args = parser.parse_args()

    translator = VSLTranslator()
    
    if args.mode == 'server':
        # Chế độ server - chạy toàn bộ dịch vụ
        print("Khởi động ở chế độ server...")
        translator.run()
    else:
        # Chế độ client - chỉ chạy giao diện
        print("Khởi động ở chế độ client...")
        translator.start_electron_app()