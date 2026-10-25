FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DEFAULT_TIMEOUT=1000 \
    PIP_RETRIES=10 \
    HF_HOME=/app/.cache/huggingface \
    HF_HUB_DISABLE_TELEMETRY=1 \
    TOKENIZERS_PARALLELISM=false

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

# Bake the configured GGUF model into the image. requirements.txt pins the
# prebuilt CPU wheel for llama-cpp-python, so no compiler is required.
ARG AI_MODEL_REPO_ID=google/gemma-4-E4B-it-qat-q4_0-gguf
ARG AI_MODEL_FILENAME=gemma-4-E4B_q4_0-it.gguf
ENV AI_MODEL_REPO_ID=${AI_MODEL_REPO_ID} \
    AI_MODEL_FILENAME=${AI_MODEL_FILENAME}

RUN mkdir -p /app/ai_models \
    && python -c "from huggingface_hub import hf_hub_download; hf_hub_download(repo_id='${AI_MODEL_REPO_ID}', filename='${AI_MODEL_FILENAME}', local_dir='/app/ai_models')"

# The model is now baked into the image; never attempt a runtime download.
ENV HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1

COPY . .

RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

CMD ["/app/entrypoint.sh"]
