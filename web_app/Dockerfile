# syntax=docker/dockerfile:1
FROM python:3.10-slim-buster

# Prevents Python from writing pyc files to disc
ENV PYTHONDONTWRITEBYTECODE 1

# Prevents Python from buffering stdout and stderr
ENV PYTHONUNBUFFERED 1

RUN pip install --upgrade pip

COPY . .

RUN pip install -r requirements.txt

EXPOSE 5000

CMD gunicorn --worker-class gevent \
  --workers 1 \
  --bind 0.0.0.0:5000 \
    patched:app