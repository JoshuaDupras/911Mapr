# syntax=docker/dockerfile:1
FROM python:3.10

COPY . .

RUN pip install -r requirements.txt

EXPOSE 80

CMD ["python", "-u", "twitter_bot.py"]

