import os
import json
import numpy as np
import tensorflow as tf
import mediapipe as mp
from pathlib import Path

class DataProcessor:
    def __init__(self, data_folder, labels_file, output_x_file, output_y_file, frame_size=60):
        self.data_folder = Path(data_folder)
        self.labels_file = Path(labels_file)
        self.output_x_file = output_x_file
        self.output_y_file = output_y_file
        self.mp_hands = mp.solutions.hands.Hands(static_image_mode=True, max_num_hands=2)
        self.frame_size = frame_size

    def process_videos(self):
        data_X = []
        data_Y = []

        with open(self.labels_file, 'r') as file:
            labels = json.load(file)

        for label_name, label_info in labels.items():
            label_folder = self.data_folder / label_name
            if not label_folder.exists():
                print(f"Label folder {label_folder} not found. Skipping.")
                continue

            for video_file in label_folder.glob("*.mp4"):
                frames = self._extract_frames(video_file, num_frames=self.frame_size)
                coordinates = [self._extract_hand_coordinates(frame) for frame in frames]
                data_X.append(coordinates)
                data_Y.append(int(label_info['index']))

        np.save(self.output_x_file, np.array(data_X, dtype=object))
        np.save(self.output_y_file, np.array(data_Y, dtype=int))

    def _extract_frames(self, video_path, num_frames):
        import cv2

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

        cap.release()
        return frames

    def _extract_hand_coordinates(self, frame):
        if frame is None:
            return [[-1, -1]] * 42  # 21 points per hand, 2 hands

        results = self.mp_hands.process(frame)
        coordinates = []

        for hand_landmarks in results.multi_hand_landmarks or []:
            for lm in hand_landmarks.landmark:
                coordinates.append([lm.x, lm.y])

        # Fill missing points with [-1, -1]
        while len(coordinates) < 42:
            coordinates.append([-1, -1])

        return coordinates
    
if __name__ == "__main__":
    # Example usage:
    # data_processor = DataProcessor(
    #     data_folder="../dataset/data",
    #     labels_file="../dataset/labels.json",
    #     output_x_file="../dataset/data_X.npy",
    #     output_y_file="../dataset/data_Y.npy"
    # )
    # data_processor.process_videos()
    
    data_processor = DataProcessor(
        data_folder="D:/Final_Project/VSL-Translator-Duong/augmented_data",
        labels_file="../dataset/labels.json",
        output_x_file="D:/Final_Project/VSL-Translator-Duong/Backend/dataset/data_X.npy",
        output_y_file="D:/Final_Project/VSL-Translator-Duong/Backend/datasetdata_Y.npy"
    )
    data_processor.process_videos()

