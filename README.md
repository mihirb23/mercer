# Mercer
[![Ask DeepWiki](https://devin.ai/assets/askdeepwiki.png)](https://deepwiki.com/mihirb23/mercer)

Mercer is an intelligent chatbot designed to help you understand your insurance documents. Upload a policy PDF, ask questions in plain English, and receive AI-powered answers complete with source citations from the original document.

## Architecture

This project consists of two main components:

1.  **`mercerchatbot` (Frontend):** A Next.js application built with React and TypeScript. It provides the user interface for uploading documents and interacting with the chatbot.

2.  **`mercerchatbotbackend2` (Backend):** A FastAPI server that acts as a processing bridge. It handles PDF uploads, performs Optical Character Recognition (OCR) using Tesseract, stores processed data (original PDFs, page images, and text) in Google Cloud Storage (GCS), and communicates with a separate, external GPU-powered service for the core AI logic.

## Features

-   **Interactive Chat Interface:** A clean and user-friendly interface for conversing with your documents.
-   **PDF Document Upload:** Securely upload insurance policies via drag-and-drop or file selection.
-   **AI-Powered Q&A:** Ask complex questions about your policies and get clear, concise answers.
-   **Source Citation:** Responses include references to the specific file and page numbers in the source PDF.
-   **Visual Context:** Relevant page images from the document are displayed alongside answers for easy verification and context.

## Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

-   Docker and Docker Compose
-   Node.js (v18 or later) and npm
-   A Google Cloud Platform (GCP) project
-   A GCS bucket within your GCP project
-   A GCP service account key file with permissions to write to the GCS bucket

### Backend Setup (`mercerchatbotbackend2`)

1.  Clone the repository and navigate to the backend directory:
    ```bash
    git clone https://github.com/mihirb23/mercer.git
    cd mercer/veNTUre-X-Mercer-main/mercerchatbotbackend2
    ```

2.  **Configure Environment:**
    -   Place your GCP service account key file in a `secrets` directory inside `mercerchatbotbackend2`. For example: `mercerchatbotbackend2/secrets/your-key-file.json`.
    -   Open the `docker-compose.yml` file and update the `environment` and `volumes` sections with your specific configuration:

    ```yaml
    services:
      backend:
        # ...
        volumes:
          - ./app:/app/app
          - ./data/uploads:/data/uploads
          # Update this line to point to your key file
          - ./secrets/your-key-file.json:/secrets/your-key-file.json:ro 
        environment:
          # Required: Set your GCS bucket name
          - GCS_BUCKET=your-gcs-bucket-name
          # Required: Update this to the path of your key file inside the container
          - GOOGLE_APPLICATION_CREDENTIALS=/secrets/your-key-file.json
          # Required: Set the URL for the external AI processing service
          - GPU_BACKEND_URL=https://your-gpu-backend.example.com/ingest-and-answer
          # Optional: Set the bearer token for the AI service
          - GPU_BEARER_TOKEN=your-secret-token
          # Optional: Adjust the timeout for GPU requests
          - GPU_TIMEOUT_SEC=180
    ```

3.  **Build and Run the Backend:**
    From the `mercerchatbotbackend2` directory, run:
    ```bash
    docker-compose up --build
    ```
    The backend will be available at `http://localhost:8000`.

### Frontend Setup (`mercerchatbot`)

1.  In a new terminal, navigate to the frontend directory:
    ```bash
    cd ../mercerchatbot 
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Start the Development Server:**
    ```bash
    npm run dev
    ```

4.  **Open the Application:**
    Open `http://localhost:3000` in your browser. The frontend is pre-configured to connect to the backend running at `http://localhost:8000`.

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](./veNTUre-X-Mercer-main/LICENSE) file for more details.
