# syntax=docker/dockerfile:1
# Dockerfile — multi-stage image for the fictional woody-inventory API.
# Demonstrates Dockerfile syntax: a parser directive, ARG before FROM, multi-stage builds, cache mounts, a heredoc, --chown/--chmod, LABEL, HEALTHCHECK and exec-form ENTRYPOINT/CMD.

# Build arguments declared before the first FROM can be used in FROM lines
ARG PYTHON_VERSION=3.12
ARG APP_VERSION=0.0.0-dev

# ---- build stage: compile wheels for the app and its dependencies ----
FROM python:${PYTHON_VERSION}-slim AS build

# Re-declare to bring the global ARG into this stage
ARG APP_VERSION
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /src

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY src/ ./src/

# Reuse pip's download cache between builds without baking it into a layer
RUN --mount=type=cache,target=/root/.cache/pip \
    SETUPTOOLS_SCM_PRETEND_VERSION="${APP_VERSION}" \
    pip wheel --wheel-dir /wheels .

# ---- runtime stage: slim image with only the built wheels ----
FROM python:${PYTHON_VERSION}-slim AS runtime

ARG APP_VERSION
LABEL org.opencontainers.image.title="woody-inventory" \
      org.opencontainers.image.description="Forest and lumber-yard inventory API" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.url="https://inventory.example.com" \
      com.example.woody.tier=backend

ENV APP_HOME=/app \
    APP_PORT=8080 \
    PYTHONUNBUFFERED=1

RUN groupadd --system woody \
    && useradd --system --gid woody --home-dir /app --shell /usr/sbin/nologin woody

WORKDIR ${APP_HOME}

COPY --from=build /wheels /tmp/wheels
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-index --find-links=/tmp/wheels woody-inventory \
    && rm -rf /tmp/wheels

# A heredoc runs a small script without shipping a separate file
RUN <<EOF
set -eu
mkdir -p /app/config /app/uploads /app/data
printf 'SITE=%s\nUNITS=%s\n' SITE-NORTH metric > /app/config/runtime.env
chown -R woody:woody /app
EOF

COPY --chown=woody:woody config/logging.yaml ./config/
ADD --chown=woody:woody --chmod=644 https://static.example.com/woody/species-codes.csv ./data/species-codes.csv

VOLUME ["/app/uploads"]
USER woody

EXPOSE 8080/tcp
EXPOSE 9090

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8080/healthz', timeout=4)"]

STOPSIGNAL SIGTERM
ENTRYPOINT ["python", "-m", "woody_inventory"]
CMD ["serve", "--host", "0.0.0.0", "--port", "8080"]
