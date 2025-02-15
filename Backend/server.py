from services.videoprocess_service import VideoProcessor 
from services.signrecognition_service import SignRecognition
from preparation.modeling import CNNLSTMModel
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from PIL import Image
from io import BytesIO
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import base64
from datetime import datetime
import os
import json
from services.speech_service import SpeechToTextService
import asyncio

# Khởi tạo ứng dụng FastAPI
app = FastAPI()

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Khởi tạo service
stt_service = SpeechToTextService()

# Định nghĩa model request
class VideoFramesRequest(BaseModel):
    frames: List[str]  # List các frame dạng base64

# Khởi tạo model và các service
with open('./dataset/labels.json', 'r', encoding='utf-8') as file:
    labels_json = json.load(file)

num_classes = len(labels_json)
model_path = './preparation/results/best.keras'
cnn_lstm_model = CNNLSTMModel(input_shape=(60, 84), num_classes=num_classes)
cnn_lstm_model.load_model_from_file(model_path)
video_processor = VideoProcessor()
sign_recognition = SignRecognition(cnn_lstm_model)

def get_label_by_index(index):
    for key, value in labels_json.items():
        if value["index"] == index:
            return value["label_with_diacritics"]
    return 'Unlearned'

def decode_base64_image(base64_str: str) -> np.ndarray:
    """
    Decode a base64 string to an OpenCV image (NumPy array).
    """
    base64_str = base64_str.split("data:image/jpeg;base64,")[-1]
    img_data = base64.b64decode(base64_str)
    img = Image.open(BytesIO(img_data))
    frame = np.array(img)
    frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
    return frame
    
def extract_frames_from_base64s(data):
    frames = []
    for base64_image in data.frames:
        frame = decode_base64_image(base64_image)
        frames.append(frame)
    return frames

def save_frames_to_folder(frames, predicted_label):
    # Tạo tên folder theo định dạng yyyy-mm-dd_hhmmss
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    folder_name = f"saved_frames/{timestamp}_{predicted_label}"
    
    # Tạo folder nếu chưa tồn tại
    os.makedirs(folder_name, exist_ok=True)
    
    for idx, frame_base64 in enumerate(frames):
        # Bỏ phần header của base64 string nếu có
        if "base64," in frame_base64:
            frame_base64 = frame_base64.split("base64,")[1]
            
        # Decode base64 thành image
        img_data = base64.b64decode(frame_base64)
        nparr = np.frombuffer(img_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Lưu frame
        frame_path = os.path.join(folder_name, f"frame_{idx:03d}.jpg")
        cv2.imwrite(frame_path, frame)
    
    return folder_name

@app.post("/api/process-frames")
async def process_frames(request: VideoFramesRequest):
    try:
        frames = extract_frames_from_base64s(request)
        data_X, processed_frames, frames_with_hands = video_processor.process_video_from_frames(frames)
        
        # Kiểm tra xem có frame nào có bàn tay không
        if frames_with_hands == 0:
            print("Không phát hiện bàn tay trong frames")
            return {"status": "no_hand_detected", "label": None}
            
        # Kiểm tra xem có đủ số frame không
        if len(data_X) < 60:
            print(f"Chưa đủ frames: {len(data_X)}/60")
            return {"status": "insufficient_data", "label": None}
            
        # Thực hiện dự đoán
        predicted_index = sign_recognition.predict(data_X)
        
        if predicted_index is None:
            return {"status": "prediction_failed", "label": None}
            
        # Lấy label text
        label = get_label_by_index(predicted_index)
        print(f"Dự đoán thành công: {label} (có {frames_with_hands}/60 frames chứa bàn tay)")

        return {
            "status": "success", 
            "label": label,
            "frames_with_hands": frames_with_hands
        }
        
    except Exception as e:
        print(f"Lỗi xử lý frames: {str(e)}")
        raise HTTPException(status_code=400, detail=f"{str(e)}")

# Thêm endpoint mới
@app.post("/api/start-speech-recognition")
async def start_speech_recognition():
    try:
        stt_service.start_listening()
        return {"status": "success", "message": "Speech recognition started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/stop-speech-recognition")
async def stop_speech_recognition():
    try:
        stt_service.stop_listening()
        return {"status": "success", "message": "Speech recognition stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/get-speech-text")
async def get_speech_text():
    try:
        text = stt_service.get_recognized_text()
        return {"status": "success", "text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)