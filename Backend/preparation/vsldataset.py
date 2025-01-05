import numpy as np
import tensorflow as tf
import os
from sklearn.model_selection import train_test_split

os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

class VSLDataset:
    def __init__(self, numpy_x_file, numpy_y_file):
        self.numpy_x_file = numpy_x_file
        self.numpy_y_file = numpy_y_file

    def create_datasets(self, test_size=0.2, batch_size=32):
        data_X = np.load(self.numpy_x_file, allow_pickle=True)
        data_Y = np.load(self.numpy_y_file)

        # Reshape data_X for LSTM: (batch_size, timesteps, features)
        data_X = np.array(data_X, dtype=np.float32).reshape(data_X.shape[0], data_X.shape[1], -1)
        data_Y = np.array(data_Y, dtype=np.float32).reshape(-1, 1)  # Ensure data_Y is 2D for regression

        # Split into train and test datasets
        X_train, X_test, y_train, y_test = train_test_split(data_X, data_Y, test_size=test_size, random_state=42)

        train_dataset = tf.data.Dataset.from_tensor_slices((X_train, y_train))
        train_dataset = train_dataset.shuffle(len(y_train)).batch(batch_size).prefetch(tf.data.AUTOTUNE)

        test_dataset = tf.data.Dataset.from_tensor_slices((X_test, y_test))
        test_dataset = test_dataset.batch(batch_size).prefetch(tf.data.AUTOTUNE)

        return train_dataset, test_dataset

if __name__ == "__main__":
    # Step 2: Load the dataset for TensorFlow
    dataset = VSLDataset(numpy_x_file='../dataset/data_X.npy', numpy_y_file='../dataset/data_Y.npy')
    train_dataset, test_dataset = dataset.create_datasets(test_size=0.2, batch_size=32)

    # Example of using the dataset for training
    for frames, labels in train_dataset:
        print(frames.shape, labels.shape)  # Output: (batch_size, 60, 21, 3), (batch_size,)
