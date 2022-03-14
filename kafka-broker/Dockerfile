# syntax=docker/dockerfile:1
FROM confluentinc/cp-kafka:6.2.2

WORKDIR /

COPY log4j.properties log4j.properties

ENV KAFKA_OPTS="-Dlog4j.configuration=file:///log4j.properties"
