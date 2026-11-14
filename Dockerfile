FROM python:3.15-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 MPLBACKEND=Agg CACHE_DIR=/data TZ=America/Guayaquil
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
RUN useradd -m pacha && mkdir -p /data && chown pacha /data
USER pacha
VOLUME ["/data"]
CMD ["python", "-m", "app"]
