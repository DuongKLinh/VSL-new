from vosk import Model, KaldiRecognizer
import json
import pyaudio
import threading
import queue
import time
import os

class SpeechToTextService:
    def __init__(self, model_path="../vosk-model-vn-0.4"):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(current_dir, model_path)
        self.model = Model(model_path)
        self.recognizer = KaldiRecognizer(self.model, 16000)
        self.audio = pyaudio.PyAudio()
        self.stream = None
        self.is_listening = False
        self.text_queue = queue.Queue()
        self.listener_thread = None

    def start_listening(self):
        if self.is_listening:
            return
            
        self.is_listening = True
        self.stream = self.audio.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=16000,
            input=True,
            frames_per_buffer=8000
        )
        self.listener_thread = threading.Thread(target=self._listen)
        self.listener_thread.start()

    def stop_listening(self):
        self.is_listening = False
        try:
            if self.stream:
                self.stream.stop_stream()
                self.stream.close()
                self.stream = None
        except Exception as e:
            print(f"Lỗi khi dừng stream: {e}")
        if self.listener_thread:
            self.listener_thread.join(timeout=2)  # Đợi tối đa 2 giây

    def _listen(self):
        while self.is_listening:
            try:
                if not self.stream or not self.stream.is_active():
                    print("Stream không hoạt động, đang thử khởi tạo lại...")
                    try:
                        if self.stream:
                            self.stream.close()
                        self.stream = self.audio.open(
                            format=pyaudio.paInt16,
                            channels=1,
                            rate=16000,
                            input=True,
                            frames_per_buffer=8000
                        )
                    except Exception as e:
                        print(f"Không thể khởi tạo lại stream: {e}")
                        time.sleep(1)  # Đợi 1 giây trước khi thử lại
                        continue

                try:
                    data = self.stream.read(4000, exception_on_overflow=False)
                    if self.recognizer.AcceptWaveform(data):
                        result = json.loads(self.recognizer.Result())
                        if result["text"]:
                            self.text_queue.put(result["text"])
                except IOError as e:
                    print(f"Lỗi đọc từ stream: {e}")
                    time.sleep(0.1)  # Đợi một chút trước khi thử lại
                    continue
                    
            except Exception as e:
                print(f"Lỗi trong speech recognition: {e}")
                time.sleep(1)  # Đợi 1 giây trước khi thử lại
                continue

    def get_recognized_text(self):
        try:
            return self.text_queue.get_nowait()
        except queue.Empty:
            return None