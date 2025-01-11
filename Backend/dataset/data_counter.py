import os
import matplotlib.pyplot as plt

class DatasetAnalyzer:
    def __init__(self, data_folder):
        self.data_folder = data_folder

    def analyze_data(self):
        label_counts = {}

        # Iterate through subfolders to count videos
        for label in os.listdir(self.data_folder):
            label_path = os.path.join(self.data_folder, label)
            if os.path.isdir(label_path):
                videos = [file for file in os.listdir(label_path) if file.endswith(('.mp4', '.avi', '.mkv'))]
                label_counts[label] = len(videos)

        return label_counts

    def plot_and_save_charts(self, label_counts):
        labels = list(label_counts.keys())
        counts = list(label_counts.values())

        # Plot bar chart
        plt.figure(figsize=(10, 6))
        plt.bar(labels, counts, color='skyblue')
        plt.xlabel('Labels')
        plt.ylabel('Number of Videos')
        plt.title('Number of Videos per Label (Bar Chart)')
        plt.xticks(rotation=45, ha='right')
        for i, count in enumerate(counts):
            plt.text(i, count + 1, str(count), ha='center')
        plt.tight_layout()
        plt.savefig('bar_chart.png')
        plt.close()

        # Plot line chart
        plt.figure(figsize=(10, 6))
        plt.plot(labels, counts, marker='o', linestyle='-', color='skyblue')
        plt.xlabel('Labels')
        plt.ylabel('Number of Videos')
        plt.title('Number of Videos per Label (Line Chart)')
        plt.xticks(rotation=45, ha='right')
        for i, count in enumerate(counts):
            plt.text(i, count + 1, str(count), ha='center')
        plt.tight_layout()
        plt.savefig('line_chart.png')
        plt.close()

if __name__ == "__main__":
    data_folder = 'data'  # Adjust the path to your data folder
    analyzer = DatasetAnalyzer(data_folder)

    # Analyze data and plot charts
    label_counts = analyzer.analyze_data()
    print("Video counts per label:", label_counts)
    analyzer.plot_and_save_charts(label_counts)
