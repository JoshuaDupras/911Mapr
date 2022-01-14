# syntax=docker/dockerfile:1
FROM python:3.10

WORKDIR /kafka_producer

COPY ./kafka_producer .

RUN pip install -r requirements.txt

CMD ["python", "-u", "new_incidents_to_kafka.py"]

