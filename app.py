import sys
import subprocess
from threading import Thread

class VSLTranslator:
    def __init__(self):
        self.electron_process = None

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

    def run(self):
        """Chạy ứng dụng"""
        try:
            self.start_electron_app()
            # Giữ cho chương trình chạy
            self.electron_process.wait()
        except KeyboardInterrupt:
            print("Đang dừng hệ thống...")
        finally:
            self.cleanup()

    def cleanup(self):
        """Dọn dẹp tài nguyên khi kết thúc"""
        if self.electron_process:
            self.electron_process.terminate()

if __name__ == "__main__":
    translator = VSLTranslator()
    translator.run()