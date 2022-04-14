FROM redislabs/redismod:latest

ARG redis_pw
ENV REDIS_PASSWORD=$redis_pw

# Install AWS CLI - used for backups to S3
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update
RUN apt-get --assume-yes install apt-utils
RUN apt-get --assume-yes install wget
RUN apt-get --assume-yes install unzip
RUN wget https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -O awscliv2.zip
RUN unzip awscliv2.zip
RUN cd aws && ./install
RUN aws --version

COPY redis.conf /usr/local/etc/redis/redis.conf

ENTRYPOINT ["/bin/sh", "-c", "redis-server /usr/local/etc/redis/redis.conf --requirepass $REDIS_PASSWORD"]

EXPOSE 6379