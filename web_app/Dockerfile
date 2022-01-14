# syntax=docker/dockerfile:1
FROM python:3.10

WORKDIR /web_app

COPY ./web_app .

RUN pip install -r requirements.txt

EXPOSE 5000

CMD ["python", "-u", "app.py"]

