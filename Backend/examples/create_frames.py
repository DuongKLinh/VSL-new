import cv2
import numpy as np
import os

def extract_frames_from_path(video_path, num_frames):
    """
    Extract frames from the video, ensuring there are exactly `num_frames` frames.
    If there are fewer than `num_frames`, append blank frames.

    :param video_path: Path to the video file.
    :param num_frames: Number of frames to extract from the video.
    :return: A list of frames.
    """
    cap = cv2.VideoCapture(str(video_path))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_indices = np.linspace(0, total_frames - 1, num_frames, dtype=int)
    frames = []

    for idx in frame_indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if ret:
            frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        else:
            frames.append(None)  # Add None if frame can't be read

    # If there are fewer frames than expected, add blank frames
    while len(frames) < num_frames:
        frames.append(None)

    cap.release()
    return frames

def save_frames_to_output_folder(frames, output_folder):
    # Ensure the output folder exists
    os.makedirs(output_folder, exist_ok=True)
    
    # Iterate through the list of frames and save each as an image
    for idx, frame in enumerate(frames):
        # Construct the output file path
        output_path = os.path.join(output_folder, f"frame_{idx+1}.jpg")
        
        # Save the frame as an image
        cv2.imwrite(output_path, frame)

frames = extract_frames_from_path('test.mp4', 60)

# output_folder = 'output_frames'

# save_frames_to_output_folder(frames, output_folder)

from services.videoprocess_service import VideoProcessor
from services.signrecognition_service import SignRecognition
from preparation.modeling import CNNLSTMModel # test
import json

with open('./dataset/labels.json', 'r', encoding='utf-8') as file:
    labels_json = json.load(file)

num_classes = len(labels_json)

model_path = './preparation/results/best.keras'
cnn_lstm_model = CNNLSTMModel(input_shape=(60, 84), num_classes=num_classes)
cnn_lstm_model.load_model_from_file(model_path)
video_processor = VideoProcessor()
data_X, frames = video_processor.process_video_from_frames(frames)

# Initialize the SignRecognition class with the model path
sign_recognition = SignRecognition(cnn_lstm_model)
# Predict the sign label from the processed coordinates
predicted_index = sign_recognition.predict(data_X)

print(predicted_index)
