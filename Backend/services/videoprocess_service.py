import cv2
import numpy as np
import mediapipe as mp
from pathlib import Path
import os

def export_frames_with_coordinates(frames, coordinates, output_folder, prefix="frame"):
    """
    Export frames with hand coordinates drawn on them as images to a folder.

    Args:
        frames (list of numpy.ndarray): List of frames to export.
        coordinates (list of list[tuple]): List of coordinates for each frame. Each frame's coordinates should be a list of (x, y) tuples.
        output_folder (str): Folder where images will be saved.
        prefix (str): Prefix for image filenames (default: 'frame').

    Returns:
        None
    """
    if not frames:
        raise ValueError("The frame list is empty.")
    if len(frames) != len(coordinates):
        raise ValueError("The number of frames and coordinates must match.")

    # Create the output folder if it doesn't exist
    os.makedirs(output_folder, exist_ok=True)
    
    # Iterate through each frame and its corresponding coordinates
    for idx, (frame, frame_coordinates) in enumerate(zip(frames, coordinates)):
        # Draw each coordinate on the frame
        for x, y in frame_coordinates:
            cv2.circle(frame, (int(x*frame.shape[1]), int(y*frame.shape[0])), radius=5, color=(0, 255, 0), thickness=-1)
        # Save the modified frame as an image
        filename = os.path.join(output_folder, f"{prefix}_{idx:04d}.png")
        cv2.imwrite(filename, frame)

    print(f"Exported {len(frames)} frames with coordinates to the folder '{output_folder}'.")


class VideoProcessor:
    def __init__(self, frame_size=60):
        self.frame_size = frame_size
        self.mp_hands = mp.solutions.hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.3,  # Giảm xuống để tăng độ nhạy
            min_tracking_confidence=0.3,    # Thêm tham số này
            model_complexity=0  # Thêm model_complexity=0 để tăng tốc độ xử lý
        )
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles

    def process_video_from_path(self, video_path):
        """
        Processes the video, extracts 60 frames, and tracks hand coordinates.

        :return: data_X (list of hand coordinates for each frame), frames (list of frames).
        """
        frames = self._extract_frames_from_path(video_path, self.frame_size)
        data_X = [self._extract_hand_coordinates(frame) for frame in frames]
        
        export_frames_with_coordinates(frames, data_X, output_folder="output1", prefix="frame")

        return data_X, frames
    
    def process_video_from_frames(self, frames):
        data_X = []
        valid_frames = []
        frames_with_hands = 0
        
        print(f"Bắt đầu xử lý {len(frames)} frames...")
        
        for frame in frames:
            coordinates = self._extract_hand_coordinates(frame)
            # Kiểm tra xem frame có bàn tay không bằng cách tìm tọa độ khác [-1, -1]
            has_hand = any(coord != [-1, -1] for coord in coordinates)
            
            if has_hand:
                frames_with_hands += 1
                
            data_X.append(coordinates)
            valid_frames.append(frame)
                
        print(f"Phát hiện được bàn tay trong {frames_with_hands}/{len(frames)} frames")
                
        return data_X, valid_frames, frames_with_hands

    def _extract_frames_from_path(self, video_path, num_frames):
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

    def _extract_hand_coordinates(self, frame):
        """
        Extract hand landmarks from a frame using MediaPipe. If hands are not detected,
        return default coordinates instead of None.
        """
        if frame is None:
            return [[-1, -1]] * 42  # Default coordinates for no hand

        results = self.mp_hands.process(frame)
        coordinates = []
        
        # Vẽ xương bàn tay nếu phát hiện được
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                # Vẽ các điểm mốc và kết nối
                self.mp_drawing.draw_landmarks(
                    frame,
                    hand_landmarks,
                    mp.solutions.hands.HAND_CONNECTIONS,
                    self.mp_drawing_styles.get_default_hand_landmarks_style(),
                    self.mp_drawing_styles.get_default_hand_connections_style()
                )
                
                # Thu thập tọa độ
                for lm in hand_landmarks.landmark:
                    coordinates.append([lm.x, lm.y])

        # Điền thêm tọa độ mặc định nếu thiếu
        while len(coordinates) < 42:  # Đảm bảo đủ 42 điểm cho 2 bàn tay
            coordinates.append([-1, -1])
            
        return coordinates  # Luôn trả về tọa độ, dù có bàn tay hay không

if __name__ == "__main__":
    video_path = '../test.mp4'

    # Create a VideoProcessor instance
    video_processor = VideoProcessor(video_path)

    # Process the video to extract coordinates and frames
    data_X, frames = video_processor.process_video()

    # data_X contains the coordinates of hands in each frame, and frames contains the frames themselves
    print("Number of frames:", len(frames))
    print("Sample hand coordinates for the first frame:", np.array(data_X).shape)