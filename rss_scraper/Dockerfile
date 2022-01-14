# syntax=docker/dockerfile:1
FROM python:3.10

WORKDIR /rss_scraper

COPY ./rss_scraper ./

RUN pip install -r requirements.txt

CMD ["python", "-u", "rss_to_mysql.py"]

