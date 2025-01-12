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

@app.post("/api/process-frames")
async def process_frames(request: VideoFramesRequest):
    try:
        frames = []
        predicted_index = 0
        frames = extract_frames_from_base64s(request)
        
        data_X, _ = video_processor.process_video_from_frames(frames)
        sign_recognition = SignRecognition(cnn_lstm_model)
        
        predicted_index = sign_recognition.predict(data_X)
        
        # Lấy nhãn tương ứng với index
        predicted_label = get_label_by_index(predicted_index)
        print(f"Predicted label: {predicted_label}")

        return {
            "status": "success", 
            "label": predicted_label  # Trả về tên nhãn thay vì index
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"{e}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)