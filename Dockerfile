# ---------- FRONTEND BUILD ----------
FROM node:18 AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ .
RUN npm run build


# ---------- BACKEND ----------
FROM python:3.10

# create user
RUN useradd -m -u 1000 user
USER user

WORKDIR /app

# install python deps
COPY --chown=user backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# copy backend
COPY --chown=user backend/ .

# copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./static

# expose port
EXPOSE 10000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]