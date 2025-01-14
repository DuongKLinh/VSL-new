from services.videoprocess_service import VideoProcessor
from services.signrecognition_service import SignRecognition
from preparation.modeling import CNNLSTMModel # test
import json
import numpy as np

with open('./dataset/labels.json', 'r', encoding='utf-8') as file:
    labels_json = json.load(file)

num_classes = len(labels_json)

model_path = './preparation/results/best.keras'
cnn_lstm_model = CNNLSTMModel(input_shape=(60, 84), num_classes=num_classes)
cnn_lstm_model.load_model_from_file(model_path)
# Initialize the VideoProcessor and SignRecognition
video_processor = VideoProcessor()
data_X, frames = video_processor.process_video_from_path("D:/Final_Project/VSL-Translator-Duong/output_video.mp4")

# Initialize the SignRecognition class with the model path
sign_recognition = SignRecognition(cnn_lstm_model)
# Predict the sign label from the processed coordinates
predicted_index = sign_recognition.predict(data_X)

print(predicted_index)