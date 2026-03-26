# --- Stage 1: Build the React Frontend ---
FROM node:18 AS frontend-builder
WORKDIR /app/frontend

# Install dependencies and build
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# --- Stage 2: Setup the Python Backend ---
FROM python:3.9

# Create a non-root user (Required by Hugging Face)
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"
WORKDIR /app

# Install Python requirements
COPY --chown=user backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your backend code
COPY --chown=user backend/ .

# Copy the compiled React files from Stage 1 into a 'static' folder
COPY --chown=user --from=frontend-builder /app/frontend/dist ./static

# Expose the required port and run FastAPI
EXPOSE 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]