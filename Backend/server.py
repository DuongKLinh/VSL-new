from Backend.services.videoprocess_service import VideoProcessor 
from Backend.services.signrecognition_service import SignRecognition
from Backend.preparation.modeling import CNNLSTMModel
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

# Định nghĩa model request
class VideoFramesRequest(BaseModel):
    frames: List[str]  # List các frame dạng base64

# Khởi tạo model và các service
with open('./Backend/dataset/labels.json', 'r', encoding='utf-8') as file:
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
        
        # Xử lý frames để lấy tọa độ và vẽ xương bàn tay
        data_X, processed_frames = video_processor.process_video_from_frames(frames)
        
        # Kiểm tra xem có dữ liệu hợp lệ không
        if not data_X or len(data_X) == 0:
            return {"status": "no_hand_detected", "label": None}
            
        # Thực hiện dự đoán
        predicted_index = sign_recognition.predict(data_X)
        
        if predicted_index is None:
            return {"status": "insufficient_data", "label": None}
            
        # Lấy label text
        label = get_label_by_index(predicted_index)
        
        # Lưu frames đã xử lý
        folder_path = save_frames_to_folder(request.frames, label)
        print(f"Đã lưu frames vào folder: {folder_path}")
        print(f"Nhãn dự đoán: {label}")

        return {"status": "success", "label": label}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"{e}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)